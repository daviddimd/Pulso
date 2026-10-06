import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { importInstitutionalVehicles, institutionalVehicles } from "./vehicle-catalog";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Falta DATABASE_URL.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema: process.env.PULSO_TEST_SCHEMA ?? "public" }) });
async function main() {
  console.log("Base configurada:", new URL(connectionString!).pathname.slice(1));
  if (process.argv.includes("--apply")) console.log(await importInstitutionalVehicles(prisma));
  else console.log("Vista previa; usa --apply para cargar los ocho vehículos de la foto.");
  console.table(await prisma.vehicle.findMany({
    select: { roleCode: true, licensePlate: true, vehicleType: true, year: true, model: true, active: true, currentOdometerKm: true },
    orderBy: { roleCode: "asc" },
  }));
  if (!process.argv.includes("--apply")) console.table(institutionalVehicles);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
