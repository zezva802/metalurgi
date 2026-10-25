"use client";

// S7: the audit log — every decision, persisted, filterable by outcome.

import { useEffect, useMemo, useState } from "react";
import { OutcomeBadge } from "@/components/outcome-badge";
import type { AuditEntry } from "@/lib/audit";
import { formatMoney } from "@/lib/money";
import type { Outcome } from "@/lib/supervisor/decide";

const FILTERS: (Outcome | "ALL")[] = ["ALL", "EXECUTE", "VERIFY", "ASK_HUMAN", "BLOCK"];
const time = (iso: string) => new Date(iso).toLocaleString("en-GB");

export function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState<Outcome | "ALL">("ALL");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/audit")
      .then((res) => res.json())
      .then((data: { entries: AuditEntry[] }) => {
        if (!cancelled) setEntries(data.entries);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => (filter === "ALL" ? entries : entries.filter((e) => e.outcome === filter)), [entries, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-4 py-2 text-lg font-medium ${
              filter === f ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 hover:bg-slate-100"
            }`}
          >
            {f === "ALL" ? "All" : f.replace("_", " ")}
          </button>
        ))}
        <span className="ml-auto self-center text-slate-500">{shown.length} entries</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-300">
        <table className="w-full text-left text-base">
          <thead className="bg-slate-100 text-sm uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-3">Time</th>
              <th className="p-3">Mandate</th>
              <th className="p-3">Hash</th>
              <th className="p-3">Agent</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-right">Beh.</th>
              <th className="p-3 text-right">Ctx.</th>
              <th className="p-3">Outcome</th>
              <th className="p-3">Reasons</th>
              <th className="p-3">Approver</th>
              <th className="p-3 text-right">ms</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-6 text-center text-slate-500">
                  No entries. Decisions are recorded here as they happen.
                </td>
              </tr>
            ) : (
              shown.map((e) => (
                <tr key={e.id} className="border-t border-slate-200 align-top">
                  <td className="p-3 whitespace-nowrap tabular-nums text-slate-500">{time(e.time)}</td>
                  <td className="p-3 font-mono">{e.mandate_id}</td>
                  <td className="p-3 font-mono text-slate-500" title={e.mandate_hash ?? ""}>
                    {e.mandate_hash ? e.mandate_hash.slice(0, 10) : "—"}
                  </td>
                  <td className="p-3 font-mono">{e.agent_id}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(e.amount, e.currency)}</td>
                  <td className="p-3 text-right tabular-nums">{e.behavior}</td>
                  <td className="p-3 text-right tabular-nums">{e.context}</td>
                  <td className="p-3">
                    <OutcomeBadge outcome={e.outcome} />
                  </td>
                  <td className="p-3 text-slate-600">{e.reasons.join("; ")}</td>
                  <td className="p-3">{e.approver ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums text-slate-500">{e.latency_ms.toFixed(1)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
