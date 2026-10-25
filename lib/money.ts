// Crypto-free money formatting, safe to import from client components (unlike mandate.ts, which
// pulls in node:crypto). EUR 540 -> "€540".

const SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", GEL: "₾" };

export function formatMoney(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency];
  const value = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return symbol ? `${symbol}${value}` : `${value} ${currency}`;
}
