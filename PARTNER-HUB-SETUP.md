# Partner Hub preview setup

The Partner Hub is isolated under `/partner/*` and uses Netlify's Next.js runtime.

## Required preview environment variables

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `RESEND_API_KEY`
- `PARTNER_EMAIL_FROM`
- `GHL_PARTNER_HUB_WEBHOOK_URL`
- `GHL_CONFIRM_SECRET`

Apply `drizzle/0000_partner_hub.sql` to Neon before first login. Create the first admin or executive user directly in Neon with `status='active'`. Partner invite administration will be enabled after Resend sender verification.

## GHL contract

The application makes no GHL REST API calls. It posts the stored enquiry to the single inbound webhook and receives asynchronous confirmation at `/api/partner/ghl-confirm`, authenticated with the `x-ghl-confirm-secret` header. GHL must echo `correlation_id` and send `ghl_opportunity_id`.

## Files

Resource uploads use Netlify Blobs store `partner-resources`; Postgres stores metadata only.
