import { boolean, date, index, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";

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

export const partnerNotes = pgTable("partner_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  enquiryId: uuid("enquiry_id").notNull().references(() => enquiries.id, { onDelete: "cascade" }),
  partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => partnerUsers.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("partner_notes_partner_enquiry_idx").on(t.partnerId, t.enquiryId),
  index("partner_notes_created_at_idx").on(t.createdAt),
]);

export const partnerTasks = pgTable("partner_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  enquiryId: uuid("enquiry_id").notNull().references(() => enquiries.id, { onDelete: "cascade" }),
  partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => partnerUsers.id),
  body: text("body").notNull(),
  dueDate: date("due_date"),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("partner_tasks_partner_enquiry_idx").on(t.partnerId, t.enquiryId),
  index("partner_tasks_partner_open_due_idx").on(t.partnerId, t.done, t.dueDate),
]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(), actorId: uuid("actor_id").references(() => partnerUsers.id), action: text("action").notNull(),
  entityType: text("entity_type").notNull(), entityId: uuid("entity_id"), before: jsonb("before"), after: jsonb("after"), ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Global Culture Calendar (curated, staff-approved) ----------
   Public data lives in culture_events (published/cancelled). Feeds and the watchlist only ever write
   culture_candidates; a staff decision in the Partner Hub (culture_reviews) is the only way a
   candidate becomes, changes or removes a public event. */
export const cultureEvents = pgTable("culture_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  countryCode: text("country_code"),
  venue: text("venue").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  timezone: text("timezone").notNull(),
  status: text("status").notNull().default("published"),            // published | cancelled
  organiser: text("organiser"),
  sourceName: text("source_name"), sourceUrl: text("source_url"),     // staff-only references, never shown publicly
  sourceRef: text("source_ref"), watchKey: text("watch_key"),
  lastVerifiedOn: date("last_verified_on", { mode: "string" }),       // set only by a staff decision; shown on the page
  lastSourceCheckAt: timestamp("last_source_check_at", { withTimezone: true }),   // set by the sync; private
  editorial: jsonb("editorial").$type<{ lede?: string; context?: string[]; guidance?: Array<{ title: string; body: string }>; airports?: string[] }>(),
  editorialReviewedBy: uuid("editorial_reviewed_by").references(() => partnerUsers.id),
  editorialReviewedAt: timestamp("editorial_reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("culture_events_slug_idx").on(t.slug), index("culture_events_status_start_idx").on(t.status, t.startDate)]);

export const cultureCandidates = pgTable("culture_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(),             // new | change | cancellation | manual_verification | recheck
  status: text("status").notNull().default("pending"),   // pending | needs_verification | approved | rejected | superseded
  eventId: uuid("event_id").references(() => cultureEvents.id),
  watchKey: text("watch_key"),
  fingerprint: text("fingerprint").notNull(),
  proposed: jsonb("proposed").notNull(),
  current: jsonb("current"),
  sourceId: text("source_id"), sourceName: text("source_name"), sourceUrl: text("source_url"), sourceRef: text("source_ref"),
  sourceCheckedAt: timestamp("source_checked_at", { withTimezone: true }),
  uncertainty: text("uncertainty"),
  verificationNotes: text("verification_notes"),
  decidedBy: uuid("decided_by").references(() => partnerUsers.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNotes: text("decision_notes"),
  firstSeen: timestamp("first_seen", { withTimezone: true }).defaultNow().notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("culture_candidates_fingerprint_idx").on(t.fingerprint), index("culture_candidates_status_idx").on(t.status)]);

export const cultureReviews = pgTable("culture_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull().references(() => cultureCandidates.id),
  reviewerId: uuid("reviewer_id").notNull().references(() => partnerUsers.id),
  decision: text("decision").notNull(),     // approve | reject | needs_verification
  notes: text("notes"),
  before: jsonb("before"), after: jsonb("after"),
  decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("culture_reviews_candidate_idx").on(t.candidateId)]);

export const cultureSyncRuns = pgTable("culture_sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  trigger: text("trigger").notNull().default("schedule"),   // schedule | manual
  status: text("status").notNull(),                       // ok | partial | failed | empty | no_feeds
  headline: text("headline"),
  summary: jsonb("summary"),
}, (t) => [index("culture_sync_runs_started_idx").on(t.startedAt)]);

export const cultureSourceStates = pgTable("culture_source_states", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),             // feed | watchlist
  lastAttempt: timestamp("last_attempt", { withTimezone: true }),
  lastSuccess: timestamp("last_success", { withTimezone: true }),
  lastError: text("last_error"),
  itemsSeen: integer("items_seen").notNull().default(0),
});
