"use client";

import { useState } from "react";
import type { StoredMandate } from "@/lib/store";

const DEFAULT_REQUEST = "Book me a refundable hotel in Paris for 20–23 September, up to €800.";

type Status =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "signed"; entry: StoredMandate }
  | { kind: "error"; errors: string[] };

export function MandateForm({ template }: { template: object }) {
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [json, setJson] = useState(() => JSON.stringify(template, null, 2));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [drafting, setDrafting] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);

  // A5: turn the plain-language request into mandate JSON (falls back to the template).
  async function draftWithAi() {
    setDrafting(true);
    setDraftNote(null);
    try {
      const res = await fetch("/api/mandates/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      const data: { draft: object; source: "llm" | "template"; note?: string } = await res.json();
      setJson(JSON.stringify(data.draft, null, 2));
      setStatus({ kind: "idle" });
      setDraftNote(data.note ?? (data.source === "llm" ? "Drafted with AI — review before signing." : null));
    } catch {
      setDraftNote("Could not reach the drafting service.");
    } finally {
      setDrafting(false);
    }
  }

  async function sign() {
    let draft: unknown;
    try {
      draft = JSON.parse(json);
    } catch (error) {
      setStatus({ kind: "error", errors: [`Mandate is not valid JSON: ${(error as Error).message}`] });
      return;
    }

    setStatus({ kind: "signing" });
    try {
      const res = await fetch("/api/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      setStatus(res.ok ? { kind: "signed", entry: data } : { kind: "error", errors: data.errors ?? ["Signing failed"] });
    } catch {
      setStatus({ kind: "error", errors: ["Could not reach the bank. Is the server running?"] });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <label htmlFor="request" className="block text-xl font-semibold">
          What should the agent do?
        </label>
        <textarea
          id="request"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 bg-white p-4 text-lg"
        />
        <button
          onClick={draftWithAi}
          disabled={drafting}
          className="rounded-lg border border-slate-400 px-5 py-2 text-lg font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          {drafting ? "Drafting…" : "Draft with AI"}
        </button>
        {draftNote && <p className="text-slate-500">{draftNote}</p>}
      </section>

      <section className="space-y-3">
        <label htmlFor="mandate" className="block text-xl font-semibold">
          Mandate you are signing
        </label>
        <textarea
          id="mandate"
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            if (status.kind !== "signing") setStatus({ kind: "idle" });
          }}
          rows={16}
          spellCheck={false}
          className="w-full rounded-lg border border-slate-300 bg-white p-4 font-mono text-base"
        />
        <div className="flex items-center gap-4">
          <button
            onClick={sign}
            disabled={status.kind === "signing"}
            className="rounded-lg bg-slate-900 px-6 py-3 text-lg font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {status.kind === "signing" ? "Signing…" : "Sign mandate"}
          </button>
          <span className="text-slate-500">Signed with Nino&apos;s key (Ed25519)</span>
        </div>

        {status.kind === "signed" && (
          <div className="rounded-lg border-2 border-green-600 bg-green-50 p-4 text-lg">
            <p className="text-2xl font-bold text-green-700">Signed</p>
            <p>
              Mandate <span className="font-mono font-semibold">{status.entry.mandate.mandate_id}</span>
            </p>
            <p>
              Signature{" "}
              <span className="font-mono" title={status.entry.signature}>
                {status.entry.signature.slice(0, 16)}…
              </span>
            </p>
          </div>
        )}

        {status.kind === "error" && (
          <div className="rounded-lg border-2 border-red-600 bg-red-50 p-4 text-lg text-red-800">
            <p className="font-bold">Not signed</p>
            <ul className="list-disc pl-6">
              {status.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
