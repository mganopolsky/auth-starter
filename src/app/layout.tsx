import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Auth Starter",
  description: "Next.js + Supabase + Google sign-in template",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main style={{ maxWidth: 480, margin: "10vh auto", padding: "0 16px" }}>{children}</main>
      </body>
    </html>
  );
}
