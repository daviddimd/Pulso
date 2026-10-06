import { z } from "zod";

export const km = z.number().int().min(0).max(5_000_000);
export const address = z.string().trim().min(3).max(350);
export const activity = z.string().trim().min(2).max(250);
export const versioned = z.object({ version: z.number().int().min(0) });
export const createServiceSchema = z.object({
  serviceAddress: address,
  actionPerformed: activity,
  costCenterId: z.string().uuid(),
  driverId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  startNow: z.boolean().default(false),
}).strict();
export const commands = {
  "cost-center": versioned.extend({ costCenterId: z.string().uuid() }).strict(),
  start: versioned.extend({ vehicleId: z.string().uuid().optional() }).strict(),
  complete: versioned.extend({ odometerKm: km }).strict(),
  cancel: versioned.extend({ reason: z.string().trim().min(3).max(500) }).strict(),
  "close-cancellation": versioned.extend({ odometerKm: km }).strict(),
  assignment: versioned.extend({ driverId: z.string().uuid(), vehicleId: z.string().uuid().nullable(), odometerKm: km.optional() }).strict(),
  address: versioned.extend({ serviceAddress: address }).strict(),
  return: versioned.extend({ serviceAddress: address, actionPerformed: activity, startNow: z.boolean().default(false) }).strict(),
};
export type ServiceCommand = keyof typeof commands;
export const listSchema = z.object({
  driverId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
}).strict();

export class ServiceError extends Error {
  constructor(public code: string, public statusCode = 409, public details: Record<string, unknown> = {}) { super(code); }
}

export function validateArrival(arrival: number, departure: number | null, current: number | null) {
  if (arrival < Math.max(departure ?? 0, current ?? 0)) throw new ServiceError("ODOMETER_BELOW_CURRENT", 409, { currentOdometerKm: Math.max(departure ?? 0, current ?? 0) });
}

export function distance(legs: { departureOdometerKm: number | null; arrivalOdometerKm: number | null }[]) {
  if (!legs.length || legs.some(l => l.departureOdometerKm === null || l.arrivalOdometerKm === null)) return null;
  return legs.reduce((sum, l) => sum + l.arrivalOdometerKm! - l.departureOdometerKm!, 0);
}
