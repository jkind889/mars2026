import Link from "next/link";

const usageTerms = [
  "Sharing the PSD file of the work will be an additional charge of 50% of the base price on top of the agreed on price",
  "Commissions are for personal use only. Artworks can be used as posters/banners/profile pictures etc. Reselling my work or passing it off as your own is not allowed",
  "Fanart commissions consisting of any characters/games/series/etc may be used by me to produce physical prints as I see fit",
];

const paymentTerms = [
  "A 50% (nonrefundable) deposit must be paid before any work from the artist begins",
  "In the rare case I cannot complete the commission, the 50% deposit will be refunded to the client.",
  "Reposting and sharing the artwork is OK, but do give credit when doing so",
  "I own all rights to the commissioned work,",
  "I am allowed to post my work on social media as well as use it in my portfolio unless stated otherwise.",
];

function TermList({ terms }: { terms: string[] }) {
  return (
    <ul className="commission-term-list">
      {terms.map((term) => (
        <li key={term}>{term}</li>
      ))}
    </ul>
  );
}

export default function CommissionsPage() {
  return (
    <main className="commission-page">
      <div className="commission-layout">
        <section
          className="commission-terms"
          id="commission"
          aria-labelledby="commission-title"
        >
          <header className="commission-header">
            <h1 id="commission-title">Terms of Service</h1>
            <p>
              As the client you&apos;re responsible for adhering and reading the
              terms listed here
            </p>
            <Link className="commission-contact-link" href="/contact">
              Start a commission <span aria-hidden="true">↗</span>
            </Link>
          </header>

          <div className="commission-terms-grid">
            <section className="commission-delivery" aria-labelledby="delivery-title">
              <h2 id="delivery-title">Method of Delivery</h2>
              <p>
                The commission will be sent to the client via email with a google
                drive link unless another delivery method is agreed upon by both
                the artist and client
              </p>
            </section>

            <TermList terms={usageTerms} />
            <TermList terms={paymentTerms} />
          </div>
        </section>
      </div>
    </main>
  );
}
