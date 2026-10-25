"use client";

// Entity-level agent review (docs/VISION.md): pick an agent, run the 11 specialists over its dossier,
// and get a recommended verdict a human signs off. Determinism establishes the facts; the model only
// colours each specialist's "meaning".

import { useEffect, useState } from "react";
import type { EntityReview, EntityVerdict } from "@/lib/review/types";

const VERDICT: Record<EntityVerdict, { badge: string; panel: string; label: string }> = {
  AUTHORISE: { badge: "bg-green-600 text-white", panel: "border-green-600 bg-green-50", label: "Authorise" },
  MONITOR: { badge: "bg-amber-500 text-white", panel: "border-amber-500 bg-amber-50", label: "Monitor" },
  REFUSE: { badge: "bg-red-600 text-white", panel: "border-red-600 bg-red-50", label: "Refuse" },
  INCOMPLETE: { badge: "bg-slate-500 text-white", panel: "border-slate-400 bg-slate-100", label: "Incomplete submission" },
};
const FINDING: Record<string, string> = { pass: "text-green-700", concern: "text-amber-600", fail: "text-red-700" };

type State = { kind: "idle" } | { kind: "running" } | { kind: "done"; review: EntityReview };

export function SupervisorView() {
  const [agents, setAgents] = useState<string[]>([]);
  const [agentId, setAgentId] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [officer, setOfficer] = useState("Risk Officer");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/review")
      .then((r) => r.json())
      .then((d: { agents: string[] }) => {
        if (cancelled) return;
        setAgents(d.agents);
        setAgentId(d.agents[0] ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(signoff?: string) {
    setState({ kind: "running" });
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, ...(signoff ? { signed_off_by: signoff } : {}) }),
    });
    setState({ kind: "done", review: await res.json() });
  }

  const field = "rounded-lg border border-slate-300 bg-white p-3 text-lg";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-lg font-medium">Agent under review</span>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={field}>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => run()}
          disabled={state.kind === "running" || !agentId}
          className="rounded-lg bg-slate-900 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {state.kind === "running" ? "Reviewing 50 runs…" : "Review agent"}
        </button>
      </div>

      {state.kind === "done" && <Report review={state.review} officer={officer} setOfficer={setOfficer} onSignOff={() => run(officer)} />}
    </div>
  );
}

function Report({ review, officer, setOfficer, onSignOff }: { review: EntityReview; officer: string; setOfficer: (s: string) => void; onSignOff: () => void }) {
  const v = VERDICT[review.verdict];
  return (
    <div className="space-y-5">
      <div className={`rounded-xl border-2 p-5 ${v.panel}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Recommended verdict · {review.agent_id} · {review.operator}</div>
            <span className={`mt-1 inline-block rounded-md px-4 py-2 text-2xl font-bold uppercase ${v.badge}`}>{v.label}</span>
          </div>
          <div className="text-right text-lg">
            <div className="text-3xl font-bold tabular-nums">{review.runs_clean}/{review.runs_total}</div>
            <div className="text-slate-600">runs clean</div>
          </div>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-lg">
          {review.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {review.signed_off_by ? (
            <span className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white">✓ Signed off by {review.signed_off_by}</span>
          ) : (
            <>
              <input value={officer} onChange={(e) => setOfficer(e.target.value)} className="rounded-lg border border-slate-300 bg-white p-2 text-lg" />
              <button onClick={onSignOff} className="rounded-lg border-2 border-slate-900 px-5 py-2 text-lg font-semibold hover:bg-slate-100">
                Sign off
              </button>
              <span className="text-slate-500">A human signs the verdict — the system only recommends.</span>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {review.findings.map((f) => (
          <div key={f.name} className="rounded-xl border border-slate-300 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xl font-semibold">{f.name}</h3>
              <span className={`font-bold uppercase ${FINDING[f.verdict]}`}>{f.verdict}{f.hard_gate ? " · hard gate" : ""}</span>
            </div>
            <ul className="mt-2 space-y-1 text-base">
              {f.facts.map((fact) => (
                <li key={fact.rule_id} className={fact.ok ? "text-slate-600" : "font-medium text-red-700"}>
                  {fact.ok ? "✓" : "✗"} <span className="font-mono text-sm">{fact.rule_id}</span> — {fact.detail}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-base">
              <span className="text-slate-500">Meaning ({f.meaning.source}):</span> <span className="font-medium">{f.meaning.judgment}</span> — {f.meaning.rationale}
            </p>
          </div>
        ))}
      </div>

      <details className="rounded-xl border border-slate-300 p-4">
        <summary className="cursor-pointer text-xl font-semibold">Reporting schema (machine-readable)</summary>
        <p className="mt-2 text-slate-600">Every rule, annotated with the failure it detects and whether it passed for this agent.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead className="text-sm uppercase tracking-wide text-slate-500">
              <tr><th className="p-2">Rule</th><th className="p-2">Specialist</th><th className="p-2">Detects</th><th className="p-2">Severity</th><th className="p-2">Result</th></tr>
            </thead>
            <tbody>
              {review.schema.map((s) => (
                <tr key={s.rule_id} className="border-t border-slate-200">
                  <td className="p-2 font-mono text-sm">{s.rule_id}</td>
                  <td className="p-2">{s.specialist}</td>
                  <td className="p-2 text-slate-600">{s.label}</td>
                  <td className="p-2">{s.severity}</td>
                  <td className={`p-2 font-semibold ${s.passed ? "text-green-700" : "text-red-700"}`}>{s.passed ? "pass" : "fail"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
