import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uuid,
  integer,
  jsonb,
  unique,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";

// --- Auth Tables (Better Auth) ---
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
}).enableRLS();

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
).enableRLS();

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
).enableRLS();

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt").$defaultFn(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
).enableRLS();

export const surveys = pgTable(
  "surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    state: text("state", { enum: ["draft", "open", "closed"] })
      .notNull()
      .default("draft"),
    activeVersionId: uuid("active_version_id"),
  },
  (t) => [check("survey_state", sql`${t.state} in ('draft', 'open', 'closed')`)],
).enableRLS();

export const surveyVersions = pgTable(
  "survey_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id),
    version: integer("version").notNull(),
    definition: jsonb("definition").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("survey_version_number").on(t.surveyId, t.version),
    unique("survey_version_owner").on(t.surveyId, t.id),
  ],
).enableRLS();

export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id),
    definitionVersionId: uuid("definition_version_id").notNull(),
    submissionKey: uuid("submission_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    answers: jsonb("answers").notNull(),
    selectedInstructorIds: jsonb("selected_instructor_ids").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("survey_submission_key").on(t.surveyId, t.submissionKey),
    foreignKey({
      name: "response_version_survey",
      columns: [t.surveyId, t.definitionVersionId],
      foreignColumns: [surveyVersions.surveyId, surveyVersions.id],
    }),
    index("responses_survey_version_date").on(t.surveyId, t.definitionVersionId, t.createdAt),
  ],
).enableRLS();

// This table is managed by trusted setup, never by public signup/profile writes.
export const feedbackAdmins = pgTable("feedback_admins", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
}).enableRLS();

export const feedbackAudit = pgTable("feedback_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  surveyId: uuid("survey_id")
    .notNull()
    .references(() => surveys.id),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
