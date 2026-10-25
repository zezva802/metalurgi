# Metalurgi · Mandate Supervisor

A **trust gateway a bank runs in front of its Open Banking payment API.** AI agents send payment
requests on behalf of the bank's customers; before any payment executes, the gateway runs four
checks and decides `EXECUTE | VERIFY | ASK_HUMAN | BLOCK` with plain-language reasons, written to an
audit log.

> **The LLM never decides whether money moves.** Decisions are deterministic TypeScript.

AI & Open Banking Hackathon (Tbilisi, NBG) · Track: AI in Finance, Fraud/AML.
**All data is synthetic.** No real people, cards or IBANs.

Detailed spec: [`docs/CLAUDE.md`](docs/CLAUDE.md) · Task list: [`docs/TASKS.md`](docs/TASKS.md)

## What it does

A customer (Nino) signs a narrow **mandate** — "a hotel in Paris, 20–23 Sep, max €800, refundable,
single use, by this named agent". An AI agent then shops and sends a **payment proposal**, signed
with its own key. The gateway checks, in order:

1. **Agent** (hard rule) — the agent is registered, active, and the proposal's signature is valid.
2. **Mandate** (hard rule) — Ed25519 signature valid, not revoked, not expired, and amount, category,
   city, dates, uses and running budget all within what Nino signed.
3. **Behavior** — is this normal *for Nino*, scored 0–100 against her own transaction history.
4. **Context** — external risk 0–100: merchant age/trust, price vs market, how much the agent shopped,
   velocity.

A **hard failure (1 or 2) is always BLOCK**; the behavior/context scores can only *tighten* the
outcome (EXECUTE → VERIFY → ASK_HUMAN), never loosen a hard failure. See **Decision policy** below.

Five screens:

| Screen | Who | What |
|---|---|---|
| `/console` | Bank fraud analyst | Live feed of every decision + counters; click a row for the full breakdown; sliders to tune thresholds |
| `/bank-app` | Customer (Nino) | Draft & sign a mandate, revoke one, approve/reject pending payments |
| `/agent` | — | Scripted agent (scenarios A–H), live LLM agent, batch run, test form |
| `/audit` | Compliance | Persisted audit log, filterable by outcome |
| `/nbg` | Regulator | Anonymized aggregates — no personal data |

## Setup

```bash
npm install                      # install dependencies
cp .env.local.example .env.local # optional: add ANTHROPIC_API_KEY for the live LLM agent (A4/A5/A7)
npm run keys                     # synthetic Ed25519 demo keys → data/keys/ (gitignored, REQUIRED)
npm run seed                     # regenerate data/transactions.json (already committed; deterministic)
npm run dev                      # http://localhost:3000
npm test                         # unit + scenario tests (Vitest)
npm run attacks                  # run the attack suite → "0 of 8 attacks executed"
npm run latency                  # 200 decisions → p50/p95/p99/max latency
npm run batch                    # 200-payment batch (20 bad) → counts per outcome
```

`npm run keys` is required — the gateway verifies signatures against the keys in `data/keys/`, which
are gitignored and regenerated per machine. **No API key is needed** for anything except the live LLM
agent and AI mandate drafting; without `ANTHROPIC_API_KEY` those fall back to the scripted agent and
the mandate template, and everything else runs normally.

## Decision policy (tuned values, E13)

The decision runs the **hard gates first** — agent verification and the mandate rules. Any hard
failure is an absolute **BLOCK**; the behavior and context scores can only *tighten* the outcome,
never rescue a hard failure. If the hard gates pass, the scores map to an outcome by these
thresholds (`data/policy.json`, editable live by the console sliders):

| Condition | Outcome |
|---|---|
| context score ≥ **90** | BLOCK |
| behavior score ≥ **40** | ASK_HUMAN |
| context score ≥ **50** | VERIFY |
| otherwise | EXECUTE |

`contextBlock` is **90** (not the draft 85) so scenario C's context score of 85 lands on VERIFY, as
the scenario table requires. ASK_HUMAN is checked before VERIFY so the more restrictive outcome wins.

**Behavior signals** (`lib/supervisor/behavior.ts`, vs Nino's own history): price/night outside her
10–90th percentile (≤30), a merchant she has never used (25), non-refundable when she is almost
always refundable (30), an unusual booking hour (15).

**Context signals** (`lib/supervisor/context.ts`): a merchant < 30 days old (35) **or** not in the
registry at all (15, mutually exclusive), > 30% below the same hotel's market median (30), fewer
than 2 options compared (20), > 3 agent payments in an hour (15).

All eight demo scenarios (A–H) pass against these values; see `tests/scenarios.test.ts`.

## Guardrails (and where they live in the code)

| Guardrail | Enforced in |
|---|---|
| The LLM never decides whether money moves — decisions are deterministic | `lib/supervisor/decide.ts`, `lib/supervisor/policy.ts` |
| Behavior/context can only tighten, never loosen a hard failure | `decide.ts` (hard gates run first) + guardrail test in `tests/scenarios.test.ts` |
| The bank executes only after an EXECUTE decision or a logged human approval | `lib/gateway.ts`, `lib/decisions.ts` (`resolveDecision`), `lib/bank.ts` |
| `uses`/`spent` update only after execution, in the same pass as the check | `lib/gateway.ts` + `lib/store.ts` (`recordExecution`) |
| Every attack is blocked — proven, not asserted | `lib/attacks.ts`, `tests/attacks.test.ts`, `npm run attacks` |
| All data synthetic; a "Synthetic data" badge on every page | `data/`, `components/header.tsx` (`SyntheticBadge`) |
| Never commit API keys | `.env*` and `data/keys/` are gitignored |

## Architecture

```
lib/supervisor/   mandate.ts   canonical JSON, Ed25519 sign/verify, hard mandate checks, mandate hash
                  proposal.ts  the signed payment proposal (zod)
                  behavior.ts  behavior score vs Nino's history      context.ts  external context risk
                  signals.ts   shared Signal/Score + percentile       policy.ts  thresholds → outcome (live-tunable)
                  decide.ts    hard gates first, then policy (the single decision function)
lib/              gateway.ts   evaluatePayment(): agent + mandate checks, scores, decide, execute, record, time
                  bank.ts      mock Open Banking AIS + PIS (separate state; executes only what the gateway authorized)
                  store.ts     in-memory mandates / revoked set / usage        decisions.ts  decision log (persisted → data/audit.json)
                  audit.ts     flat audit projection      agents.ts  agent registry + signature check
                  catalog.ts   hotel offers + merchant registry + market median     attacks.ts  the 8 attacks     batch.ts  200-payment batch
                  keys.ts / mandates.ts / transactions.ts / money.ts
lib/agent/        tools.ts     search_hotels / compare_offers / propose_payment
                  llm.ts       live LLM agent loop (streams tool calls)    draft.ts  mandate drafting    sign.ts  sign as the agent
app/              bank-app/ agent/ console/ audit/ nbg/ + api/ (routes below)
data/             seed.ts  transactions.json  hotels.json  merchants.json  agents.json  policy.json
                  keys/ (generated)  audit.json (runtime, gitignored)
scripts/          keys.ts  attacks.ts  latency.ts  batch.ts
tests/            *.test.ts  fixtures.ts
```

### API routes

| Route | What it does |
|---|---|
| `POST /api/mandates` · `GET /api/mandates` | Sign & store a mandate (server sets id + principal) · list mandates with revoked status |
| `POST /api/mandates/[id]/revoke` | Revoke a mandate |
| `POST /api/mandates/draft` | AI-draft a mandate from a plain request (falls back to the template) |
| `POST /api/payments` | The gateway: `{ proposal, signature }` → decision |
| `POST /api/agent/scenario` | Scripted agent replays one scenario A–H |
| `POST /api/agent/llm` · `POST /api/agent/llm/stream` | Live LLM agent (one-shot · streamed tool calls) |
| `POST /api/agent/batch` | 200-payment batch → counts per outcome |
| `POST /api/agent/test-send` | Dev test form: server signs as the agent, then runs the gateway |
| `GET /api/decisions` · `POST /api/decisions/[id]/resolve` | Console feed + counters · approve/reject a pending decision |
| `GET /api/audit` | Persisted audit entries |
| `GET /api/policy` · `POST /api/policy` | Read / tune the live thresholds |
| `GET /api/bank/ais/transactions` · `GET`,`POST /api/bank/pis` | Mock Open Banking AIS history · PIS execute |

## What is synthetic or mocked

- **All data is synthetic** (`data/`): Nino's 151 transactions (fixed seed), 20 Paris hotel offers,
  the merchant registry and the agent registry. No real people, cards or IBANs.
- **Keys are synthetic**, generated locally by `npm run keys` (never committed).
- **The bank is mocked** (`lib/bank.ts`): an in-process stand-in for Open Banking AIS/PIS, not a real
  connection. It still enforces that PIS executes only a payment the gateway authorized.
- **Demo shortcut:** the bank app signs with Nino's key *on the server*; a real bank app would keep
  the key on the customer's device.
- **State** is in memory (resets on restart); only the audit log is persisted to `data/audit.json`.

## Third-party components

| Package | Use | License |
|---|---|---|
| [next](https://github.com/vercel/next.js) | App framework (App Router) | MIT |
| [react](https://github.com/facebook/react), react-dom | UI | MIT |
| [zod](https://github.com/colinhacks/zod) | Schema validation | MIT |
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | Live LLM agent (optional) | MIT |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | Styling | MIT |
| [vitest](https://github.com/vitest-dev/vitest) | Tests | MIT |
| [tsx](https://github.com/privatenumber/tsx) | Run the TS scripts | MIT |
| [typescript](https://github.com/microsoft/TypeScript) | Language | Apache-2.0 |
| [eslint](https://github.com/eslint/eslint), eslint-config-next | Linting | MIT |

Ed25519 signing/verification uses the Node.js built-in `crypto` module (no third-party crypto).

## Status

| Phase | State |
|---|---|
| 1 · Foundations | **Done** |
| 2 · Real engine + bank screens | **Done** |
| 3 · Proof and evidence | **Done** |
| 4 · Polish + freeze | README + polish done; deploy (S11) and final runs (A9) pending |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · zod · Vitest · tsx ·
Node built-in `crypto` (Ed25519) · optional Anthropic SDK for the live agent.
