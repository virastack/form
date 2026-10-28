import { validatePassword } from "@virastack/password/server";
import { evaluate } from "@virastack/password/strength";
import { policy } from "@/lib/policy";
import { SignupForm } from "./signup-form";

// Server Component: the server and strength entries run without "use client".
const rows = [
  ["short", validatePassword("short", policy).issues.join(",")],
  ["common", evaluate("passwordpassword", policy).issues.join(",")],
  ["blocked", evaluate("my-acme-account-pw", policy).issues.join(",")],
  ["strong", evaluate("vu7#Kq2!mz9@Lw4X", policy).level],
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
      <SignupForm />
    </main>
  );
}
