"use client";

// A8 (stretch): fire a 200-payment batch (20 deliberately bad) through the gateway and show the
// counts per outcome. Every decision also shows up on the Console and in the Audit log.

import { useState } from "react";
import { OUTCOME_STYLES } from "@/components/outcome-badge";
import type { BatchSummary } from "@/lib/batch";
import type { Outcome } from "@/lib/supervisor/decide";

const OUTCOMES: Outcome[] = ["EXECUTE", "VERIFY", "ASK_HUMAN", "BLOCK"];
type State = { kind: "idle" } | { kind: "running" } | { kind: "done"; summary: BatchSummary };

export function BatchRun() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/agent/batch", { method: "POST" });
      setState({ kind: "done", summary: await res.json() });
    } catch {
      setState({ kind: "idle" });
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Batch run</h2>
        <p className="text-slate-600">200 synthetic payments, 20 of them bad — watch the Console counters move.</p>
      </div>
      <button
        onClick={run}
        disabled={state.kind === "running"}
        className="rounded-lg bg-slate-900 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {state.kind === "running" ? "Running 200 payments…" : "Run 200-payment batch"}
      </button>

      {state.kind === "done" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {OUTCOMES.map((o) => (
            <div key={o} className={`rounded-xl border-2 p-4 ${OUTCOME_STYLES[o].panel}`}>
              <div className="text-3xl font-bold tabular-nums">{state.summary.counts[o]}</div>
              <div className="text-lg font-medium">{OUTCOME_STYLES[o].label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
