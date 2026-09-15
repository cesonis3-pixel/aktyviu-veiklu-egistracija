import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const COPYRIGHT_YEAR = "2026";

export const metadata: Metadata = {
  title: {
    default: "Baltic Winter – žiemos nuotykiai",
    template: "%s | Baltic Winter",
  },
  description: "Slidinėjimas, žygiai ir kitos veiklos vienoje vietoje.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <html lang="lt">
      <body>
        <a className="skip-link" href="#main-content">
          Pereiti prie turinio
        </a>
        <Header signedIn={Boolean(user)} email={user?.email} />
        {children}
        <footer className="site-footer">
          <div className="container footer-inner">
            <Link href="/" className="brand">
              <Icon name="mountain" />
              Baltic Winter
            </Link>
            <p>Žiemos nuotykiai prasideda čia.</p>
            <span>© {COPYRIGHT_YEAR} Baltic Winter</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
