"use client";

// A4: the live LLM agent. Pick a mandate, give it a request, and watch the tool-call run log and the
// gateway's decision. Needs ANTHROPIC_API_KEY on the server; without it, it tells you to use the
// scripted agent above.

import { useEffect, useState } from "react";
import { OutcomeBadge } from "@/components/outcome-badge";
import type { AgentRun } from "@/lib/agent/llm";
import type { StoredMandate } from "@/lib/store";

type State = { kind: "idle" } | { kind: "running" } | { kind: "done"; run: AgentRun } | { kind: "error"; message: string };

export function LiveAgent() {
  const [mandates, setMandates] = useState<StoredMandate[]>([]);
  const [mandateId, setMandateId] = useState("");
  const [request, setRequest] = useState("Book Nino's Paris hotel for 20–23 September.");
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mandates")
      .then((res) => res.json())
      .then((data: { mandates: StoredMandate[] }) => {
        if (cancelled) return;
        setMandates(data.mandates);
        setMandateId(data.mandates[0]?.mandate.mandate_id ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run() {
    if (!mandateId) {
      setState({ kind: "error", message: "Sign a mandate in the Bank app first." });
      return;
    }
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/agent/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, mandate_id: mandateId }),
      });
      const data = await res.json();
      setState(res.ok ? { kind: "done", run: data } : { kind: "error", message: (data.errors ?? ["Request failed"])[0] });
    } catch {
      setState({ kind: "error", message: "Could not reach the agent." });
    }
  }

  const field = "w-full rounded-lg border border-slate-300 bg-white p-3 text-lg";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Live LLM agent</h2>
        <p className="text-slate-600">Plans with search / compare / propose tools, then submits to the gateway.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input value={request} onChange={(e) => setRequest(e.target.value)} className={field} />
        <select value={mandateId} onChange={(e) => setMandateId(e.target.value)} className={field}>
          {mandates.length === 0 && <option value="">No mandates yet</option>}
          {mandates.map(({ mandate: m }) => (
            <option key={m.mandate_id} value={m.mandate_id}>
              {m.mandate_id} · {m.category} in {m.city}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={run}
        disabled={state.kind === "running"}
        className="rounded-lg bg-slate-900 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {state.kind === "running" ? "Agent is working…" : "Run live agent"}
      </button>

      {state.kind === "error" && (
        <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-lg text-amber-900">{state.message}</div>
      )}

      {state.kind === "done" && (
        <div className="space-y-3">
          <ol className="space-y-2">
            {state.run.log.map((call, i) => (
              <li key={i} className="rounded-lg border border-slate-300 p-3">
                <div className="font-mono text-base font-semibold">{call.tool}</div>
                <pre className="mt-1 overflow-x-auto text-sm text-slate-600">{JSON.stringify(call.input)}</pre>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-3 text-lg">
            {state.run.result ? <OutcomeBadge outcome={state.run.result.decision.outcome} large /> : null}
            <span>{state.run.message}</span>
          </div>
        </div>
      )}
    </section>
  );
}
