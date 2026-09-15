ALTER TABLE "oauth_providers" ADD COLUMN "avatar_url_template" varchar(255);
ALTER TABLE "oauth_providers" ADD COLUMN "avatar_overwrite" boolean DEFAULT false NOT NULL;