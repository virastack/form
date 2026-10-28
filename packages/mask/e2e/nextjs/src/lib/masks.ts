import type { MaskSchema } from "@virastack/mask/server";
import { z } from "zod";

// Shared by the client hook, maskResolver and the Server Action.
export const checkoutMasks = {
  phone: { preset: "phone", country: "TR", rules: { required: "required" } },
  intl: "phone",
  tckn: "tckn",
  vkn: "vkn",
  iban: { preset: "iban", country: "TR" },
  ibanAny: "iban",
  card: "card",
  cvv: { preset: "cvv", from: "card" },
  expiry: "expiry",
  price: { preset: "currency", from: "currency" },
  qty: { preset: "number", number: { min: 1, max: 99 } },
  birth: { preset: "date", date: { max: "today", minAge: 18 } },
  start: "date",
  end: { preset: "date", from: "start" },
  zip: { name: "address.zip", mask: "99999" },
  plate: { mask: "99 a[aa] 99[99]", transform: "uppercase" },
} as const satisfies MaskSchema;

export const checkoutSchema = z.object({
  phone: z.string().min(1, "required"),
  intl: z.string(),
  tckn: z.string(),
  vkn: z.string(),
  iban: z.string(),
  ibanAny: z.string(),
  card: z.string(),
  cvv: z.string(),
  expiry: z.string(),
  currency: z.enum(["TRY", "USD", "EUR"]),
  price: z.string(),
  qty: z.string(),
  birth: z.string(),
  start: z.string(),
  end: z.string(),
  address: z.object({ zip: z.string() }),
  plate: z.string(),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
