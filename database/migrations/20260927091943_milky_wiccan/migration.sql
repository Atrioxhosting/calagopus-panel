CREATE TABLE "devices" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(1020) NOT NULL,
	"description" text,
	"source" varchar(255) NOT NULL,
	"target" varchar(255) NOT NULL,
	"permissions" varchar(255) DEFAULT 'rwm' NOT NULL,
	"user_attachable" boolean DEFAULT false NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "nest_egg_devices" (
	"egg_uuid" uuid,
	"device_uuid" uuid,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "egg_devices_pk" PRIMARY KEY("egg_uuid","device_uuid")
);

CREATE TABLE "node_devices" (
	"node_uuid" uuid,
	"device_uuid" uuid,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "node_devices_pk" PRIMARY KEY("node_uuid","device_uuid")
);

CREATE TABLE "server_devices" (
	"server_uuid" uuid,
	"device_uuid" uuid,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "server_devices_pk" PRIMARY KEY("server_uuid","device_uuid")
);

CREATE UNIQUE INDEX "devices_name_idx" ON "devices" ("name");
CREATE UNIQUE INDEX "devices_source_target_idx" ON "devices" ("source","target");
CREATE INDEX "egg_devices_egg_uuid_idx" ON "nest_egg_devices" ("egg_uuid");
CREATE INDEX "egg_devices_device_uuid_idx" ON "nest_egg_devices" ("device_uuid");
CREATE INDEX "node_devices_node_uuid_idx" ON "node_devices" ("node_uuid");
CREATE INDEX "node_devices_device_uuid_idx" ON "node_devices" ("device_uuid");
CREATE INDEX "server_devices_server_uuid_idx" ON "server_devices" ("server_uuid");
CREATE INDEX "server_devices_device_uuid_idx" ON "server_devices" ("device_uuid");
ALTER TABLE "nest_egg_devices" ADD CONSTRAINT "nest_egg_devices_egg_uuid_nest_eggs_uuid_fkey" FOREIGN KEY ("egg_uuid") REFERENCES "nest_eggs"("uuid") ON DELETE CASCADE;
ALTER TABLE "nest_egg_devices" ADD CONSTRAINT "nest_egg_devices_device_uuid_devices_uuid_fkey" FOREIGN KEY ("device_uuid") REFERENCES "devices"("uuid") ON DELETE CASCADE;
ALTER TABLE "node_devices" ADD CONSTRAINT "node_devices_node_uuid_nodes_uuid_fkey" FOREIGN KEY ("node_uuid") REFERENCES "nodes"("uuid") ON DELETE CASCADE;
ALTER TABLE "node_devices" ADD CONSTRAINT "node_devices_device_uuid_devices_uuid_fkey" FOREIGN KEY ("device_uuid") REFERENCES "devices"("uuid") ON DELETE CASCADE;
ALTER TABLE "server_devices" ADD CONSTRAINT "server_devices_server_uuid_servers_uuid_fkey" FOREIGN KEY ("server_uuid") REFERENCES "servers"("uuid") ON DELETE CASCADE;
ALTER TABLE "server_devices" ADD CONSTRAINT "server_devices_device_uuid_devices_uuid_fkey" FOREIGN KEY ("device_uuid") REFERENCES "devices"("uuid") ON DELETE CASCADE;