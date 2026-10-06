import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthenticatedUser } from "../../common/auth";
import { prisma } from "../../lib/prisma";
import { serviceErrors } from "../services/services.routes";
import { costCenterSummary } from "./cost-centers.service";
import { costCenterWorkbook } from "./cost-centers.export";

export async function costCenterRoutes(app: FastifyInstance) {
  serviceErrors(app);
  app.get("/", async (req, reply) => {
    if (!await getAuthenticatedUser(req)) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    return { costCenters: await prisma.costCenter.findMany({ where: { active: true }, orderBy: { code: "asc" } }) };
  });
  for (const route of ["/summary", "/export"]) app.get(route, async (req, reply) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    if (user.role !== "ADMIN") return reply.code(403).send({ error: "FORBIDDEN" });
    const { from, to, includeInactive } = z.object({ from: z.string().date(), to: z.string().date(), includeInactive: z.enum(["true", "false"]).optional() }).strict().parse(req.query);
    try {
      const report = await costCenterSummary(from, to);
      if (route === "/summary") return report;
      const book = costCenterWorkbook(report, includeInactive === "true");
      reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      reply.header("Content-Disposition", `attachment; filename="pulso-centros-${from}_${to}.xlsx"`);
      return reply.send(Buffer.from(await book.xlsx.writeBuffer()));
    }
    catch (error) { if (error instanceof Error && error.message === "INVALID_DATE") return reply.code(400).send({ error: "INVALID_SERVICE_DATA" }); throw error; }
  });
}
