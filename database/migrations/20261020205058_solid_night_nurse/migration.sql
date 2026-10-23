CREATE TABLE "game_ipv6_addresses" (
	"address" inet PRIMARY KEY,
	"node_uuid" uuid NOT NULL,
	"server_uuid" uuid NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "game_ipv6_nodes" (
	"node_uuid" uuid PRIMARY KEY,
	"prefix" inet NOT NULL,
	"reserved" jsonb DEFAULT '[]' NOT NULL
);

CREATE TABLE "game_ipv6_servers" (
	"server_uuid" uuid PRIMARY KEY,
	"node_uuid" uuid NOT NULL,
	"desired" inet NOT NULL,
	"applied" inet,
	"generation" uuid DEFAULT gen_random_uuid() NOT NULL,
	"pending" boolean DEFAULT true NOT NULL,
	"kind" text DEFAULT 'provision' NOT NULL,
	"last_rotation" timestamp with time zone,
	"error" text
);

ALTER TABLE "nest_eggs" DROP COLUMN "force_outgoing_ip";
CREATE INDEX "game_ipv6_addresses_owner" ON "game_ipv6_addresses" ("server_uuid");
CREATE UNIQUE INDEX "game_ipv6_prefix_unique" ON "game_ipv6_nodes" ("prefix");
ALTER TABLE "game_ipv6_addresses" ADD CONSTRAINT "game_ipv6_addresses_node_uuid_nodes_uuid_fkey" FOREIGN KEY ("node_uuid") REFERENCES "nodes"("uuid") ON DELETE RESTRICT;
ALTER TABLE "game_ipv6_nodes" ADD CONSTRAINT "game_ipv6_nodes_node_uuid_nodes_uuid_fkey" FOREIGN KEY ("node_uuid") REFERENCES "nodes"("uuid") ON DELETE RESTRICT;
ALTER TABLE "game_ipv6_servers" ADD CONSTRAINT "game_ipv6_servers_node_uuid_nodes_uuid_fkey" FOREIGN KEY ("node_uuid") REFERENCES "nodes"("uuid") ON DELETE RESTRICT;
ALTER TABLE "game_ipv6_servers" ADD CONSTRAINT "game_ipv6_servers_desired_game_ipv6_addresses_address_fkey" FOREIGN KEY ("desired") REFERENCES "game_ipv6_addresses"("address") ON DELETE RESTRICT;