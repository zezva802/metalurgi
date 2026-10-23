import type { Mandate } from "@/lib/supervisor/mandate";
import type { Proposal } from "@/lib/supervisor/proposal";

// Synthetic demo data shared by tests. Matches the examples in docs/CLAUDE.md.

export const MANDATE: Mandate = {
  mandate_id: "m_001",
  principal_id: "nino",
  agent_id: "agent_travel_01",
  category: "hotel",
  city: "Paris",
  dates: { from: "2026-09-20", to: "2026-09-23" },
  max_amount: 800,
  currency: "EUR",
  max_uses: 1,
  preferences: { refundable: true },
  expires_at: "2026-10-25T18:00:00Z",
};

export const PROPOSAL_A: Proposal = {
  proposal_id: "p_001",
  mandate_id: "m_001",
  agent_id: "agent_travel_01",
  merchant: "bookify.example",
  category: "hotel",
  city: "Paris",
  dates: { from: "2026-09-20", to: "2026-09-23" },
  amount: 540,
  currency: "EUR",
  refundable: true,
  options_compared: 6,
  created_at: "2026-09-01T10:00:00Z",
};

export const BEFORE_EXPIRY = new Date("2026-09-01T10:00:00Z");
