import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPublicKey } from "./keys";
import { verifyCanonical } from "./supervisor/mandate";
import type { Proposal } from "./supervisor/proposal";

// The bank's registry of agents it will accept payment proposals from. An agent must be registered
// and active, and the proposal must carry a valid signature from that agent's key (data/keys/).
// Anything else is BLOCK — behavior/context scoring never gets a say (scenario H).

export type AgentStatus = "active" | "suspended";
export type Agent = { agent_id: string; operator: string; status: AgentStatus };

export type AgentRule = "registered" | "status" | "signature";
export type AgentFailure = { rule: AgentRule; message: string };
export type AgentCheck = { pass: boolean; failures: AgentFailure[] };

let cache: Agent[] | null = null;

function registry(): Agent[] {
  return (cache ??= JSON.parse(readFileSync(join(process.cwd(), "data", "agents.json"), "utf8")) as Agent[]);
}

export function listAgents(): Agent[] {
  return registry();
}

export function getAgent(agent_id: string): Agent | undefined {
  return registry().find((a) => a.agent_id === agent_id);
}

// The agent signs canonicalize(proposal) with its own key; the detached signature travels alongside
// the proposal (proposals are ephemeral, so nothing is stored). The registry says which agent to trust.
export function checkAgent(proposal: Proposal, signature: string): AgentCheck {
  const agent = getAgent(proposal.agent_id);
  if (!agent) {
    return { pass: false, failures: [{ rule: "registered", message: `Agent ${proposal.agent_id} is not in the bank's registry` }] };
  }

  const failures: AgentFailure[] = [];
  if (agent.status !== "active") {
    failures.push({ rule: "status", message: `Agent ${proposal.agent_id} is ${agent.status}, not active` });
  }

  let publicKey;
  try {
    publicKey = loadPublicKey(proposal.agent_id);
  } catch {
    failures.push({ rule: "signature", message: `No public key on file for agent ${proposal.agent_id}` });
    return { pass: false, failures };
  }
  if (!verifyCanonical(proposal, signature, publicKey)) {
    failures.push({ rule: "signature", message: `Proposal signature is invalid: not signed by agent ${proposal.agent_id}` });
  }

  return { pass: failures.length === 0, failures };
}
