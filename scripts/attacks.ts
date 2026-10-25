// E11: run every known attack through the gateway and print how many executed (must be 0).
// Run: npm run attacks
import { runAttacks } from "../lib/attacks";

const results = runAttacks();
for (const r of results) {
  const tag = r.executed ? "EXECUTED" : "blocked ";
  console.log(`  ${tag}  ${r.name.padEnd(30)} → ${r.outcome}`);
}

const executed = results.filter((r) => r.executed).length;
console.log(`\n${executed} of ${results.length} attacks executed`);
process.exit(executed === 0 ? 0 : 1);
