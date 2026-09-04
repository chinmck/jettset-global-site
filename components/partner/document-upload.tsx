"use client";

import { FormEvent, useState } from "react";

type PartnerOption = { id: string; name: string };

export function DocumentUpload({ partners }: { partners: PartnerOption[] }) {
  const [visibility, setVisibility] = useState<"shared" | "private">("shared");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File)) return;
    setSubmitting(true); setMessage(""); setIsError(false);

    try {
      const initResponse = await fetch("/api/partner/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "init", file_name: file.name, file_size: file.size, mime_type: file.type, category: formData.get("category"), visibility: formData.get("visibility"), partner_id: formData.get("partner_id") }) });
      const initResult = (await initResponse.json().catch(() => null)) as { error?: string; upload_id?: string; chunk_size?: number; chunk_count?: number } | null;
      if (!initResponse.ok || !initResult?.upload_id || !initResult.chunk_size || !initResult.chunk_count) throw new Error(initResult?.error || "The document could not be uploaded.");

      for (let index = 0; index < initResult.chunk_count; index += 1) {
        setMessage(`Uploading ${index + 1} of ${initResult.chunk_count}…`);
        const start = index * initResult.chunk_size;
        const chunkResponse = await fetch(`/api/partner/documents?upload_id=${encodeURIComponent(initResult.upload_id)}&index=${index}`, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: file.slice(start, Math.min(start + initResult.chunk_size, file.size)) });
        const chunkResult = (await chunkResponse.json().catch(() => null)) as { error?: string } | null;
        if (!chunkResponse.ok) throw new Error(chunkResult?.error || "The upload was interrupted. Please try again.");
      }

      setMessage("Finishing upload…");
      const finalizeResponse = await fetch("/api/partner/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finalize", upload_id: initResult.upload_id }) });
      const finalizeResult = (await finalizeResponse.json().catch(() => null)) as { error?: string } | null;
      if (!finalizeResponse.ok) throw new Error(finalizeResult?.error || "The document could not be uploaded.");
      form.reset(); setVisibility("shared"); setMessage("Document uploaded successfully.");
    } catch (error) {
      setIsError(true); setMessage(error instanceof Error ? error.message : "The document could not be uploaded.");
    } finally { setSubmitting(false); }
  }

  return <section className="hub-section hub-upload-panel" aria-labelledby="document-upload-title"><div className="hub-section-head"><div><span className="hub-eyebrow">Documents & resources</span><h2 id="document-upload-title">Upload a document</h2></div><p className="hub-muted">PDF, Word, PNG, JPG or SVG · Maximum 25 MB</p></div><form className="hub-upload-form" onSubmit={handleSubmit} encType="multipart/form-data"><div className="hub-field hub-upload-file full"><label htmlFor="partner-document-file">Choose a file from your computer</label><input id="partner-document-file" name="file" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.svg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/svg+xml" required/></div><div className="hub-field"><label htmlFor="partner-document-category">Document type</label><select id="partner-document-category" name="category" defaultValue="other"><option value="agreement">Agreement</option><option value="compliance">Compliance</option><option value="brand_asset">Brand asset</option><option value="sales_collateral">Sales collateral</option><option value="guideline">Guideline</option><option value="other">Other</option></select></div><div className="hub-field"><label htmlFor="partner-document-visibility">Who can see it?</label><select id="partner-document-visibility" name="visibility" value={visibility} onChange={(event) => setVisibility(event.target.value === "private" ? "private" : "shared")}><option value="shared">All partners — Resource Library</option><option value="private">One partner only — My Documents</option></select></div>{visibility === "private" && <div className="hub-field full"><label htmlFor="partner-document-partner">Select partner</label><select id="partner-document-partner" name="partner_id" required defaultValue=""><option value="" disabled>Choose a partner organisation</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></div>}<div className="hub-upload-actions full"><button className="hub-button" type="submit" disabled={submitting}>{submitting ? "Uploading…" : "Upload document"}</button>{message && <p className={isError ? "hub-upload-message is-error" : "hub-upload-message"} role="status" aria-live="polite">{message}</p>}</div></form></section>;
}
