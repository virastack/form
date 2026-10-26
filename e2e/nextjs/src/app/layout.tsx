import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "@virastack/password e2e" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
