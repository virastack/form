"use server";

import { validatePassword } from "@virastack/password/server";
import { policy } from "@/lib/policy";

export async function signup(formData: FormData) {
  const result = validatePassword(formData.get("password"), policy, {
    forbidden: [formData.get("email")],
    confirm: formData.get("confirm"),
  });
  // Hash result.password (NFKC) here; never send it back.
  return { valid: result.valid, issues: result.issues, level: result.level };
}
