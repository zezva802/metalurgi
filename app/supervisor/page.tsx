import { SupervisorView } from "./supervisor-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Agent Supervisor</h1>
        <p className="text-xl text-slate-600">
          Entity-level review: should this agent be allowed to operate? Eleven specialists judge a dossier
          of ~50 runs — deterministic facts, one bounded AI &ldquo;meaning&rdquo; call each — then a human signs off.
        </p>
      </div>
      <SupervisorView />
    </div>
  );
}
