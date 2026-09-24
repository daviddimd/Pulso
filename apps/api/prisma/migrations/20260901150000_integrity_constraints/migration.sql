CREATE UNIQUE INDEX "bitacora_one_open_per_driver"
ON "bitacora_entries" ("driver_id")
WHERE "status" = 'OPEN';


CREATE UNIQUE INDEX "bitacora_one_open_per_vehicle"
ON "bitacora_entries" ("vehicle_id")
WHERE "status" = 'OPEN';

ALTER TABLE "bitacora_entries"
ADD CONSTRAINT "bitacora_odometer_nonnegative"
CHECK (
  "odometer_km" IS NULL
  OR "odometer_km" >= 0
);

ALTER TABLE "vehicles"
ADD CONSTRAINT "vehicle_odometer_nonnegative"
CHECK (
  "current_odometer_km" IS NULL
  OR "current_odometer_km" >= 0
);