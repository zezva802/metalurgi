"use client";

// S5: the breakdown behind one decision — four cards: hard rules (agent + mandate), behavior bars,
// context bars, and the final decision with its plain-language reasons.

import { OutcomeBadge, OUTCOME_STYLES } from "@/components/outcome-badge";
import { formatMoney } from "@/lib/money";
import type { DecisionRecord } from "@/lib/decisions";
import type { Score } from "@/lib/supervisor/signals";

// Widest single signal weight is 35 (new merchant); scale bars against that so the biggest fills.
const BAR_MAX = 35;

function ScoreCard({ title, score, tone }: { title: string; score: Score; tone: "behavior" | "context" }) {
  const barColor = tone === "context" ? "bg-amber-500" : "bg-blue-600";
  return (
    <div className="rounded-xl border border-slate-300 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-semibold">{title}</h3>
        <span className="text-2xl font-bold tabular-nums">{score.total}</span>
      </div>
      {score.signals.length === 0 ? (
        <p className="mt-2 text-slate-500">Nothing unusual.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {score.signals.map((s) => (
            <li key={s.name}>
              <div className="flex justify-between text-base font-medium">
                <span>{s.name}</span>
                <span className="tabular-nums text-slate-500">{s.points}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, (s.points / BAR_MAX) * 100)}%` }} />
              </div>
              <p className="mt-1 text-sm text-slate-600">{s.explanation}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DecisionDetail({ record }: { record: DecisionRecord }) {
  const { proposal, result } = record;
  const { agent_check, mandate_check, behavior, context, decision } = result;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-300 p-4">
        <h3 className="text-xl font-semibold">Hard rules</h3>
        <p className="mt-1 text-base text-slate-600">
          {proposal.merchant} · {formatMoney(proposal.amount, proposal.currency)} · mandate {proposal.mandate_id}
        </p>
        <ul className="mt-3 space-y-2 text-lg">
          <li className={agent_check.pass ? "text-green-700" : "text-red-700"}>
            {agent_check.pass ? "✓ Agent verified" : "✗ Agent not verified"}
          </li>
          {!agent_check.pass && agent_check.failures.map((f) => <li key={f.rule} className="pl-5 text-base text-red-700">{f.message}</li>)}
          <li className={mandate_check.pass ? "text-green-700" : "text-red-700"}>
            {mandate_check.pass ? "✓ All mandate rules passed" : "✗ Mandate rules failed"}
          </li>
          {!mandate_check.pass && mandate_check.failures.map((f) => <li key={f.rule} className="pl-5 text-base text-red-700">{f.message}</li>)}
        </ul>
      </div>

      <ScoreCard title="Behavior" score={behavior} tone="behavior" />
      <ScoreCard title="Context" score={context} tone="context" />

      <div className={`rounded-xl border-2 p-4 ${OUTCOME_STYLES[decision.outcome].panel}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Decision</h3>
          <OutcomeBadge outcome={decision.outcome} large />
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-lg">
          {decision.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
