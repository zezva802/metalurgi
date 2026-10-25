import { loadPrivateKey } from "../keys";
import { signCanonical } from "../supervisor/mandate";
import type { Proposal } from "../supervisor/proposal";

// In this demo the agents run on the bank's server and hold their own Ed25519 keys (data/keys/).
// This signs a proposal as the named agent — exactly what the agent does before sending it to the
// gateway. The gateway then verifies the signature against the agent registry (lib/agents.ts).
export function signProposalAs(agent_id: string, proposal: Proposal): string {
  return signCanonical(proposal, loadPrivateKey(agent_id));
}
