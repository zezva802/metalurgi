import { AuditView } from "./audit-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Audit log</h1>
        <p className="text-xl text-slate-600">Every decision, persisted — mandate hash, scores, reasons, approver and latency.</p>
      </div>
      <AuditView />
    </div>
  );
}
