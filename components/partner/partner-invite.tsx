"use client";

import { FormEvent, useState } from "react";

export function PartnerInvite() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/partner/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organisation_name: formData.get("organisation_name"),
          contact_name: formData.get("contact_name"),
          email: formData.get("email"),
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "The invitation could not be sent.");
      form.reset();
      setMessage("Partner access created and invitation sent.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "The invitation could not be sent.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="hub-section hub-invite-panel" aria-labelledby="partner-invite-title">
      <div className="hub-section-head">
        <div>
          <span className="hub-eyebrow">Access management</span>
          <h2 id="partner-invite-title">Invite a partner</h2>
        </div>
        <p className="hub-muted">Creates their organisation and secure Partner Hub access.</p>
      </div>
      <form className="hub-form hub-invite-form" onSubmit={handleSubmit}>
        <div className="hub-field">
          <label htmlFor="invite-organisation">Organisation name</label>
          <input id="invite-organisation" name="organisation_name" type="text" required autoComplete="organization" />
        </div>
        <div className="hub-field">
          <label htmlFor="invite-contact">Contact name</label>
          <input id="invite-contact" name="contact_name" type="text" required autoComplete="name" />
        </div>
        <div className="hub-field full">
          <label htmlFor="invite-email">Email address</label>
          <input id="invite-email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="hub-invite-actions full">
          <button className="hub-button" type="submit" disabled={submitting}>
            {submitting ? "Sending invitation…" : "Create access & send invitation →"}
          </button>
          {message && (
            <p className={isError ? "hub-invite-message is-error" : "hub-invite-message"} role="status" aria-live="polite">
              {message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
