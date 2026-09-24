import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({
  path: ".env.test",
  override: true,
});

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL no está definida en .env.test",
  );
}

const parsedUrl = new URL(databaseUrl);

if (parsedUrl.pathname !== "/pulso_test") {
  throw new Error(
    "SEGURIDAD: la configuración de tests debe apuntar exclusivamente a pulso_test.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    url: databaseUrl,
  },
});