"use client";

// S4: the Risk Officer Console — the bank fraud analyst's main screen. Every agent payment and its
// decision, newest first, refreshing every 2s. Click a row for the full breakdown (S5).

import { useEffect, useState } from "react";
import { OutcomeBadge, OUTCOME_STYLES } from "@/components/outcome-badge";
import { formatMoney } from "@/lib/money";
import type { DecisionRecord, OutcomeCounts } from "@/lib/decisions";
import type { Outcome } from "@/lib/supervisor/decide";
import { DecisionDetail } from "./decision-detail";

const EMPTY_COUNTS: OutcomeCounts = { EXECUTE: 0, VERIFY: 0, ASK_HUMAN: 0, BLOCK: 0 };

const COUNTERS: { outcome: Outcome; label: string }[] = [
  { outcome: "EXECUTE", label: "Executed" },
  { outcome: "VERIFY", label: "Verify" },
  { outcome: "ASK_HUMAN", label: "Asked" },
  { outcome: "BLOCK", label: "Blocked" },
];

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB");

export function ConsoleView() {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [counts, setCounts] = useState<OutcomeCounts>(EMPTY_COUNTS);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/decisions");
        const data: { decisions: DecisionRecord[]; counts: OutcomeCounts } = await res.json();
        if (!cancelled) {
          setDecisions(data.decisions);
          setCounts(data.counts);
        }
      } catch {
        // transient; the next tick retries
      }
    }
    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const selected = decisions.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {COUNTERS.map(({ outcome, label }) => (
          <div key={outcome} className={`rounded-xl border-2 p-4 ${OUTCOME_STYLES[outcome].panel}`}>
            <div className="text-4xl font-bold tabular-nums">{counts[outcome]}</div>
            <div className="text-lg font-medium text-slate-600">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-x-auto rounded-xl border border-slate-300">
          <table className="w-full text-left text-lg">
            <thead className="bg-slate-100 text-base uppercase tracking-wide text-slate-600">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Agent</th>
                <th className="p-3">Merchant</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {decisions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No payments yet. Send one from the Agent page.
                  </td>
                </tr>
              ) : (
                decisions.map((d) => {
                  const p = d.proposal;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className={`cursor-pointer border-t border-slate-200 hover:bg-slate-50 ${
                        d.id === selectedId ? "bg-slate-100" : ""
                      }`}
                    >
                      <td className="p-3 tabular-nums text-slate-500">{time(d.decided_at)}</td>
                      <td className="p-3 font-mono text-base">{p.agent_id}</td>
                      <td className="p-3">{p.merchant}</td>
                      <td className="p-3 text-right tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                      <td className="p-3">
                        <OutcomeBadge outcome={d.result.decision.outcome} />
                      </td>
                      <td className="p-3 text-base text-slate-600">
                        {d.resolution ? (
                          <span className={d.resolution.status === "approved" ? "font-semibold text-green-700" : "font-semibold text-red-700"}>
                            {d.resolution.status === "approved" ? "✓" : "✗"} {d.resolution.status} by {d.resolution.by}
                          </span>
                        ) : (
                          d.result.decision.reasons[0]
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div>
          {selected ? (
            <DecisionDetail record={selected} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-lg text-slate-500">
              Select a payment to see the mandate, behavior and context breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
