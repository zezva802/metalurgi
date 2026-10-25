"use client";

// E6: shows the mandates Nino has signed and lets her revoke one. A revoked mandate can no longer
// move money — the gateway turns any payment under it into a hard BLOCK (scenario F).

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { StoredMandate } from "@/lib/store";

type MandateRow = StoredMandate & { revoked: boolean };

export function MandateList() {
  const [mandates, setMandates] = useState<MandateRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/mandates");
    const data: { mandates: MandateRow[] } = await res.json();
    setMandates(data.mandates);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mandates")
      .then((res) => res.json())
      .then((data: { mandates: MandateRow[] }) => {
        if (!cancelled) setMandates(data.mandates);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function revoke(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/mandates/${id}/revoke`, { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Signed mandates</h2>
        <button onClick={load} className="rounded-lg border border-slate-300 px-4 py-2 text-lg hover:bg-slate-100">
          Refresh
        </button>
      </div>

      {mandates.length === 0 ? (
        <p className="text-slate-500">No mandates yet. Sign one above.</p>
      ) : (
        <ul className="space-y-2">
          {mandates.map(({ mandate: m, revoked }) => (
            <li
              key={m.mandate_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white p-4 text-lg"
            >
              <div>
                <span className="font-mono font-semibold">{m.mandate_id}</span>{" "}
                <span className="text-slate-600">
                  {m.category} in {m.city} · max {formatMoney(m.max_amount, m.currency)} · agent {m.agent_id}
                </span>
              </div>
              {revoked ? (
                <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">Revoked</span>
              ) : (
                <button
                  onClick={() => revoke(m.mandate_id)}
                  disabled={busy === m.mandate_id}
                  className="rounded-lg border-2 border-red-600 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {busy === m.mandate_id ? "Revoking…" : "Revoke"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
