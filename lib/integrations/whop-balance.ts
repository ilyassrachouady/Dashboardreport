import { z } from "zod";
import type { Dataset } from "../model";

const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/);
export function adaptWhopBalance(
  raw: unknown,
  account: string,
): NonNullable<Dataset["whopBalance"]> {
  const b = z
    .object({
      id: z.string(),
      total_usd: decimal.nullable(),
      balances: z.array(
        z.object({
          symbol: z.string(),
          balance: decimal,
          value_usd: decimal.nullable(),
          breakdown: z.object({
            available: decimal,
            pending: decimal,
            reserve: decimal,
          }),
        }),
      ),
    })
    .parse(raw);
  if (b.id !== account) throw new Error("Whop balance account mismatch");
  if (b.total_usd === null)
    throw new Error(
      "Whop balance unavailable. Check company:balance:read permission.",
    );
  return {
    totalUsd: b.total_usd,
    fetchedAt: new Date().toISOString(),
    currencies: b.balances.map((v) => ({
      currency: v.symbol,
      balance: v.balance,
      valueUsd: v.value_usd,
      available: v.breakdown.available,
      pending: v.breakdown.pending,
      reserve: v.breakdown.reserve,
    })),
  };
}
export async function fetchWhopBalance() {
  const account = process.env.WHOP_COMPANY_ID,
    key = process.env.WHOP_API_KEY;
  if (!account || !key)
    throw new Error("Whop balance credentials are not configured");
  const host =
    process.env.WHOP_SANDBOX === "true"
      ? "https://sandbox-api.whop.com"
      : "https://api.whop.com";
  const r = await fetch(
    `${host}/api/v1/accounts/${encodeURIComponent(account)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok)
    throw new Error(
      r.status === 403
        ? "Whop balance requires company:balance:read permission"
        : `Whop balance unavailable (${r.status})`,
    );
  return adaptWhopBalance(await r.json(), account);
}
