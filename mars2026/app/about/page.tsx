import Image from "next/image";

const faqs = [
  {
    question: "What is mars?",
    answer:
      "I like to create things a lot so I think this will be the place to showcase and sell some of those things ",
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
      "Yes. Send a DM on Instagram or email me with the idea, reference, or project you have in mind and I will get back to you.",
  },
];

const socials = [
  { label: "Instagram", href: "https://www.instagram.com/goneoffmars/" },
  { label: "X / Twitter", href: "https://x.com" },
  { label: "TikTok", href: "https://www.tiktok.com/@goneoffmars" },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <div className="about-layout">
        <section className="about-visual" aria-label="Portrait">
          <div className="about-placeholder">
            <Image
              alt="Portrait of the artist behind MARS"
              className="about-portrait"
              fill
              priority
              sizes="(max-width: 767px) min(64vw, 300px), min(34vw, 470px)"
              src="/about-portrait.png"
            />
          </div>
        </section>

        <div className="about-content">
          <section className="about-section about-bio" aria-labelledby="bio-title">
            <p className="about-label" id="bio-title">
              Biography
            </p>
            <div className="about-copy">
              <p>
               make poster listen music
              </p>
              <p>
                I am a CS major, I dabble in Graphic Design and drawing sometimes, here is everything I&apos;ve made
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
                </a>
              ))}
              <a href="kindofaneww@gmail.com">
                <span>Email</span>
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
