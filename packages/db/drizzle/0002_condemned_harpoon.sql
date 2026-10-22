ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Keep active definitions attached to their owning survey, including trusted writes.
ALTER TABLE "surveys" ADD CONSTRAINT "active_version_survey"
  FOREIGN KEY ("id", "active_version_id") REFERENCES "survey_versions" ("survey_id", "id");
--> statement-breakpoint
-- Published snapshots are append-only. Corrections require a new version.
CREATE FUNCTION freeze_feedback_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published survey versions are immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_feedback_version BEFORE UPDATE OR DELETE ON "survey_versions"
  FOR EACH ROW EXECUTE FUNCTION freeze_feedback_version();
