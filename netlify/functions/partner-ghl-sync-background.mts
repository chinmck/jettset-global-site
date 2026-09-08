type PayloadRecord = Record<string, unknown>;

function asRecord(value: unknown): PayloadRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as PayloadRecord)
    : null;
}

function responseExcerpt(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
    .slice(0, 2000);
}

export default async (request: Request) => {
  if (request.method !== "POST") {
    console.warn("Partner GHL sync rejected", { reason: "method_not_allowed", method: request.method });
    return new Response("Method not allowed", { status: 405 });
  }

  const endpoint = process.env.GHL_PARTNER_HUB_WEBHOOK_URL;
  if (!endpoint || endpoint.includes("preview-pending")) {
    console.error("Partner GHL sync not attempted", { reason: "webhook_not_configured" });
    return new Response(null, { status: 202 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("Partner GHL sync rejected", {
      reason: "invalid_json",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response(null, { status: 400 });
  }

  const record = asRecord(payload);
  const correlationId =
    record && typeof record.correlation_id === "string" ? record.correlation_id : null;
  const product = record && typeof record.product === "string" ? record.product : null;

  console.info("Partner GHL sync started", {
    correlation_id: correlationId,
    product,
    fields_present: record ? Object.keys(record).sort() : [],
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const responseBody = await response.text().catch(() => "");

    console.info("Partner GHL sync response", {
      correlation_id: correlationId,
      status: response.status,
      status_text: response.statusText,
      ok: response.ok,
      content_type: response.headers.get("content-type"),
      response_body: responseExcerpt(responseBody),
      response_body_truncated: responseBody.length > 2000,
    });

    if (!response.ok) return new Response(null, { status: 502 });
    return new Response(null, { status: 202 });
  } catch (error) {
    console.error("Partner GHL sync failed", {
      correlation_id: correlationId,
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response(null, { status: 502 });
  }
};

export const config = { type: "background" };
