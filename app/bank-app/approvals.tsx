"use client";

// S6: Nino's approval queue. VERIFY/ASK_HUMAN decisions wait here until she approves (the payment
// then executes and the approver is logged) or rejects it.

import { useEffect, useState } from "react";
import { OutcomeBadge } from "@/components/outcome-badge";
import { formatMoney } from "@/lib/money";
import type { DecisionRecord } from "@/lib/decisions";

const APPROVER = "Nino";
const isPending = (d: DecisionRecord) => !d.resolution && (d.result.decision.outcome === "VERIFY" || d.result.decision.outcome === "ASK_HUMAN");

export function Approvals() {
  const [pending, setPending] = useState<DecisionRecord[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/decisions");
    const data: { decisions: DecisionRecord[] } = await res.json();
    setPending(data.decisions.filter(isPending));
  }

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const res = await fetch("/api/decisions");
      const data: { decisions: DecisionRecord[] } = await res.json();
      if (!cancelled) setPending(data.decisions.filter(isPending));
    };
    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  async function resolve(id: number, action: "approve" | "reject") {
    setBusy(id);
    try {
      await fetch(`/api/decisions/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, approver: APPROVER }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">Waiting for your approval</h2>
      {pending.length === 0 ? (
        <p className="text-slate-500">Nothing waiting. Payments that need a human land here.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((d) => {
            const p = d.proposal;
            return (
              <li key={d.id} className="space-y-2 rounded-lg border border-slate-300 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <OutcomeBadge outcome={d.result.decision.outcome} />
                  <span className="text-lg font-semibold">
                    {p.merchant} · {formatMoney(p.amount, p.currency)}
                  </span>
                </div>
                <ul className="list-disc pl-6 text-base text-slate-600">
                  {d.result.decision.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <button
                    onClick={() => resolve(d.id, "approve")}
                    disabled={busy === d.id}
                    className="rounded-lg bg-green-600 px-5 py-2 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => resolve(d.id, "reject")}
                    disabled={busy === d.id}
                    className="rounded-lg border-2 border-red-600 px-5 py-2 text-lg font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
