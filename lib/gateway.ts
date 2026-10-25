import { checkAgent, type AgentCheck } from "./agents";
import { loadPublicKey } from "./keys";
import { getMandate, getUsage } from "./store";
import { decide, type Decision } from "./supervisor/decide";
import { checkMandate, type MandateCheck } from "./supervisor/mandate";
import type { Proposal } from "./supervisor/proposal";

// The gateway: every payment proposal passes through here before anything can move money.
// E5 adds agent verification (registered + active + valid signature). E7 adds execution + usage
// update, E8–E10 behavior/context scoring.

export type GatewayResult = {
  proposal_id: string;
  mandate_id: string;
  decision: Decision;
  agent_check: AgentCheck;
  mandate_check: MandateCheck;
};

export function evaluatePayment(proposal: Proposal, signature: string, now = new Date()): GatewayResult {
  const agentCheck = checkAgent(proposal, signature);

  const stored = getMandate(proposal.mandate_id);
  const mandateCheck: MandateCheck = stored
    ? checkMandate(stored.mandate, stored.signature, proposal, {
        principalPublicKey: loadPublicKey(stored.mandate.principal_id),
        ...getUsage(proposal.mandate_id),
        now,
      })
    : { pass: false, failures: [{ rule: "mandate_id", message: `No mandate ${proposal.mandate_id} on file` }] };

  return {
    proposal_id: proposal.proposal_id,
    mandate_id: proposal.mandate_id,
    decision: decide({ mandate: mandateCheck, agent: agentCheck }),
    agent_check: agentCheck,
    mandate_check: mandateCheck,
  };
}
