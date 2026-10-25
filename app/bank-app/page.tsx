import { MANDATE_TEMPLATE } from "@/lib/mandates";
import { MandateForm } from "./mandate-form";
import { MandateList } from "./mandate-list";

export default function Page() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Bank app</h1>
        <p className="text-xl text-slate-600">Nino gives her travel agent a narrow, signed permission.</p>
      </div>
      <MandateForm template={MANDATE_TEMPLATE} />
      <MandateList />
    </div>
  );
}
