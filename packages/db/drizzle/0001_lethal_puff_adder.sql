CREATE TABLE "feedback_admins" (
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"definition_version_id" uuid NOT NULL,
	"submission_key" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"answers" jsonb NOT NULL,
	"selected_instructor_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_submission_key" UNIQUE("survey_id","submission_key")
);
--> statement-breakpoint
ALTER TABLE "survey_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "survey_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_version_number" UNIQUE("survey_id","version"),
	CONSTRAINT "survey_version_owner" UNIQUE("survey_id","id")
);
--> statement-breakpoint
ALTER TABLE "survey_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"active_version_id" uuid,
	CONSTRAINT "surveys_slug_unique" UNIQUE("slug"),
	CONSTRAINT "survey_state" CHECK ("surveys"."state" in ('draft', 'open', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "surveys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback_admins" ADD CONSTRAINT "feedback_admins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_audit" ADD CONSTRAINT "feedback_audit_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_audit" ADD CONSTRAINT "feedback_audit_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "response_version_survey" FOREIGN KEY ("survey_id","definition_version_id") REFERENCES "public"."survey_versions"("survey_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_versions" ADD CONSTRAINT "survey_versions_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_versions" ADD CONSTRAINT "survey_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "responses_survey_version_date" ON "survey_responses" USING btree ("survey_id","definition_version_id","created_at");