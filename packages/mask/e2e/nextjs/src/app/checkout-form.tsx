"use client";

import { maskResolver, useViraMask } from "@virastack/mask";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { checkoutMasks, checkoutSchema, type CheckoutInput } from "@/lib/masks";
import { submitFormData, submitValues } from "./actions";

const messages: Record<string, string> = {
  required: "Zorunlu alan",
  "phone.incomplete": "Telefon eksik",
  "tckn.invalid": "Geçersiz T.C. Kimlik No",
  "card.invalid": "Geçersiz kart numarası",
  "date.minAge": "18 yaşından büyük olmalısınız",
  "date.beforeFrom": "Bitiş başlangıçtan önce olamaz",
  "expiry.min": "Kartın süresi dolmuş",
};

const empty: CheckoutInput = {
  phone: "", intl: "", tckn: "", vkn: "", iban: "", ibanAny: "", card: "", cvv: "", expiry: "",
  currency: "TRY", price: "", qty: "", birth: "", start: "", end: "", address: { zip: "" }, plate: "",
};

export function CheckoutForm() {
  const form = useForm<CheckoutInput>({
    defaultValues: { ...empty, phone: "5551234567", price: "1234.5" },
    resolver: maskResolver(checkoutMasks, checkoutSchema),
  });
  const [result, setResult] = useState<string>("");
  const [completed, setCompleted] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const { cvv, card, ...rest } = useViraMask(form, {
    ...checkoutMasks,
    card: { preset: "card", onComplete: (value) => setCompleted(value) },
  });
  const errors = form.formState.errors;
  const err = (name: string) => {
    const e = name === "zip" ? errors.address?.zip : errors[name as keyof typeof errors];
    const message = e && "message" in e ? String(e.message ?? "") : "";
    return message ? <small data-testid={`${name}-error`}>{messages[message] ?? message}</small> : null;
  };

  return (
    <form ref={formRef} onSubmit={form.handleSubmit(async (values) => setResult(JSON.stringify(await submitValues(values))))}>
      {Object.entries(rest).map(([key, props]) => (
        <label key={key}>
          {key}
          <input aria-label={key} {...props} />
          {err(key)}
        </label>
      ))}
      <label>
        card
        <input aria-label="card" {...card} />
        {err("card")}
      </label>
      <label>
        cvv
        <input aria-label="cvv" {...cvv} />
        {err("cvv")}
      </label>
      <label>
        currency
        <select aria-label="currency" {...form.register("currency")}>
          <option>TRY</option>
          <option>USD</option>
          <option>EUR</option>
        </select>
      </label>
      <p>
        <button type="submit">Submit</button>
        <button type="button" onClick={() => form.reset()}>Reset</button>
        <button type="button" onClick={() => form.reset({ ...empty, phone: "5321112233", tckn: "10000000146", birth: "1990-05-12" })}>
          Reset with values
        </button>
        <button type="button" onClick={() => form.setValue("iban", "TR330006100519786457841326")}>Set IBAN</button>
        <button
          type="button"
          onClick={async () => setResult(JSON.stringify(await submitFormData(new FormData(formRef.current!))))}
        >
          Submit FormData
        </button>
      </p>
      <output data-testid="watch">{JSON.stringify(form.watch())}</output>
      <output data-testid="completed">{completed}</output>
      <pre data-testid="result">{result}</pre>
    </form>
  );
}
