ALTER TABLE "egg_repository_eggs" ADD COLUMN "hash" varchar(64);
ALTER TABLE "egg_repositories" ADD COLUMN "default_nest_uuid" uuid;
ALTER TABLE "egg_repositories" ADD COLUMN "auto_sync" boolean DEFAULT true NOT NULL;
ALTER TABLE "nest_eggs" ADD COLUMN "egg_repository_egg_hash" varchar(64);
ALTER TABLE "egg_repositories" ADD CONSTRAINT "egg_repositories_default_nest_uuid_nests_uuid_fkey" FOREIGN KEY ("default_nest_uuid") REFERENCES "nests"("uuid") ON DELETE SET NULL;