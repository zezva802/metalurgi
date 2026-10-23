import { z } from "zod";

// A mandate is the narrow permission a customer signs for an agent.
// Everything except `preferences` is a hard rule checked before any payment.
// `preferences` are soft and only feed behavior scoring.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const MandateSchema = z.object({
  mandate_id: z.string().min(1),
  principal_id: z.string().min(1),
  agent_id: z.string().min(1),
  category: z.string().min(1),
  city: z.string().min(1),
  dates: z.object({ from: isoDate, to: isoDate }),
  max_amount: z.number().positive(),
  currency: z.string().length(3),
  max_uses: z.number().int().positive(),
  preferences: z.object({ refundable: z.boolean().optional() }).default({}),
  expires_at: z.iso.datetime(),
});

export type Mandate = z.infer<typeof MandateSchema>;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

// Rebuilds the value with object keys sorted at every level. Arrays keep their order.
function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const sorted: { [key: string]: Json } = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys(value[key]);
    }
    return sorted;
  }
  return value;
}

// The exact string that gets signed and hashed: keys sorted recursively, then JSON.stringify.
// Two mandates with the same content always produce the same string, whatever their key order.
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value as Json));
}
