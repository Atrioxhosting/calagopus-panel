ALTER TABLE "oauth_providers" ADD COLUMN "pkce" boolean DEFAULT false NOT NULL;
ALTER TABLE "oauth_providers" ALTER COLUMN "client_secret" DROP NOT NULL;