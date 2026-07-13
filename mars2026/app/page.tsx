import Link from "next/link";

const homeLinks = [
  { href: "/gallery", label: "Gallery" },
  { href: "/commissions", label: "Commissions" },
  { href: "/contact", label: "Contact" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
];

export default function Home() {
  return (
    <main className="home-page">
      <div className="home-content">
        <h1>mars</h1>
        <nav className="home-links" aria-label="Site pages">
          {homeLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
