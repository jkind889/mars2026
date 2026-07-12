"use client";

import { FormEvent, useState } from "react";

const contactEmail = "hello@mars2026.com";

export function ContactForm() {
  const [isSent, setIsSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") ?? "").trim();
    const email = String(values.get("email") ?? "").trim();
    const message = String(values.get("message") ?? "").trim();
    const subject = `Commission inquiry from ${name}`;
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;

    setIsSent(true);
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className="commission-form" onSubmit={handleSubmit}>
      <div className="commission-form-field">
        <label htmlFor="commission-name">Name</label>
        <input id="commission-name" name="name" type="text" required />
      </div>

      <div className="commission-form-field">
        <label htmlFor="commission-email">Email</label>
        <input id="commission-email" name="email" type="email" required />
      </div>

      <div className="commission-form-field">
        <label htmlFor="commission-message">Message</label>
        <textarea
          id="commission-message"
          name="message"
          rows={7}
          required
        />
      </div>

      <button className="commission-submit" type="submit">
        Open email draft <span aria-hidden="true">↗</span>
      </button>

      <p className="commission-form-note" aria-live="polite">
        {isSent
          ? "Your email draft should be open in your mail app."
          : `This will open a draft addressed to ${contactEmail}.`}
      </p>
    </form>
  );
}
