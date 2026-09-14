import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aktyvių veiklų registracija",
  description: "Organizuok veiklas arba rezervuok savo vietą.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lt">
      <body>{children}</body>
    </html>
  );
}
