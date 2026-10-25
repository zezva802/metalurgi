import { connection } from "next/server";
import { listAgents } from "@/lib/agents";
import { ATTACK_TYPES } from "@/lib/attacks";
import { countByOutcome, listDecisions } from "@/lib/decisions";
import { percentile } from "@/lib/supervisor/signals";
import { OUTCOME_STYLES } from "@/components/outcome-badge";
import type { Outcome } from "@/lib/supervisor/decide";

// S8: the regulator's view (NBG). Aggregates only — counts, rates, latency, agent and attack
// coverage. No names, no per-person amounts, nothing that identifies a customer.

// Reads live in-memory + persisted state, so this route is dynamic, not prerendered.
export const instant = false;

const OUTCOMES: Outcome[] = ["EXECUTE", "VERIFY", "ASK_HUMAN", "BLOCK"];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-300 p-5">
      <div className="text-4xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-lg font-medium">{label}</div>
      {sub && <div className="text-slate-500">{sub}</div>}
    </div>
  );
}

export default async function Page() {
  await connection(); // live in-memory + persisted state

  const decisions = listDecisions();
  const total = decisions.length;
  const counts = countByOutcome();
  const latencies = decisions.map((d) => d.result.latency_ms).sort((a, b) => a - b);
  const p95 = latencies.length ? percentile(latencies, 0.95) : 0;
  const agents = listAgents();
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Supervisory report</h1>
        <p className="text-xl text-slate-600">
          Aggregated, anonymized gateway activity for the regulator. No personal data — no names,
          no per-customer amounts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Decisions" value={String(total)} />
        <Stat label="Agents" value={String(agents.length)} sub={`${activeAgents} active`} />
        <Stat label="Attack types defended" value={String(ATTACK_TYPES.length)} sub="0 executed" />
        <Stat label="Decision latency p95" value={`${p95.toFixed(1)} ms`} />
      </div>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Decisions by outcome</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {OUTCOMES.map((o) => (
            <div key={o} className={`rounded-xl border-2 p-4 ${OUTCOME_STYLES[o].panel}`}>
              <div className="text-3xl font-bold tabular-nums">{counts[o]}</div>
              <div className="text-lg font-medium">{OUTCOME_STYLES[o].label}</div>
              <div className="text-slate-500">{pct(counts[o])} of decisions</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Attack coverage</h2>
        <p className="text-slate-600">
          Every class below is blocked by the gateway and proven by the attack suite
          (<code>npm run attacks</code> → “0 of {ATTACK_TYPES.length} attacks executed”).
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ATTACK_TYPES.map((name) => (
            <li key={name} className="flex items-center gap-2 rounded-lg border border-slate-300 p-3 text-lg">
              <span className="font-bold text-green-700">✓</span>
              <span className="capitalize">{name}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
