import { createMask, isValidTCKN, toMinorUnits } from "@virastack/mask/server";
import { CheckoutForm } from "./checkout-form";

// Server Component: the server entry formats without "use client".
const rows = [
  ["phone TR", createMask({ preset: "phone", country: "TR" }).format("5551234567")],
  ["iban TR", createMask({ preset: "iban", country: "TR" }).format("TR330006100519786457841326")],
  ["currency USD", createMask({ currency: "USD" }).format("1234.5")],
  ["date", createMask("date").format("2026-02-01")],
  ["tckn valid", String(isValidTCKN("10000000146"))],
  ["minor units", String(toMinorUnits("1234.56", "TRY"))],
];

export default function Page() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <table data-testid="server-table">
        <tbody>
          {rows.map(([name, value]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <CheckoutForm />
    </main>
  );
}
