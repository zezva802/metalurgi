import type { Outcome } from "@/lib/supervisor/decide";

// One colour per outcome, used everywhere: EXECUTE green, VERIFY amber, ASK_HUMAN blue, BLOCK red.
export const OUTCOME_STYLES: Record<Outcome, { badge: string; panel: string; label: string }> = {
  EXECUTE: { badge: "bg-green-600 text-white", panel: "border-green-600 bg-green-50", label: "Execute" },
  VERIFY: { badge: "bg-amber-500 text-white", panel: "border-amber-500 bg-amber-50", label: "Verify" },
  ASK_HUMAN: { badge: "bg-blue-600 text-white", panel: "border-blue-600 bg-blue-50", label: "Ask human" },
  BLOCK: { badge: "bg-red-600 text-white", panel: "border-red-600 bg-red-50", label: "Block" },
};

export function OutcomeBadge({ outcome, large = false }: { outcome: Outcome; large?: boolean }) {
  return (
    <span
      className={`inline-block rounded-md font-bold uppercase tracking-wide ${OUTCOME_STYLES[outcome].badge} ${
        large ? "px-4 py-2 text-2xl" : "px-2 py-1 text-sm"
      }`}
    >
      {outcome.replace("_", " ")}
    </span>
  );
}
