import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "../config/env";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
}, { schema: process.env.PULSO_TEST_SCHEMA ?? "public" });

export const prisma = new PrismaClient({
  adapter,
});
