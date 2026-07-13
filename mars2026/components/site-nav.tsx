"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";

const links = [
  { href: "/commissions", label: "Commissions" },
  { href: "/shop", label: "Shop" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/commissions") return pathname === "/commissions";
  if (href === "/shop") {
    return pathname.startsWith("/shop") || pathname.startsWith("/posters");
  }
  if (href === "/about") return pathname.startsWith("/about");
  return pathname.startsWith("/archive") || pathname.startsWith("/gallery");
}

export function SiteNav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const { itemCount, isHydrated } = useCart();
  const isCartActive = pathname.startsWith("/cart");

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

      <div className="site-nav-actions">
        <ThemeSwitcher />
        <Link
          href="/cart"
          className={isCartActive ? "is-active" : undefined}
          aria-current={isCartActive ? "page" : undefined}
        >
          Cart{isHydrated && itemCount ? ` (${itemCount})` : ""}
        </Link>
        {userEmail ? (
          <div className="site-user">
            <Link
              className="site-user-email"
              href="/account/orders"
              title={userEmail}
            >
              {userEmail}
            </Link>
            <LogoutButton className="site-nav-logout" />
          </div>
        ) : (
          <div className="site-auth-links" aria-label="Account">
            <Link href="/auth/login">Log in</Link>
            <Link href="/auth/sign-up">Sign up</Link>
          </div>
        )}
      </div>
    </header>
  );
}
