"use client";

import { mergeProps, useViraPassword } from "@virastack/password";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { policy } from "@/lib/policy";
import { signup } from "./actions";

type Values = { email: string; password: string; confirm: string };

export function SignupForm() {
  const form = useForm<Values>({ defaultValues: { email: "omer@example.com", password: "", confirm: "" } });
  const [result, setResult] = useState<unknown>(null);
  const password = form.watch("password");
  const pw = useViraPassword({ policy, value: password, forbidden: [form.watch("email")] });
  const confirm = useViraPassword({ matchWith: password, value: form.watch("confirm") });

  // Server-only check: the client rules are skipped so the server's answer shows.
  const submit = form.handleSubmit(async (values) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    setResult(await signup(data));
  });

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
      <label>
        email <input type="email" autoComplete="username" {...form.register("email")} />
      </label>
      <label>
        password <input {...mergeProps(pw.inputProps, form.register("password"))} />
      </label>
      <button {...pw.btnProps} aria-label="Show password" />
      <p {...pw.strengthProps} data-testid="level">
        {pw.strength?.level}
      </p>
      <p data-testid="issues">{pw.issues.join(",")}</p>
      {pw.capsLock && <p>Caps Lock is on</p>}
      <label>
        confirm <input {...mergeProps(confirm.inputProps, form.register("confirm"))} />
      </label>
      <button {...confirm.btnProps} aria-label="Show confirm" />
      <p data-testid="matches">{String(confirm.matches)}</p>
      <button type="submit">Sign up</button>
      <pre data-testid="result">{JSON.stringify(result)}</pre>
    </form>
  );
}
