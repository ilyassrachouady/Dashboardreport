import "@fontsource-variable/inter";
import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Creator Society | Revenue Intelligence",
  description:
    "One reporting layer for acquisition, attribution and collected revenue.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
