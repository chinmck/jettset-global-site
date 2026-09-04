import { jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";

export const partnerStatus = pgEnum("partner_status", ["active", "inactive", "pending"]);
export const userRole = pgEnum("partner_user_role", ["partner", "admin", "executive"]);
export const enquiryProduct = pgEnum("enquiry_product", ["jet_card", "club_membership", "charter", "access_partners", "general"]);
export const enquiryStatus = pgEnum("enquiry_status", ["pending", "synced", "failed", "stale"]);
export const documentCategory = pgEnum("document_category", ["agreement", "compliance", "brand_asset", "sales_collateral", "guideline", "other"]);
export const documentVisibility = pgEnum("document_visibility", ["private", "shared"]);

export const partners = pgTable("partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  org: text("org"),
  email: text("email").notNull().unique(),
  status: partnerStatus("status").notNull().default("pending"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  commissionTerms: text("commission_terms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const partnerUsers = pgTable("partner_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  role: userRole("role").notNull().default("partner"),
  status: partnerStatus("status").notNull().default("pending"),
  aupAcceptedAt: timestamp("aup_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => partnerUsers.id, { onDelete: "cascade" }),
  type: text("type").notNull(), provider: text("provider").notNull(), providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"), access_token: text("access_token"), expires_at: integer("expires_at"), token_type: text("token_type"), scope: text("scope"), id_token: text("id_token"), session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => partnerUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(), token: text("token").notNull(), expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

export const enquiries = pgTable("enquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  correlationId: uuid("correlation_id").defaultRandom().notNull(),
  partnerId: uuid("partner_id").notNull().references(() => partners.id),
  submittedBy: uuid("submitted_by").notNull().references(() => partnerUsers.id),
  product: enquiryProduct("product").notNull(),
  status: enquiryStatus("status").notNull().default("pending"),
  ghlOpportunityId: text("ghl_opportunity_id"), ghlPipelineId: text("ghl_pipeline_id"),
  payload: jsonb("payload").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("enquiries_correlation_id_idx").on(t.correlationId)]);

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(), partnerId: uuid("partner_id").references(() => partners.id),
  category: documentCategory("category").notNull(), fileKey: text("file_key").notNull(), fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), mimeType: text("mime_type"), uploadedBy: uuid("uploaded_by").notNull().references(() => partnerUsers.id),
  visibility: documentVisibility("visibility").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(), actorId: uuid("actor_id").references(() => partnerUsers.id), action: text("action").notNull(),
  entityType: text("entity_type").notNull(), entityId: uuid("entity_id"), before: jsonb("before"), after: jsonb("after"), ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
