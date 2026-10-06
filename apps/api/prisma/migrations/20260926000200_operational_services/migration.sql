-- AlterTable
BEGIN;
ALTER TABLE "vehicles" ADD COLUMN     "model" VARCHAR(120),
ADD COLUMN     "vehicle_type" VARCHAR(60),
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "bitacora_entries" ADD COLUMN     "cancelled_at" TIMESTAMPTZ(3),
ADD COLUMN     "closure_pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "created_by_user_id" UUID,
ADD COLUMN     "origin" VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "return_of_id" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "driver_id" DROP NOT NULL,
ALTER COLUMN "vehicle_id" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "started_at" DROP NOT NULL,
ALTER COLUMN "started_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "service_legs" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "departure_odometer_km" INTEGER,
    "arrival_odometer_km" INTEGER,

    CONSTRAINT "service_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_address_revisions" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "address" VARCHAR(350) NOT NULL,
    "actor_user_id" UUID,
    "source" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_address_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_legs_service_id_started_at_idx" ON "service_legs"("service_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_address_revisions_service_id_revision_key" ON "service_address_revisions"("service_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "bitacora_entries_return_of_id_key" ON "bitacora_entries"("return_of_id");

-- CreateIndex
CREATE INDEX "bitacora_entries_status_ended_at_idx" ON "bitacora_entries"("status", "ended_at");

-- AddForeignKey
ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_return_of_id_fkey" FOREIGN KEY ("return_of_id") REFERENCES "bitacora_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_legs" ADD CONSTRAINT "service_legs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "bitacora_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_legs" ADD CONSTRAINT "service_legs_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_legs" ADD CONSTRAINT "service_legs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_address_revisions" ADD CONSTRAINT "service_address_revisions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "bitacora_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_address_revisions" ADD CONSTRAINT "service_address_revisions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "service_address_revisions" ("id", "service_id", "revision", "address", "source", "created_at")
SELECT "id", "id", 1, "service_address", 'LEGACY', "created_at" FROM "bitacora_entries";

INSERT INTO "service_legs" ("id", "service_id", "driver_id", "vehicle_id", "started_at", "ended_at", "arrival_odometer_km")
SELECT "id", "id", "driver_id", "vehicle_id", "started_at",
  CASE WHEN "status" = 'OPEN' THEN NULL ELSE "ended_at" END,
  "odometer_km"
FROM "bitacora_entries" WHERE "started_at" IS NOT NULL AND ("status" = 'OPEN' OR "ended_at" IS NOT NULL);

UPDATE "bitacora_entries" SET "status" = 'IN_PROGRESS' WHERE "status" = 'OPEN';
UPDATE "bitacora_entries" SET "status" = 'CANCELLED', "cancelled_at" = "updated_at" WHERE "status" = 'VOIDED';

DROP INDEX "bitacora_one_open_per_driver";
DROP INDEX "bitacora_one_open_per_vehicle";
CREATE UNIQUE INDEX "service_one_active_per_driver" ON "service_legs" ("driver_id") WHERE "ended_at" IS NULL;
CREATE UNIQUE INDEX "service_one_active_per_vehicle" ON "service_legs" ("vehicle_id") WHERE "ended_at" IS NULL;
CREATE UNIQUE INDEX "service_one_active_leg" ON "service_legs" ("service_id") WHERE "ended_at" IS NULL;
ALTER TABLE "service_legs" ADD CONSTRAINT "service_leg_km" CHECK (
  ("departure_odometer_km" IS NULL OR "departure_odometer_km" >= 0) AND
  ("arrival_odometer_km" IS NULL OR "arrival_odometer_km" >= 0) AND
  ("arrival_odometer_km" IS NULL OR "departure_odometer_km" IS NULL OR "arrival_odometer_km" >= "departure_odometer_km")
);
ALTER TABLE "service_legs" ADD CONSTRAINT "service_leg_dates" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");
ALTER TABLE "bitacora_entries" ADD CONSTRAINT "service_closure_state" CHECK (NOT "closure_pending" OR "status" = 'CANCELLED');
ALTER TABLE "bitacora_entries" ADD CONSTRAINT "service_new_states" CHECK ("status" NOT IN ('OPEN', 'VOIDED'));
ALTER TABLE "bitacora_entries" ADD CONSTRAINT "service_operational_state" CHECK (
  "origin" = 'LEGACY' OR
  ("status" = 'PENDING' AND "driver_id" IS NULL AND "started_at" IS NULL AND "ended_at" IS NULL) OR
  ("status" = 'ASSIGNED' AND "driver_id" IS NOT NULL AND "started_at" IS NULL AND "ended_at" IS NULL) OR
  ("status" = 'IN_PROGRESS' AND "driver_id" IS NOT NULL AND "vehicle_id" IS NOT NULL AND "started_at" IS NOT NULL AND "ended_at" IS NULL) OR
  ("status" = 'COMPLETED' AND "driver_id" IS NOT NULL AND "vehicle_id" IS NOT NULL AND "started_at" IS NOT NULL AND "ended_at" IS NOT NULL AND "odometer_km" IS NOT NULL) OR
  ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL)
);
COMMIT;
