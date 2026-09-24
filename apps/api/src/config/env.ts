import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3000),

  HOST: z
    .string()
    .default("0.0.0.0"),

  DATABASE_URL: z
    .string()
    .min(1),

  WEB_ORIGIN: z
    .string()
    .default("http://localhost:5173"),

  SESSION_COOKIE_NAME: z
    .string()
    .default("pulso_session"),

  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(12),
});

export const env = envSchema.parse(process.env);