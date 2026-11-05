DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'toast_position'
  ) THEN
    EXECUTE $sql$
      INSERT INTO "user_settings" ("user_uuid", "settings")
      SELECT "uuid", jsonb_build_object('app::toast_position', lower("toast_position"::text))
      FROM "users"
      WHERE "toast_position"::text <> 'BOTTOM_RIGHT'
      ON CONFLICT ("user_uuid") DO UPDATE SET "settings" = EXCLUDED."settings" || "user_settings"."settings"
    $sql$;

    ALTER TABLE "users" DROP COLUMN "toast_position";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'start_on_grouped_servers'
  ) THEN
    EXECUTE $sql$
      INSERT INTO "user_settings" ("user_uuid", "settings")
      SELECT "uuid", jsonb_build_object('dashboard::start_on_grouped_servers', true)
      FROM "users"
      WHERE "start_on_grouped_servers"
      ON CONFLICT ("user_uuid") DO UPDATE SET "settings" = EXCLUDED."settings" || "user_settings"."settings"
    $sql$;

    ALTER TABLE "users" DROP COLUMN "start_on_grouped_servers";
  END IF;
END
$$;

DROP TYPE IF EXISTS "public"."user_toast_position";
