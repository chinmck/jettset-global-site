import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = neon(databaseUrl);
const result = await sql`
  UPDATE partner_users
  SET role = 'admin', status = 'active', updated_at = now()
  WHERE id = (
    SELECT id
    FROM partner_users
    WHERE email_verified IS NOT NULL
      AND aup_accepted_at IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM partner_users
    WHERE role IN ('admin', 'executive')
  )
  RETURNING id
`;

console.log(result.length ? "Preview administrator bootstrapped." : "Preview administrator already present or no eligible user.");
