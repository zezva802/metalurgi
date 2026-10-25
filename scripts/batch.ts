// A8: run a 200-payment batch (20 bad) through the gateway and print counts per outcome.
// Run: npm run batch
import { resetBank } from "../lib/bank";
import { resetDecisions } from "../lib/decisions";
import { runBatch } from "../lib/batch";
import { resetStore } from "../lib/store";

resetStore();
resetBank();
resetDecisions();

const { total, bad, counts } = runBatch();
console.log(`batch: ${total} proposals (${bad} deliberately bad)\n`);
for (const outcome of ["EXECUTE", "VERIFY", "ASK_HUMAN", "BLOCK"] as const) {
  console.log(`  ${outcome.padEnd(10)} ${counts[outcome]}`);
}
