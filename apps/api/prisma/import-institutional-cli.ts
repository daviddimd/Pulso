import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { importCostCenters, importDrivers } from "./import-institutional";
const connectionString = process.env.DATABASE_URL;
if (!connectionString || new URL(connectionString).pathname !== "/pulso_dev" || process.env.NODE_ENV === "production") throw new Error("Importación para pulso_dev únicamente.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
async function main() {
  await importCostCenters(prisma);
  console.log("Centros de costos:", await prisma.costCenter.count());
  console.log("Nómina:", await importDrivers(prisma));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
