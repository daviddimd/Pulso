import { z } from "zod";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const dailyExportQuerySchema = z.union([
  z.object({ date }).strict(),
  z.object({ from: date, to: date }).strict(),
]);
