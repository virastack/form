import { validatePassword } from "@virastack/password/server";
import { evaluate } from "@virastack/password/strength";
import { policy } from "@/lib/policy";
import { SignupForm } from "./signup-form";

// Server Component: the server and strength entries run without "use client".
const rows = [
  ["short", validatePassword("short", policy).issues.join(",")],
  ["common", evaluate("passwordpassword", policy).issues.join(",")],
  // 1.2: the blocklist is compared with the whole password after removing digits and symbols.
  ["blocked", evaluate("ACME2024!acme2024!", policy).issues.join(",")],
  // 1.2: the level grows with length only; 10 characters over the minimum (15) is strong.
  ["strong", evaluate("vu7#Kq2!mz9@Lw4X-bt5Rn8Jy", policy).level],
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
