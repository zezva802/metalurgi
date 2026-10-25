import { checkAgent, type AgentCheck } from "./agents";
import { authorizePayment, executePayment, getTransactions, type Payment } from "./bank";
import { loadPublicKey } from "./keys";
import { getMandate, getUsage, isRevoked, recordExecution } from "./store";
import { scoreBehavior } from "./supervisor/behavior";
import { scoreContext } from "./supervisor/context";
import { decide, type Decision } from "./supervisor/decide";
import { checkMandate, type MandateCheck } from "./supervisor/mandate";
import type { Proposal } from "./supervisor/proposal";
import type { Score } from "./supervisor/signals";

// The gateway: every payment proposal passes through here before anything can move money.
// E5 agent verification · E6 revocation · E7 execution + usage update (same pass as the check) ·
// E8–E10 behavior/context scoring.

export type GatewayResult = {
  proposal_id: string;
  mandate_id: string;
  decision: Decision;
  agent_check: AgentCheck;
  mandate_check: MandateCheck;
  behavior: Score;
  context: Score;
  payment?: Payment; // present only when the decision was EXECUTE and the bank moved money
};

export function evaluatePayment(proposal: Proposal, signature: string, now = new Date()): GatewayResult {
  const agentCheck = checkAgent(proposal, signature);

  const stored = getMandate(proposal.mandate_id);
  const mandateCheck: MandateCheck = stored
    ? checkMandate(stored.mandate, stored.signature, proposal, {
        principalPublicKey: loadPublicKey(stored.mandate.principal_id),
        ...getUsage(proposal.mandate_id),
        revoked: isRevoked(proposal.mandate_id),
        now,
      })
    : { pass: false, failures: [{ rule: "mandate_id", message: `No mandate ${proposal.mandate_id} on file` }] };

  // Scores run against Nino's history (AIS) and the wider catalog. They only tighten the decision.
  // Velocity (recent agent payments) is wired in a later task; 0 for now.
  const behavior = scoreBehavior(proposal, getTransactions());
  const context = scoreContext(proposal, { recentAgentPayments: 0 });

  const decision = decide({ mandate: mandateCheck, agent: agentCheck, behavior, context });

  // Only an EXECUTE decision moves money, and only then do uses/spent change. VERIFY/ASK_HUMAN wait
  // for a human approval (S6); BLOCK does nothing.
  let payment: Payment | undefined;
  if (decision.outcome === "EXECUTE") {
    authorizePayment({
      proposal_id: proposal.proposal_id,
      mandate_id: proposal.mandate_id,
      merchant: proposal.merchant,
      amount: proposal.amount,
      currency: proposal.currency,
      authorized_by: "gateway",
    });
    const result = executePayment(proposal.proposal_id, now);
    if (result.ok) {
      recordExecution(proposal.mandate_id, proposal.amount);
      payment = result.payment;
    }
  }

  return {
    proposal_id: proposal.proposal_id,
    mandate_id: proposal.mandate_id,
    decision,
    agent_check: agentCheck,
    mandate_check: mandateCheck,
    behavior,
    context,
    payment,
  };
}
