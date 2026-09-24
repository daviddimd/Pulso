import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/);

export const adminBitacorasQuerySchema = z
  .object({
    driverId: z.string().uuid().optional(),
    date: dateSchema.optional(),
  })
  .strict();

export const adminOverviewQuerySchema = z
  .object({
    date: dateSchema,
  })
  .strict();