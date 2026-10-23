import { TestPaymentForm } from "./test-payment-form";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Agent</h1>
        <p className="text-xl text-slate-600">The AI travel agent that books on Nino&apos;s behalf. Live agent comes in A4.</p>
      </div>
      <TestPaymentForm />
    </div>
  );
}
