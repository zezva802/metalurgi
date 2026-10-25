# Vision — what Metalurgi should ideally be

This is the **target design** (from `idea.txt`), and how today's app differs. We don't have to build
all of it — the point is to steer toward it, and to be explicit about **what is deterministic and
what is LLM-based**, because that split is the whole idea.

## Core thesis
- **Cryptographic validity ≠ legitimacy.** A signed mandate proves the result wasn't tampered and
  came from the right key — it says nothing about whether the agent's *decision* matched the human's
  intent. (Human asks for a $50 serum; agent buys a $64 night cream; every signature check passes,
  but nobody asked for that.)
- **The unit of decision is the agent (the entity), not the transaction.** The supervisory question
  is *"should this agent be allowed to operate at all?"* — judged from a **dossier of ~50 real runs**,
  not one payment in isolation.

## The deterministic / LLM split (the heart of it)
> **Determinism establishes the facts. The model establishes the meaning.**

- **Deterministic (facts) — does the heavy lifting:** signature & mandate-scope checks; registry
  lookups (agent, operator, merchant, banned-model list); presence/consistency of run records and
  logs; "did a control fire and get overridden?"; known-pattern injection scans; statistical drift vs
  the agent's own baseline; recipient/AML checks; **hard gates**; **rule evaluation**; aggregation;
  and the **final decision math**. No model is in this path.
- **LLM (meaning) — one narrow call per specialist:** only the semantic judgment that rules can't
  make — e.g. *"does what the agent actually bought match what the human consented to?"* The model is
  **grounded on the deterministic evidence**, makes **exactly one bounded assessment**, and **never
  decides the outcome**. Specialists don't talk to each other.
- **The decision is not a score.** First check **hard gates** (automatic refuse — e.g. a control
  fired and was overridden, or the agent obeyed an injected instruction). Then weigh the rest
  (including how many of the 50 runs were clean) → **one of four outcomes** → a **human signs off**.

## Outcomes
Entity-level: **Authorise / Monitor / Refuse / Incomplete submission** (vs today's per-payment
EXECUTE / VERIFY / ASK_HUMAN / BLOCK).

## The 11 specialist checks (each: deterministic basis → single LLM question)
| Specialist | Deterministic facts | The one LLM "meaning" question |
|---|---|---|
| **Mandate** | signature valid; purchase within signed scope | does the purchase match the mandate's *intent*? |
| **KYA** (Know Your Agent) | agent/operator in registry, active; model not banned | does the declared purpose match observed behavior? |
| **Provenance** | run record exists; logs complete; hashes match | is the evidence trail plausibly genuine, not fabricated? |
| **Injection** | scan tool-calls/prompts for known attack patterns | did the agent obey an instruction from untrusted content? |
| **Counterparty** | merchant/recipient in registry; not sanctioned (AML) | is the recipient consistent with the stated purpose? |
| **Consent** | SCA/consent log present and covers this action | does what executed match what the human approved on screen? |
| **Log** | required logs present, well-formed, ordered | do the logs tell one coherent story? |
| **Drift** | this run vs the agent's historical baseline (stats) | is the change meaningful behavioral drift, or noise? |
| **Control Assurance** | required controls ran; none overridden | are the firm's described controls actually exercised? |
| **Systemic** | cross-firm aggregates (model/merchant concentration) | interpret an emerging cross-firm pattern |
| **Red Team** | run known adversarial probes; check results | read/craft adversarial cases |

Rules live **as data, not code** (the idea cites ~57), so a supervisor edits policy without a
programmer. Each rule belongs to the specialist whose evidence already contains what the rule needs.

## Gaps vs what we built today
| Dimension | Today (metalurgi) | Target (idea) |
|---|---|---|
| Unit of decision | one **transaction** | the **agent/entity**, over ~50 runs |
| Who decides | a **bank's** real-time gateway | a **regulator/central bank**, offline review |
| Submitter / data | synthetic customer history | **sponsoring bank/PSP** submits a dossier; **regulator** holds registries |
| Role of the LLM | **none** in assessment (only drives the shopping agent) | LLM **inside** assessment, but one narrow "meaning" call per specialist |
| Checks | 2 scores (behavior, context) + hard gates | **11 specialists** over a ~73-failure catalog across **8 lifecycle phases** |
| Rules | 3 thresholds + weights (partly in code) | **~57 rules stored as data**, supervisor-editable |
| Outcomes | EXECUTE/VERIFY/ASK/BLOCK | **Authorise/Monitor/Refuse/Incomplete** |
| Recipient (AML) | light merchant context only | explicit **counterparty/recipient** checks |
| Deliverable | a working gateway demo | a **machine-readable reporting schema** (each field annotated with the failure it detects) |

## What already aligns (keep it)
Hard-gates-first ordering; deterministic decision (no model in the verdict); the agent **registry**;
mandate **signature + scope** checks; **rules/thresholds as data** (`data/policy.json`); **human
sign-off** (approval queue); the **audit log**; plain-language reasons. The spirit — determinism
decides, model only interprets — is already how our decision path works.

## How to evolve toward it (incremental, keeping the hotel demo)
1. **Reframe the unit:** add an *agent dossier* (a batch of ~50 of one agent's booking runs) and an
   **entity verdict** (Authorise/Monitor/Refuse/Incomplete) alongside the per-payment decision.
2. **Add the "legitimacy" gap:** a **Consent** check — did the booking match what Nino actually
   requested? This is the first place an LLM earns its keep (one grounded "does-it-match" judgment);
   everything feeding it stays deterministic.
3. **Specialists as modules:** grow today's two scorers into a few of the 11 (Mandate, KYA,
   Counterparty, Injection, Drift), each returning facts + at most one LLM meaning-call.
4. **Rules fully as data:** move signal weights out of code into a rules file owned per specialist.
5. **Reporting schema:** annotate each evidence field with the failure it exists to detect — the
   lasting, standards-friendly artifact.

**Guardrail that must survive all of this:** the LLM only ever assigns *meaning* to facts the
deterministic layer already established; it never moves money and never casts the verdict.
