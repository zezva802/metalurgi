# Metalurgi · Mandate Supervisor

A trust gateway a bank runs in front of its Open Banking payment API. AI agents send payment
requests on behalf of the bank's customers; before any payment executes, the gateway checks that
the customer signed a narrow permission (a **mandate**) and decides
`EXECUTE | VERIFY | ASK_HUMAN | BLOCK` with plain-language reasons.

The LLM never decides whether money moves. Decisions are deterministic TypeScript.

AI & Open Banking Hackathon (Tbilisi, NBG) · Track: AI in Finance, Fraud/AML.
**All data is synthetic.** No real people, cards or IBANs.

Detailed spec: [`docs/CLAUDE.md`](docs/CLAUDE.md) · Task list: [`docs/TASKS.md`](docs/TASKS.md)

## Setup

```bash
npm install
npm run keys     # synthetic Ed25519 demo keys → data/keys/ (gitignored, required)
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
```

`npm run seed` regenerates `data/transactions.json` (already committed; same output every time).

## Try it (Phase 1 checkpoint)

1. **Bank app** → **Sign mandate**. Nino signs "hotel in Paris, 20–23 Sep, max €800, single use".
   You get `Signed`, a `mandate_id` and a short signature.
2. **Agent** → the temporary test form is prefilled with €950 → **Send payment**.
   Result: **BLOCK**, "Exceeds the €800 limit (€950 requested)".
3. Change the amount to 540 → **EXECUTE**, "All mandate rules passed".

## Decision policy (tuned values, E13)

The decision runs the **hard gates first** — agent verification and the mandate rules. Any hard
failure is an absolute **BLOCK**; the behavior and context scores can only *tighten* the outcome,
never rescue a hard failure. If the hard gates pass, the scores map to an outcome by these
thresholds (`data/policy.json`, editable live by the console sliders in S9):

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

## Status

| Phase | State |
|---|---|
| 1 · Foundations (Fri) | **Done** |
| 2 · Real engine + bank screens (Sat) | Next: E5 agent registry |
| 3 · Proof and evidence | Not started |
| 4 · Polish + freeze | Not started |

### What Phase 1 delivered

**Engine** (`lib/supervisor/`)
- `mandate.ts`: the `Mandate` type plus zod validation. `canonicalize()` (keys sorted recursively)
  gives the exact string that is signed and hashed. Ed25519 `signCanonical` / `verifyCanonical`
  use Node `crypto`.
- `checkMandate()`: hard rules, all reported at once: signature, expiry, mandate_id, agent_id,
  category, city, dates, currency, max amount, max uses, running budget.
- `decide.ts`: decision stub. Any mandate failure is BLOCK with every failure as a reason;
  otherwise EXECUTE. Behavior/context scores come in E8–E10 and may only tighten this.
- `proposal.ts`: the payment proposal type an agent sends.

**Gateway and bank**
- `lib/gateway.ts`: `evaluatePayment()` looks up the stored mandate, its usage and Nino's
  public key, then runs the check and the decision. An unknown mandate is BLOCK.
- `lib/bank.ts`: mock Open Banking bank, a separate system with its own state. PIS executes only
  payments the gateway has authorized, and each authorization works once.
- `lib/store.ts`: in-memory store (mandates, revoked set, uses/spent).

**API**
| Route | What it does |
|---|---|
| `POST /api/mandates` | Validates a draft, assigns `mandate_id`, sets principal = Nino, signs, stores |
| `GET /api/mandates` | Lists signed mandates |
| `POST /api/payments` | Validates a proposal → mandate check → decision |
| `GET /api/bank/ais/transactions` | Nino's account history (mock AIS) |
| `POST /api/bank/pis` | Executes a gateway-authorized payment, otherwise 403 (mock PIS) |

**UI**
- Header "Metalurgi · Bank gateway", orange **Synthetic data** badge on every page, and nav to
  Console, Bank app, Agent, Audit, NBG (Console, Audit and NBG are placeholders for now).
- Bank app: mandate editor + Sign. Agent: temporary test payment form (replaced by scripted
  agent buttons in A6). Outcome colours: EXECUTE green, VERIFY amber, ASK_HUMAN blue, BLOCK red.

**Synthetic data** (`data/`)
- `transactions.json`: 151 transactions over 12 months (groceries, transport, cafes in GEL and
  9 refundable hotel stays at €92–190/night on three known platforms), from a fixed seed.
- `hotels.json`: 20 Paris offers for 20–23 Sep, including the scenario offers (A €540, B €760
  non-refundable, C €610 on a 4-day-old unknown site, 45% below market, D €950).
- `merchants.json`: merchant registry (known / domain age).

**Tests**: 55 passing. One test per mandate rule, scenarios D, E and G at rule level, signature
tampering, seed determinism, catalog scenario offers, and the bank's authorize-once rule.

### Known shortcuts (so far)
- The bank app signs with Nino's key on the server. In a real bank app the key would stay on
  the customer's device.
- EXECUTE does not yet pay through the mock bank or update uses/spent (E7).
- Agents don't sign proposals yet (E5), and there is no revocation yet (E6).
- State is in memory and resets when the server restarts. The audit log will be persisted (S7).

## Layout

```
lib/supervisor/   mandate.ts  proposal.ts  decide.ts      (engine: pure, tested)
lib/              gateway.ts  bank.ts  store.ts  mandates.ts  catalog.ts  keys.ts  transactions.ts
app/              bank-app/  agent/  console/  audit/  nbg/  api/
data/             seed.ts  transactions.json  hotels.json  merchants.json  keys/ (generated)
scripts/          keys.ts
tests/            *.test.ts  fixtures.ts
docs/             CLAUDE.md (spec)  TASKS.md (task list)
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · zod · Vitest · tsx ·
Node built-in `crypto` (Ed25519).
