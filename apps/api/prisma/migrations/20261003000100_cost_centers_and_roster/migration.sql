ALTER TABLE "users" ADD COLUMN "roster_code" VARCHAR(30);
CREATE UNIQUE INDEX "users_roster_code_key" ON "users"("roster_code");
CREATE TABLE "cost_centers" (
  "id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");
ALTER TABLE "bitacora_entries" ADD COLUMN "cost_center_id" UUID;
ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "bitacora_entries_cost_center_id_status_ended_at_idx" ON "bitacora_entries"("cost_center_id", "status", "ended_at");
