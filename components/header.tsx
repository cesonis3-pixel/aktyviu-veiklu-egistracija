"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "./logout-button";
import { Icon } from "./icon";

export function Header({
  email,
  signedIn,
}: {
  email?: string;
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/activities", label: "Veiklos" },
    { href: "/my-reservations", label: "Mano rezervacijos" },
    ...(signedIn ? [{ href: "/my-activities", label: "Mano veiklos" }] : []),
    ...(signedIn ? [{ href: "/messages", label: "Žinutės" }] : []),
  ];
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <Icon name="mountain" />
          Baltic Winter
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-label={open ? "Uždaryti meniu" : "Atidaryti meniu"}
          aria-expanded={open}
          aria-controls="site-navigation"
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
        <div
          id="site-navigation"
          className={`header-navigation ${open ? "is-open" : ""}`}
        >
          <nav className="primary-nav" aria-label="Pagrindinė navigacija">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname.startsWith(href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-account">
            {signedIn ? (
              <>
                <span className="account-email" title={email}>
                  {email}
                </span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)}>
                  Prisijungti
                </Link>
                <Link
                  href="/register"
                  className="button button-ice"
                  onClick={() => setOpen(false)}
                >
                  Registruotis
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
