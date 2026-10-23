import { z } from "zod";
import { isoDate } from "./mandate";

// A payment proposal is what an agent sends to the gateway. It is signed with the agent's own key.

export const ProposalSchema = z.object({
  proposal_id: z.string().min(1),
  mandate_id: z.string().min(1),
  agent_id: z.string().min(1),
  merchant: z.string().min(1),
  category: z.string().min(1),
  city: z.string().min(1),
  dates: z.object({ from: isoDate, to: isoDate }),
  amount: z.number().positive(),
  currency: z.string().length(3),
  refundable: z.boolean(),
  options_compared: z.number().int().nonnegative(),
  created_at: z.iso.datetime(),
});

export type Proposal = z.infer<typeof ProposalSchema>;
