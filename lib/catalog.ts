import { z } from "zod";
import hotelsJson from "@/data/hotels.json";
import merchantsJson from "@/data/merchants.json";

// Synthetic hotel offers the agent can search (A4) and the merchant registry the gateway trusts (E9).

export const OfferSchema = z.object({
  offer_id: z.string(),
  hotel_id: z.string(), // the same hotel can be sold by several platforms
  hotel_name: z.string(),
  merchant: z.string(),
  city: z.string(),
  dates: z.object({ from: z.string(), to: z.string() }),
  nights: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  refundable: z.boolean(),
});

export const MerchantSchema = z.object({
  domain: z.string(),
  known: z.boolean(), // in the bank's registry of vetted platforms
  age_days: z.number().int().nonnegative(), // domain age
});

export type Offer = z.infer<typeof OfferSchema>;
export type Merchant = z.infer<typeof MerchantSchema>;

export const OFFERS: Offer[] = z.array(OfferSchema).parse(hotelsJson);
export const MERCHANTS: Merchant[] = z.array(MerchantSchema).parse(merchantsJson);

export function findMerchant(domain: string): Merchant | undefined {
  return MERCHANTS.find((m) => m.domain === domain);
}

// Median price of the same hotel on the other platforms; undefined if nobody else sells it.
export function marketMedian(offer: Pick<Offer, "hotel_id" | "merchant">, offers: Offer[] = OFFERS): number | undefined {
  const prices = offers
    .filter((o) => o.hotel_id === offer.hotel_id && o.merchant !== offer.merchant)
    .map((o) => o.amount)
    .sort((a, b) => a - b);
  if (prices.length === 0) return undefined;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
}
