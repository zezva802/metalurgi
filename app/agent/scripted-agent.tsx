"use client";

// A6: scripted agent. Each button replays one demo scenario (A–H) through the gateway and shows the
// outcome next to what we expect. Watch the Console tab — every run lands there within 2 seconds.

import { useState } from "react";
import { OutcomeBadge } from "@/components/outcome-badge";
import type { ScenarioRun } from "@/lib/agent/scripted";

type ScenarioId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

const SCENARIOS: { id: ScenarioId; title: string; expected: string }[] = [
  { id: "A", title: "€540 refundable, known platform, 6 options", expected: "EXECUTE" },
  { id: "B", title: "€760 non-refundable, known platform", expected: "ASK_HUMAN" },
  { id: "C", title: "€610, unknown site 4 days old, 45% below market, 1 option", expected: "VERIFY" },
  { id: "D", title: "€950, over the €800 limit", expected: "BLOCK" },
  { id: "E", title: "Mandate edited to €2,000 after signing", expected: "BLOCK" },
  { id: "F", title: "Payment after the mandate is revoked", expected: "BLOCK" },
  { id: "G", title: "Two €475 payments on a single-use mandate", expected: "EXECUTE then BLOCK" },
  { id: "H", title: "Unknown agent", expected: "BLOCK" },
];

type State = Record<string, ScenarioRun | "running" | undefined>;

export function ScriptedAgent() {
  const [state, setState] = useState<State>({});

  async function run(id: ScenarioId) {
    setState((s) => ({ ...s, [id]: "running" }));
    try {
      const res = await fetch("/api/agent/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: id }),
      });
      const data: ScenarioRun = await res.json();
      setState((s) => ({ ...s, [id]: data }));
    } catch {
      setState((s) => ({ ...s, [id]: undefined }));
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Scripted agent</h2>
        <p className="text-slate-600">Replays each demo scenario through the gateway. Watch the Console tab.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SCENARIOS.map(({ id, title, expected }) => {
          const result = state[id];
          const done = result && result !== "running" ? result : null;
          const actual = done ? done.outcomes.map((o) => o.decision.outcome).join(" then ") : null;
          const match = actual === expected;
          return (
            <div key={id} className="flex flex-col gap-2 rounded-lg border border-slate-300 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xl font-bold">Scenario {id}</span>
                  <p className="text-base text-slate-600">{title}</p>
                </div>
                <button
                  onClick={() => run(id)}
                  disabled={result === "running"}
                  className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {result === "running" ? "Running…" : "Run"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-base">
                <span className="text-slate-500">Expected {expected}</span>
                {done && (
                  <>
                    <span className="text-slate-400">→</span>
                    {done.outcomes.map((o, i) => (
                      <OutcomeBadge key={i} outcome={o.decision.outcome} />
                    ))}
                    <span className={match ? "font-bold text-green-700" : "font-bold text-red-700"}>{match ? "✓" : "✗"}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
