DROP INDEX "egg_configurations_eggs_idx";
ALTER TABLE "egg_configurations" ADD COLUMN "matcher" jsonb;
UPDATE "egg_configurations" SET "matcher" = jsonb_build_object('type', 'eggs', 'eggs', to_jsonb("eggs"));
ALTER TABLE "egg_configurations" ALTER COLUMN "matcher" SET NOT NULL;
ALTER TABLE "egg_configurations" ADD COLUMN "config_features" jsonb;
ALTER TABLE "egg_configurations" DROP COLUMN "eggs";
