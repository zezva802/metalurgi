"use client";

// A4 + A7: the live LLM agent. Pick a mandate, give it a request, and watch its tool calls stream in
// one by one (A7), then the gateway's decision. Needs ANTHROPIC_API_KEY on the server; without it
// the stream's first (and only) event tells you to use the scripted agent above.

import { useEffect, useState } from "react";
import { OutcomeBadge } from "@/components/outcome-badge";
import type { ToolCall } from "@/lib/agent/llm";
import type { GatewayResult } from "@/lib/gateway";
import type { StoredMandate } from "@/lib/store";

type Phase = "idle" | "running" | "done" | "error";
type State = { phase: Phase; log: ToolCall[]; result?: GatewayResult | null; message?: string };

export function LiveAgent() {
  const [mandates, setMandates] = useState<StoredMandate[]>([]);
  const [mandateId, setMandateId] = useState("");
  const [request, setRequest] = useState("Book Nino's Paris hotel for 20–23 September.");
  const [state, setState] = useState<State>({ phase: "idle", log: [] });

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
      setState({ phase: "error", log: [], message: "Sign a mandate in the Bank app first." });
      return;
    }
    setState({ phase: "running", log: [] });
    try {
      const res = await fetch("/api/agent/llm/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, mandate_id: mandateId }),
      });
      if (!res.body) throw new Error("no stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line) as
            | { type: "tool"; call: ToolCall }
            | { type: "done"; result: GatewayResult | null; message: string }
            | { type: "error"; message: string };
          if (evt.type === "tool") {
            setState((s) => ({ ...s, log: [...s.log, evt.call] }));
          } else if (evt.type === "done") {
            setState((s) => ({ ...s, phase: "done", result: evt.result, message: evt.message }));
          } else {
            setState((s) => ({ ...s, phase: "error", message: evt.message }));
          }
        }
      }
    } catch {
      setState((s) => ({ ...s, phase: "error", message: "Could not reach the agent." }));
    }
  }

  const field = "w-full rounded-lg border border-slate-300 bg-white p-3 text-lg";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Live LLM agent</h2>
        <p className="text-slate-600">Plans with search / compare / propose tools — calls stream in live — then submits to the gateway.</p>
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
        disabled={state.phase === "running"}
        className="rounded-lg bg-slate-900 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {state.phase === "running" ? "Agent is working…" : "Run live agent"}
      </button>

      {state.log.length > 0 && (
        <ol className="space-y-2">
          {state.log.map((call, i) => (
            <li key={i} className="rounded-lg border border-slate-300 p-3">
              <div className="font-mono text-base font-semibold">{call.tool}</div>
              <pre className="mt-1 overflow-x-auto text-sm text-slate-600">{JSON.stringify(call.input)}</pre>
            </li>
          ))}
        </ol>
      )}

      {state.phase === "error" && (
        <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-lg text-amber-900">{state.message}</div>
      )}

      {state.phase === "done" && (
        <div className="flex items-center gap-3 text-lg">
          {state.result ? <OutcomeBadge outcome={state.result.decision.outcome} large /> : null}
          <span>{state.message}</span>
        </div>
      )}
    </section>
  );
}
