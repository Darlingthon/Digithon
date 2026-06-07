import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "TrustLine — Vera",
  description: "An AI employee that runs KYC end-to-end.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
