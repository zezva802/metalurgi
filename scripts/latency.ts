// E12: run 200 decisions through the gateway and print the latency distribution (p50/p95/max).
// Run: npm run latency
import { resetBank } from "../lib/bank";
import { resetDecisions } from "../lib/decisions";
import { evaluatePayment } from "../lib/gateway";
import { loadPrivateKey } from "../lib/keys";
import { resetStore, saveMandate } from "../lib/store";
import { signCanonical, type Mandate } from "../lib/supervisor/mandate";
import { percentile } from "../lib/supervisor/signals";
import type { Proposal } from "../lib/supervisor/proposal";

const N = 200;

resetStore();
resetBank();
resetDecisions();

// A generous mandate so every one of the 200 proposals is a real EXECUTE decision.
const mandate: Mandate = {
  mandate_id: "m_bench",
  principal_id: "nino",
  agent_id: "agent_travel_01",
  category: "hotel",
  city: "Paris",
  dates: { from: "2026-09-20", to: "2026-09-23" },
  max_amount: 10_000_000,
  currency: "EUR",
  max_uses: N + 10,
  preferences: { refundable: true },
  expires_at: "2026-12-31T23:59:00Z",
};
saveMandate({ mandate, signature: signCanonical(mandate, loadPrivateKey("nino")), signed_at: new Date().toISOString() });

const agentKey = loadPrivateKey("agent_travel_01");
const makeProposal = (i: number): Proposal => ({
  proposal_id: `bench_${i}`,
  mandate_id: "m_bench",
  agent_id: "agent_travel_01",
  merchant: "bookify.example",
  category: "hotel",
  city: "Paris",
  dates: { from: "2026-09-20", to: "2026-09-23" },
  amount: 540,
  currency: "EUR",
  refundable: true,
  options_compared: 6,
  created_at: new Date().toISOString(),
});

// Warm up the JIT, then measure.
for (let i = 0; i < 20; i++) {
  const p = makeProposal(-i - 1);
  evaluatePayment(p, signCanonical(p, agentKey));
}

const latencies: number[] = [];
for (let i = 0; i < N; i++) {
  const p = makeProposal(i);
  latencies.push(evaluatePayment(p, signCanonical(p, agentKey)).latency_ms);
}
latencies.sort((a, b) => a - b);

const ms = (n: number) => `${n.toFixed(2)} ms`;
console.log(`decisions: ${N}`);
console.log(`p50:  ${ms(percentile(latencies, 0.5))}`);
console.log(`p95:  ${ms(percentile(latencies, 0.95))}`);
console.log(`p99:  ${ms(percentile(latencies, 0.99))}`);
console.log(`max:  ${ms(latencies[latencies.length - 1])}`);
