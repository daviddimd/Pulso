import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedDemoServices } from "./demo-services";
import { replaceSampleServices } from "./replace-sample-services";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.NODE_ENV === "production" ||
    !["/pulso_dev", "/pulso_test"].includes(new URL(connectionString).pathname)) {
  throw new Error("La demostración solo se permite en pulso_dev o pulso_test fuera de producción.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema: process.env.PULSO_TEST_SCHEMA ?? "public" }) });
(process.argv.includes("--replace") ? replaceSampleServices(prisma) : seedDemoServices(prisma))
  .then(result => console.log("DEMO: servicios y kilometrajes ficticios", result))
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
