import { MANDATE_TEMPLATE } from "@/lib/mandates";
import { MandateForm } from "./mandate-form";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Bank app</h1>
        <p className="text-xl text-slate-600">Nino gives her travel agent a narrow, signed permission.</p>
      </div>
      <MandateForm template={MANDATE_TEMPLATE} />
    </div>
  );
}
