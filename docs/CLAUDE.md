# Metalurgi — Mandate Supervisor

Hackathon project (AI & Open Banking Hackathon, Tbilisi, NBG). Track: **AI in Finance, Fraud/AML**.
Deadline: **Sun 25 Oct 2026, 23:59 Tbilisi** (we submit at 21:00). Feature freeze Sun 12:00.
Task list with "Done when" criteria: `docs/TASKS.md`. Work through it in order; tick boxes there when done.

## What we are building (one paragraph)
A **trust gateway that a bank runs in front of its Open Banking payment API**. AI agents send payment
requests on behalf of the bank's customers. Before any payment executes, the gateway checks:
1. **Mandate** (hard rule): the customer signed a narrow permission (Ed25519) — amount, category, city,
   dates, expiry, named agent, max uses, total budget, not revoked. Fail → BLOCK.
2. **Behavior**: is this normal for this customer? Score 0–100 from her own transaction history.
3. **Context**: merchant age/unknown, price vs market, agent research done, velocity. Risk 0–100.
4. **Decision**: deterministic policy → `EXECUTE | VERIFY | ASK_HUMAN | BLOCK` + plain-language reasons,
   written to an audit log.

Users: the **bank's fraud analyst** (Risk Officer Console — the main screen), the **bank's customer Nino**
(signs mandates / approves inside "the bank app" pages), **NBG** (anonymized report page).

## Non-negotiable rules (guardrails — keep them visible in code and tests)
- The LLM **never** decides whether money moves. Decisions are plain, deterministic TypeScript.
- Behavior/context scores can only **tighten** (VERIFY/ASK/BLOCK). They can never turn a mandate failure
  into anything except BLOCK. Have a test for this.
- The mock bank (`/api/bank/pis`) executes only after an EXECUTE decision or a logged human approval.
- `uses` and `spent` update only after execution, in the same function as the check.
- **All data is synthetic.** Show a "Synthetic data" badge on every page. No real names, cards, IBANs.
- Never commit API keys. LLM key lives in `.env.local` (gitignored).

## Stack and layout
Next.js (App Router) + TypeScript + Tailwind. Vitest for tests. Node built-in `crypto` for Ed25519.
zod for validation. In-memory store first (`lib/store.ts`); audit log persisted to a JSON file/SQLite later.

```
lib/supervisor/   mandate.ts (types, canonicalize, sign/verify, checkMandate)
                  behavior.ts  context.ts  decide.ts  policy.ts
lib/agent/        LLM agent with tools + scripted fallback
lib/store.ts      mandates, signatures, revoked set, uses/spent, audit entries
app/              pages: /console, /bank-app, /agent, /audit, /nbg ; API routes under app/api/
data/             seed.ts, transactions.json, hotels.json, merchants.json, agents.json, policy.json, keys/
tests/            unit tests per module, scenarios.test.ts (A–H), attacks.test.ts
```

## Mandate (signed by the customer over canonical JSON = keys sorted recursively, then JSON.stringify)
```json
{
  "mandate_id": "m_001",
  "principal_id": "nino",
  "agent_id": "agent_travel_01",
  "category": "hotel",
  "city": "Paris",
  "dates": { "from": "2026-09-20", "to": "2026-09-23" },
  "max_amount": 800,
  "currency": "EUR",
  "max_uses": 1,
  "preferences": { "refundable": true },
  "expires_at": "2026-10-25T18:00:00Z"
}
```
`preferences` are soft (used by behavior scoring), everything else is a hard rule.

## Payment proposal (signed by the agent with its own key)
```json
{
  "proposal_id": "p_001", "mandate_id": "m_001", "agent_id": "agent_travel_01",
  "merchant": "bookify.example", "category": "hotel", "city": "Paris",
  "dates": { "from": "2026-09-20", "to": "2026-09-23" },
  "amount": 540, "currency": "EUR", "refundable": true,
  "options_compared": 6, "created_at": "..."
}
```

## Demo scenarios (expected outcomes — `tests/scenarios.test.ts` must match)
| # | Proposal | Expected |
|---|---|---|
| A | €540 refundable, known platform, 6 options compared | EXECUTE |
| B | €760 non-refundable, known platform (Nino never books non-refundable) | ASK_HUMAN |
| C | €610 refundable, unknown site 4 days old, 45% below market, 1 option compared | VERIFY |
| D | €950 | BLOCK (exceeds €800) |
| E | mandate edited to €2,000 after signing | BLOCK (signature invalid) |
| F | payment after mandate revoked | BLOCK (revoked) |
| G | two payments of €475 on a single-use mandate | 1st EXECUTE, 2nd BLOCK |
| H | unknown agent or wrong agent key | BLOCK (agent not verified) |

## Starting policy (data/policy.json — tune in E13)
mandate fail → BLOCK; context ≥ 85 → BLOCK; context ≥ 50 → VERIFY; behavior ≥ 40 → ASK_HUMAN; else EXECUTE.

Behavior signals: price/night outside her 10–90th percentile (≤30), new merchant (≤25),
non-refundable when she is almost always refundable (≤30), unusual hour (≤15).
Context signals: merchant < 30 days old (35), unknown merchant (15), > 30% below market median (30),
fewer than 2 options compared (20), > 3 agent payments in an hour (15).
Every score returns `{ total, signals: [{ name, points, explanation }] }` so the UI can draw bars.

## Conventions
- Small commits after each task, message starts with the task ID (e.g. `E2: ed25519 sign/verify`).
- Run `npm test` before committing. Don't break scenario tests.
- Keep UI readable for a 1080p screen recording: large text, clear outcome colours
  (EXECUTE green, VERIFY amber, ASK_HUMAN blue, BLOCK red).
- Prefer simple code the team can explain to a jury over clever code.

## Commands (once set up)
`npm run dev` · `npm test` · `npm run seed` · `npm run keys` · `npm run attacks`
