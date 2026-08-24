const GHL_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/b3nspOVpQi5t9UAYuKRx/webhook-trigger/7cdd3842-331c-4eda-9e84-ffc5ca192035";

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { ok: false });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.form_name !== "jettset-general-enquiry"
  ) {
    return jsonResponse(400, { ok: false });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      return jsonResponse(502, { ok: false });
    }

    return jsonResponse(200, { ok: true });
  } catch {
    return jsonResponse(502, { ok: false });
  } finally {
    clearTimeout(timeoutId);
  }
}
