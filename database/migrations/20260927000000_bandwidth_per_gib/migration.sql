ALTER TABLE "nodes" ADD COLUMN "bandwidth_per_gib" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_bandwidth_per_gib_nonnegative" CHECK ("bandwidth_per_gib" >= 0);
ALTER TABLE "servers" ADD COLUMN "billing_period_id" varchar(255);
ALTER TABLE "servers" ADD COLUMN "billing_period_start" timestamp;
ALTER TABLE "servers" ADD COLUMN "billing_period_end" timestamp;
ALTER TABLE "servers" ADD CONSTRAINT "servers_billing_period_complete" CHECK (
    ("billing_period_id" IS NULL AND "billing_period_start" IS NULL AND "billing_period_end" IS NULL)
    OR ("billing_period_id" IS NOT NULL AND "billing_period_start" IS NOT NULL AND "billing_period_end" IS NOT NULL AND "billing_period_start" < "billing_period_end")
);
