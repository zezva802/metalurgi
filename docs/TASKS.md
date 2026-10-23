# Build tasks (engineering)

Tick a task only when its **Done when** is true. Commit after each task with the task ID in the message.
The full board (including pitch/video tasks) is the "Build tasks" tab in the team doc.

## Phase 1 · Fri 17:00–24:00 · Foundations
**Checkpoint:** sign a mandate in the browser, send a fake €950 payment, see it blocked with "Exceeds the €800 limit".

- [x] **S0 · Repo setup** — Next.js + TS + Tailwind + App Router, Vitest (`"test": "vitest run"`), zod, `.env.local` in .gitignore.
  Done when: `npm run dev` serves a page and `npm test` runs.
- [x] **E1 · Mandate type + canonical JSON** — `lib/supervisor/mandate.ts`: `Mandate` type (see CLAUDE.md), `canonicalize()` sorts keys recursively.
  Done when: test shows key order doesn't change the canonical string.
- [x] **E2 · Ed25519 sign/verify** — Node `crypto` (`generateKeyPairSync('ed25519')`, `sign(null, …)`, `verify(null, …)`). `npm run keys` writes synthetic demo keys for Nino and `agent_travel_01` to `data/keys/`.
  Done when: sign→verify is true; changing `max_amount` after signing → false (scenario E).
- [x] **E3 · Hard mandate checks** — `checkMandate(mandate, signature, proposal, state)` → `{ pass, failures: [{ rule, message }] }`. Rules: signature, expiry, agent_id match, category, city, dates in range, amount ≤ max_amount, uses < max_uses, spent + amount ≤ max_amount.
  Done when: one test per rule passes, incl. D (€950) and G (second split payment).
- [x] **E4 · Decision stub** — `lib/supervisor/decide.ts`: mandate fail → BLOCK with reasons, else EXECUTE. Returns `{ outcome, reasons[] }`.
  Done when: €950 proposal → BLOCK, "Exceeds the €800 limit".
- [x] **S1 · App layout** — header "Metalurgi · Bank gateway" + orange "Synthetic data" badge; nav: Console, Bank app, Agent, Audit, NBG; placeholder pages.
  Done when: all pages reachable.
- [x] **S2 · Bank-app mandate screen** — request textarea, JSON editor prefilled with the template, Sign → `POST /api/mandates` (signs with Nino's key, stores in `lib/store.ts`).
  Done when: Sign shows "Signed", short signature and mandate_id.
- [x] **S3 · Test payment form** (temporary) — merchant + amount → `POST /api/payments` → E3 + E4 → shows outcome and reasons.
  Done when: the Phase 1 checkpoint works in the browser.
- [x] **A1 · Seed Nino's history** — `data/seed.ts`, fixed random seed, ~150 transactions over 12 months (groceries, transport, cafes + 8–10 hotel stays €90–200/night, all refundable, 2–3 known platforms). Fields: id, date, hour, amount, currency, merchant, category, refundable, nights.
  Done when: `npm run seed` writes `data/transactions.json`.
- [x] **A2 · Hotel catalog + merchant registry** — `data/hotels.json` (~20 Paris offers 20–23 Sep incl. scenario offers €540 / €760 non-refundable / €610 on paris-hotels-deal.shop / €950), `data/merchants.json` (domain, known, age_days).
  Done when: files exist with the scenario offers.
- [ ] **A3 · Mock bank endpoints** — `GET /api/bank/ais/transactions`, `POST /api/bank/pis` → `{ payment_id, status: "executed" }` (called only by the gateway).
  Done when: both respond.

## Phase 2 · Sat 09:00–19:00 · Real engine + bank screens
**Checkpoint (Sat 19:00):** scenario A end to end: agent proposes → EXECUTE → mock bank pays → row in console.

- [ ] **E5 · Agent registry + agent signature** — `data/agents.json` (agent_id, operator, public_key, status). Gateway verifies agent exists, is active, proposal signature valid, mandate names this agent.
  Done when: unknown agent and wrong key both BLOCK (H).
- [ ] **E6 · Revocation** — revoked set, `POST /api/mandates/[id]/revoke`, rule "not revoked", Revoke button in bank app.
  Done when: payment after revoke → BLOCK (F).
- [ ] **E7 · Uses + running total** — check and update in one function, only after execution.
  Done when: split-payment test passes (G).
- [ ] **E8 · Behavior envelope + score** — `behavior.ts`, signals per CLAUDE.md, returns `{ total, signals }`.
  Done when: A low; B's points mostly from "non-refundable".
- [ ] **E9 · Context risk** — `context.ts`, signals per CLAUDE.md.
  Done when: C high with 3 named signals; A low.
- [ ] **E10 · Decision policy** — `data/policy.json` + `policy.ts`; reasons = failed rules or top 2–3 signals in plain words; test that scores never override a mandate BLOCK.
  Done when: `tests/scenarios.test.ts` A–H all pass.
- [ ] **S4 · Risk Officer Console** (`/console`) — counters (executed / verify / asked / blocked), table newest first (time, agent, merchant, amount, outcome badge, reason), refresh every 2 s, row → detail.
  Done when: new payments appear within 2 s.
- [ ] **S5 · Decision detail** — 4 cards (Mandate rules pass/fail, Behavior bars, Context bars, Decision + reasons).
  Done when: scenario C shows its 3 context bars.
- [ ] **S6 · Approval in bank app** — pending ASK_HUMAN/VERIFY list with Approve/Reject; approve → mock bank + log approver.
  Done when: B can be approved and the console row updates.
- [ ] **A4 · LLM agent** — `lib/agent/`, tools `search_hotels`, `compare_offers`, `propose_payment`; run log of every tool call; proposal signed with agent key → `/api/payments`.
  Done when: "Book Nino's Paris hotel" reaches the gateway with a visible run log.
- [ ] **A5 · Mandate drafting** — LLM turns the request into mandate JSON, zod-validated, editable before signing; template on failure.
  Done when: the Paris request fills a valid mandate.
- [ ] **A6 · Scripted agent** — buttons A–H on `/agent` replaying fixed proposals through the same API.
  Done when: every button gives its expected outcome.

## Phase 3 · Sat 19:00–01:00 · Proof and evidence
**Checkpoint:** all 8 scenarios correct; `npm run attacks` prints "0 of N attacks executed".

- [ ] **E11 · Attack suite** — `tests/attacks.test.ts` + `npm run attacks`: forged signature, altered mandate, revoked, reused single-use, split over budget, expired, unknown agent, wrong agent key.
  Done when: prints 0 of N executed.
- [ ] **E12 · Latency** — time each decision (`performance.now()`), store in audit; script runs 200 decisions and prints p95.
  Done when: one real p95 number.
- [ ] **E13 · Tune thresholds** — adjust policy/signal points until A–H pass; document final values in README.
  Done when: scenario tests green 3 runs in a row.
- [ ] **S7 · Audit log** (`/audit`) — time, mandate_id, mandate hash (SHA-256 of canonical JSON), agent, amount, scores, outcome, reasons, approver, latency; persisted; filter by outcome.
  Done when: entries survive a restart.
- [ ] **S8 · NBG report** (`/nbg`) — counts per outcome, attacks blocked by type, p95, number of agents; no personal data.
  Done when: page shows numbers, no names/amounts per person.
- [ ] **S9 · Sliders, badge, errors** — console sliders edit policy in memory; badge on every page; LLM failure → message suggesting scripted agent.
  Done when: lowering the behavior threshold makes A ask for approval.
- [ ] **A7 · Live agent log** — `/agent` shows tool calls as they happen.
- [ ] **A8 · Batch run (stretch)** — 200 synthetic proposals with 20 bad ones → counts per outcome.

## Phase 4 · Sun 09:00–12:00 · Polish, then freeze at 12:00
- [ ] **E14 · README** — what it does; setup (`npm install`, `.env.local`, `npm run keys`, `npm run seed`, `npm run dev`, `npm test`, `npm run attacks`); architecture; third-party components + licenses; Guardrails section pointing to files; what's synthetic/mocked.
- [ ] **S10 · Polish** — consistent outcome colours, big fonts for video, no console errors.
- [ ] **S11 · Deploy (optional)** — Vercel, scripted agent default.
- [ ] **A9 · Final runs** — A–H three times each from a clean start; also with the LLM key removed.
