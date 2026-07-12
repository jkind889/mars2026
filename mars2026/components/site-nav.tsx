"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/archive", label: "Archive" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/shop") {
    return pathname.startsWith("/shop") || pathname.startsWith("/posters");
  }
  return pathname.startsWith("/archive") || pathname.startsWith("/gallery");
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="site-nav">
      <Link className="site-brand" href="/" aria-label="MARS home">
        MARS
      </Link>

      <nav className="site-links" aria-label="Main navigation">
        {links.map((link) => {
          const active = isActivePath(pathname, link.href);

          return (
            <Link
              href={link.href}
              key={link.href}
              className={active ? "is-active" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <span className="site-status">Available now</span>
    </header>
  );
}
