ALTER TABLE "users" ADD COLUMN "totp_last_step" bigint;

UPDATE "users"
SET "totp_last_step" = floor(extract(epoch FROM "totp_last_used") / 30)::bigint + 1
WHERE "totp_last_used" IS NOT NULL;
