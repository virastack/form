"use server";

import { parseMasked } from "@virastack/mask/server";
import { checkoutMasks, checkoutSchema } from "@/lib/masks";

export async function submitValues(values: unknown) {
  return parseMasked(checkoutMasks, values as Record<string, unknown>, checkoutSchema);
}

export async function submitFormData(formData: FormData) {
  return parseMasked(checkoutMasks, formData, checkoutSchema);
}
