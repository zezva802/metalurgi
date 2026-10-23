"use client";

// Temporary (S3): send a hand-made payment through the gateway. Replaced by the scripted agent in A6.

import { useEffect, useState } from "react";
import { OUTCOME_STYLES, OutcomeBadge } from "@/components/outcome-badge";
import type { GatewayResult } from "@/lib/gateway";
import type { StoredMandate } from "@/lib/store";
import type { Proposal } from "@/lib/supervisor/proposal";

type Result = { kind: "none" } | { kind: "sending" } | { kind: "done"; result: GatewayResult } | { kind: "error"; errors: string[] };

export function TestPaymentForm() {
  const [mandates, setMandates] = useState<StoredMandate[]>([]);
  const [mandateId, setMandateId] = useState("");
  const [merchant, setMerchant] = useState("bookify.example");
  const [amount, setAmount] = useState("950");
  const [result, setResult] = useState<Result>({ kind: "none" });

  async function loadMandates() {
    const res = await fetch("/api/mandates");
    const data: { mandates: StoredMandate[] } = await res.json();
    setMandates(data.mandates);
    setMandateId((current) => current || data.mandates[0]?.mandate.mandate_id || "");
  }

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

  async function send() {
    const stored = mandates.find((m) => m.mandate.mandate_id === mandateId);
    if (!stored) {
      setResult({ kind: "error", errors: ["Sign a mandate in the Bank app first"] });
      return;
    }
    const m = stored.mandate;
    // Everything except merchant and amount follows the mandate, so only those two can break a rule.
    const proposal: Proposal = {
      proposal_id: `p_${Date.now()}`,
      mandate_id: m.mandate_id,
      agent_id: m.agent_id,
      merchant,
      category: m.category,
      city: m.city,
      dates: m.dates,
      amount: Number(amount),
      currency: m.currency,
      refundable: true,
      options_compared: 6,
      created_at: new Date().toISOString(),
    };

    setResult({ kind: "sending" });
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });
      const data = await res.json();
      setResult(res.ok ? { kind: "done", result: data } : { kind: "error", errors: data.errors ?? ["Request failed"] });
    } catch {
      setResult({ kind: "error", errors: ["Could not reach the gateway. Is the server running?"] });
    }
  }

  const field = "w-full rounded-lg border border-slate-300 bg-white p-3 text-lg";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-lg border border-dashed border-slate-400 p-6">
        <h2 className="text-2xl font-semibold">Test payment <span className="text-base font-normal text-slate-500">(temporary)</span></h2>

        <label className="block space-y-1">
          <span className="text-lg font-medium">Mandate</span>
          <div className="flex gap-2">
            <select value={mandateId} onChange={(e) => setMandateId(e.target.value)} className={field}>
              {mandates.length === 0 && <option value="">No mandates yet</option>}
              {mandates.map(({ mandate: m }) => (
                <option key={m.mandate_id} value={m.mandate_id}>
                  {m.mandate_id} · {m.category} in {m.city} · max {m.max_amount} {m.currency}
                </option>
              ))}
            </select>
            <button onClick={loadMandates} className="rounded-lg border border-slate-300 px-4 text-lg hover:bg-slate-100">
              Refresh
            </button>
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-lg font-medium">Merchant</span>
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} className={field} />
        </label>

        <label className="block space-y-1">
          <span className="text-lg font-medium">Amount</span>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
        </label>

        <button
          onClick={send}
          disabled={result.kind === "sending"}
          className="rounded-lg bg-slate-900 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {result.kind === "sending" ? "Sending…" : "Send payment"}
        </button>
      </section>

      <section>
        {result.kind === "done" && (
          <div className={`space-y-3 rounded-lg border-2 p-6 ${OUTCOME_STYLES[result.result.decision.outcome].panel}`}>
            <OutcomeBadge outcome={result.result.decision.outcome} large />
            <ul className="list-disc space-y-1 pl-6 text-xl">
              {result.result.decision.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="font-mono text-slate-500">{result.result.proposal_id}</p>
          </div>
        )}
        {result.kind === "error" && (
          <div className="rounded-lg border-2 border-red-600 bg-red-50 p-6 text-lg text-red-800">
            <ul className="list-disc pl-6">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
