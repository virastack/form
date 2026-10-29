import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { getTurkishBank, isValidIBAN, turkishBanks, useViraMask } from "../src";
import * as server from "../src/server";

/** A valid Turkish IBAN for a bank code, with the check digits worked out. */
function ibanFor(code: string, account = "0000000000123456"): string {
  const bban = `0${code}0${account}`;
  // "TR" is 29 27; mod-97 over BBAN + "TR00", then 98 − remainder.
  let remainder = 0;
  for (const digit of `${bban}292700`) remainder = (remainder * 10 + Number(digit)) % 97;
  return `TR${String(98 - remainder).padStart(2, "0")}${bban}`;
}

describe("turkishBanks", () => {
  it("lists the 70 TCMB participants, once each, sorted by code", () => {
    expect(turkishBanks).toHaveLength(70);
    const codes = turkishBanks.map((bank) => bank.code);
    expect(new Set(codes).size).toBe(70);
    expect(codes).toEqual([...codes].sort());
    for (const code of codes) expect(code).toMatch(/^\d{4}$/);
  });

  it("has the well-known banks under their TCMB codes", () => {
    const name = (code: string) => turkishBanks.find((bank) => bank.code === code)?.name;
    expect(name("0010")).toBe("T.C. ZİRAAT BANKASI A.Ş.");
    expect(name("0012")).toBe("T. HALK BANKASI A.Ş.");
    expect(name("0015")).toBe("T. VAKIFLAR BANKASI T.A.O.");
    expect(name("0046")).toBe("AKBANK T.A.Ş.");
    expect(name("0062")).toBe("T. GARANTİ BANKASI A.Ş.");
    expect(name("0064")).toBe("T. İŞ BANKASI A.Ş.");
    expect(name("0067")).toBe("YAPI VE KREDİ BANKASI A.Ş.");
    expect(name("0111")).toBe("QNB FİNANSBANK A.Ş.");
    expect(name("0205")).toBe("KUVEYT TÜRK KATILIM BANKASI A.Ş.");
  });

  it("carries the 2026 changes: new members, renames, and the bank that left", () => {
    const name = (code: string) => turkishBanks.find((bank) => bank.code === code)?.name;
    expect(name("0215")).toBe("ADİL KATILIM BANKASI A.Ş.");
    expect(name("0216")).toBe("İKTİSAT KATILIM BANKASI A.Ş.");
    expect(name("0137")).toBe("HEPSİ BANK A.Ş.");
    expect(name("0096")).toBe("FREEDOM BANK A.Ş.");
    expect(name("0150")).toBeUndefined();
  });
});

describe("getTurkishBank", () => {
  it("finds every participant from a valid IBAN", () => {
    for (const bank of turkishBanks) {
      const iban = ibanFor(bank.code);
      expect(isValidIBAN(iban)).toBe(true);
      expect(getTurkishBank(iban)).toEqual(bank);
    }
  });

  it("accepts spaces and lowercase, as typed or as the mask shows it", () => {
    const iban = ibanFor("0062");
    const spaced = iban.replace(/(.{4})/g, "$1 ").trim();
    expect(getTurkishBank(spaced)?.code).toBe("0062");
    expect(getTurkishBank(iban.toLowerCase())?.code).toBe("0062");
  });

  it("answers as soon as the bank digits are typed", () => {
    expect(getTurkishBank("TR33 0006 2")?.code).toBe("0062");
    expect(getTurkishBank("TR33 0006")).toBeNull();
    expect(getTurkishBank("TR")).toBeNull();
    expect(getTurkishBank("")).toBeNull();
  });

  it("returns null for other countries, unknown codes and a non-zero lead digit", () => {
    expect(getTurkishBank("DE89 3704 0044 0532 0130 00")).toBeNull();
    expect(getTurkishBank(ibanFor("0150"))).toBeNull();
    expect(getTurkishBank(ibanFor("0999"))).toBeNull();
    expect(getTurkishBank("TR33 1006 2000 0000 0000 0000 00")).toBeNull();
    expect(getTurkishBank("XTR33 0006 2")).toBeNull();
  });

  it("does not judge the IBAN itself", () => {
    const wrongCheck = `TR00${ibanFor("0062").slice(4)}`;
    expect(isValidIBAN(wrongCheck)).toBe(false);
    expect(getTurkishBank(wrongCheck)?.code).toBe("0062");
  });

  it("is on the server entry too", () => {
    expect(server.getTurkishBank).toBe(getTurkishBank);
    expect(server.turkishBanks).toBe(turkishBanks);
  });
});

describe("with the TR IBAN preset", () => {
  function IbanField() {
    const form = useForm<{ iban: string }>({ defaultValues: { iban: "" } });
    const { iban } = useViraMask(form, { iban: { preset: "iban", country: "TR" } });
    const bank = getTurkishBank(form.watch("iban"));
    return (
      <>
        <input aria-label="IBAN" {...iban} />
        <p data-testid="bank">{bank?.name ?? ""}</p>
      </>
    );
  }

  it("shows the bank while the user types, from the raw value", async () => {
    render(<IbanField />);
    const input = screen.getByLabelText("IBAN") as HTMLInputElement;
    await userEvent.type(input, "330006");
    expect(screen.getByTestId("bank").textContent).toBe("");
    await userEvent.type(input, "2");
    expect(input.value).toBe("TR33 0006 2");
    expect(screen.getByTestId("bank").textContent).toBe("T. GARANTİ BANKASI A.Ş.");
    await userEvent.clear(input);
    expect(screen.getByTestId("bank").textContent).toBe("");
  });
});
