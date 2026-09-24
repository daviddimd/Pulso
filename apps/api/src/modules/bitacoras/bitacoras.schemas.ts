import { z } from "zod";

export const startBitacoraSchema = z
  .object({
    vehicleId: z.string().uuid(),

    serviceAddress: z
      .string()
      .trim()
      .min(3)
      .max(350),

    actionPerformed: z
      .string()
      .trim()
      .min(2)
      .max(250),
  })
  .strict();

export const finalizeBitacoraSchema = z
  .object({
    odometerKm: z
      .number()
      .int()
      .min(0)
      .max(5_000_000),
  })
  .strict();

export const finalizeBitacoraParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();