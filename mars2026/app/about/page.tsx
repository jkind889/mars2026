const faqs = [
  {
    question: "What is MARS?",
    answer:
      "MARS is an independent poster studio for designs, references, and visual ideas that I want to live with.",
  },
  {
    question: "Where are the posters printed?",
    answer:
      "Every product page includes the current size, paper, and fulfillment details before you place an order.",
  },
  {
    question: "Do you ship internationally?",
    answer:
      "The shop currently ships within the United States. More destinations may be added as the shop grows.",
  },
  {
    question: "Can I ask about a custom piece?",
    answer:
      "Yes. Send a note with the idea, reference, or project you have in mind and I will get back to you.",
  },
];

const socials = [
  { label: "Instagram", href: "https://instagram.com" },
  { label: "X / Twitter", href: "https://x.com" },
  { label: "TikTok", href: "https://tiktok.com" },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <div className="about-layout">
        <section className="about-visual" aria-label="Portrait placeholder">
          <div className="about-placeholder" role="img" aria-label="Blank circular image placeholder" />
          <span className="about-cross" aria-hidden="true" />
        </section>

        <div className="about-content">
          <section className="about-section about-bio" aria-labelledby="bio-title">
            <p className="about-label" id="bio-title">
              Biography
            </p>
            <div className="about-copy">
              <p>
                I&apos;m the person behind MARS, an independent poster studio for
                designs, references, and visual ideas I want to live with.
              </p>
              <p>
                The shop is a growing collection of printed work — from music
                and image-making to the visual details that stay with me. I care
                about clear composition, thoughtful objects, and making things
                that feel good to keep around.
              </p>
            </div>
          </section>

          <section className="about-section about-faq" aria-labelledby="faq-title">
            <p className="about-label" id="faq-title">
              FAQ
            </p>
            <div className="about-faq-list">
              {faqs.map((faq, index) => (
                <details className="about-faq-item" key={faq.question} open={index === 0}>
                  <summary>
                    <span>{faq.question}</span>
                    <span className="about-faq-plus" aria-hidden="true" />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="about-section about-socials" aria-labelledby="socials-title">
            <p className="about-label" id="socials-title">
              Socials
            </p>
            <div className="about-social-list">
              {socials.map((social) => (
                <a href={social.href} key={social.label} target="_blank" rel="noreferrer">
                  <span>{social.label}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
              <a href="mailto:hello@mars2026.com">
                <span>Email</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
