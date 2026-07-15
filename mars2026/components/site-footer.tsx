import Link from "next/link";

const footerLinks = [
  { href: "/archive", label: "Archive" },
  { href: "/commissions", label: "Commissions" },
  { href: "/contact", label: "Contact" },
  { href: "/about", label: "About" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-intro">
        <Link className="site-footer-brand" href="/" aria-label="MARS home">
          MARS
        </Link>
        <span>Posters, commissions, and visual work.</span>
      </div>

      <nav className="site-footer-links" aria-label="Footer navigation">
        {footerLinks.map((link) => (
          <Link href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>

      <span className="site-footer-copyright">© MARS</span>
    </footer>
  );
}
