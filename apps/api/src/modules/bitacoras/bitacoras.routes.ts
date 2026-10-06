import type { FastifyInstance } from "fastify";
import { requireRole } from "../../common/auth";
import { prisma } from "../../lib/prisma";
import { startBitacoraSchema, finalizeBitacoraParamsSchema, finalizeBitacoraSchema } from "./bitacoras.schemas";
import { commandService, createService, serviceInclude } from "../services/services.service";
import { serviceErrors } from "../services/services.routes";

function legacy<T extends { status: string }>(entry: T) {
  return { ...entry, status: entry.status === "IN_PROGRESS" ? "OPEN" : entry.status === "CANCELLED" ? "VOIDED" : entry.status };
}
export async function bitacoraRoutes(app: FastifyInstance) {
  serviceErrors(app);
  app.post("/", async (req, reply) => {
    const user = await requireRole(req, reply, "DRIVER");
    if (!user) return;
    const parsed = startBitacoraSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_BITACORA_DATA" });
    return reply.code(201).send({ entry: legacy(await createService(user, { ...parsed.data, startNow: true }, req.ip)) });
  });
  app.patch("/:id/finalize", async (req, reply) => {
    const user = await requireRole(req, reply, "DRIVER");
    if (!user) return;
    const params = finalizeBitacoraParamsSchema.safeParse(req.params);
    const body = finalizeBitacoraSchema.safeParse(req.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_ENTRY_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_ODOMETER" });
    const entry = await prisma.bitacoraEntry.findUnique({ where: { id: params.data.id } });
    if (!entry) return reply.code(404).send({ error: "ENTRY_NOT_FOUND" });
    return { entry: legacy(await commandService(user, entry.id, "complete", { ...body.data, version: entry.version }, req.ip)) };
  });
  app.get("/mine", async (req, reply) => {
    const user = await requireRole(req, reply, "DRIVER");
    if (!user) return;
    const entries = await prisma.bitacoraEntry.findMany({ where: { driverId: user.id }, orderBy: { createdAt: "desc" }, include: serviceInclude });
    return { entries: entries.map(legacy) };
  });
}
