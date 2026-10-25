import { ConsoleView } from "./console-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Risk Officer Console</h1>
        <p className="text-xl text-slate-600">Every agent payment and the gateway&apos;s decision, newest first.</p>
      </div>
      <ConsoleView />
    </div>
  );
}
