"use client";

// S9: tune the decision thresholds live (in memory). Lowering "Behavior → Ask human" far enough
// makes even a normal payment ask for approval — a quick way to show the policy is doing the work.

import { useEffect, useState } from "react";
import type { Policy } from "@/lib/supervisor/policy";

const SLIDERS: { key: keyof Policy; label: string; help: string }[] = [
  { key: "behaviorAsk", label: "Behavior → Ask human", help: "Behavior score at or above this asks a human." },
  { key: "contextVerify", label: "Context → Verify", help: "Context score at or above this needs verification." },
  { key: "contextBlock", label: "Context → Block", help: "Context score at or above this is blocked outright." },
];

export function PolicySliders() {
  const [policy, setPolicyState] = useState<Policy | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/policy")
      .then((res) => res.json())
      .then((data: Policy) => {
        if (!cancelled) setPolicyState(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function commit(patch: Partial<Policy> | { reset: true }) {
    const res = await fetch("/api/policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setPolicyState(await res.json());
  }

  if (!policy) return null;

  return (
    <details className="rounded-xl border border-slate-300 p-4">
      <summary className="cursor-pointer text-xl font-semibold">Policy thresholds</summary>
      <div className="mt-4 space-y-5">
        {SLIDERS.map(({ key, label, help }) => (
          <label key={key} className="block">
            <div className="flex justify-between text-lg font-medium">
              <span>{label}</span>
              <span className="tabular-nums">{policy[key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={policy[key]}
              onChange={(e) => {
                const value = Number(e.target.value);
                setPolicyState((p) => (p ? { ...p, [key]: value } : p));
                void commit({ [key]: value });
              }}
              className="w-full"
            />
            <p className="text-sm text-slate-500">{help}</p>
          </label>
        ))}
        <button onClick={() => commit({ reset: true })} className="rounded-lg border border-slate-300 px-4 py-2 text-lg hover:bg-slate-100">
          Reset to defaults
        </button>
      </div>
    </details>
  );
}
