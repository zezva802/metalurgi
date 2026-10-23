import { z } from "zod";

// Nino's synthetic payment history (data/transactions.json, written by `npm run seed`).
// Behavior scoring (E8) builds her "normal" from this.

export const TransactionSchema = z.object({
  id: z.string(),
  date: z.string(), // YYYY-MM-DD
  hour: z.number().int().min(0).max(23),
  amount: z.number().positive(),
  currency: z.string().length(3),
  merchant: z.string(),
  category: z.enum(["groceries", "transport", "cafe", "hotel"]),
  refundable: z.boolean().nullable(), // hotels only
  nights: z.number().int().positive().nullable(), // hotels only
});

export type Transaction = z.infer<typeof TransactionSchema>;
