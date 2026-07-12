import { ContactForm } from "@/components/contact-form";

export default function ContactPage() {
  return (
    <main className="contact-page">
      <div className="contact-page-layout">
        <section className="contact-page-copy" aria-labelledby="contact-page-title">
          <p className="commission-label">Contact</p>
          <h1 id="contact-page-title">Let&apos;s make something.</h1>
          <p>
            Have a project, collaboration, or idea in mind? Send over a few
            details and I&apos;ll be in touch.
          </p>
        </section>

        <ContactForm />
      </div>
    </main>
  );
}
