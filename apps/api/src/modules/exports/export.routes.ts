import type { FastifyInstance } from "fastify";

import { UserRole } from "../../generated/prisma/client";
import { requireRole } from "../../common/auth";
import { buildDailyBitacoraWorkbook } from "./export.service";
import { dailyExportQuerySchema } from "./export.schemas";
export async function exportRoutes(app: FastifyInstance) {
  app.get("/daily", async (request, reply) => {
    const user = await requireRole(
      request,
      reply,
      UserRole.ADMIN,
    );

    if (!user) {
      return;
    }

    const rawQuery =
      request.query as Record<string, unknown>;

    const parsedQuery =
      dailyExportQuerySchema.safeParse(
        rawQuery,
      );

    if (!parsedQuery.success) {
      if (!("date" in rawQuery)) {
        return reply.code(400).send({
          error: "DATE_REQUIRED",
        });
      }

      return reply.code(400).send({
        error: "INVALID_EXPORT_QUERY",
      });
    }

    const query = parsedQuery.data;

    try {
      const workbook =
        await buildDailyBitacoraWorkbook(
          query.date,
        );

      const buffer =
        await workbook.xlsx.writeBuffer();

      reply.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      reply.header(
        "Content-Disposition",
        `attachment; filename="pulso-bitacora-${query.date}.xlsx"`,
      );

      return reply.send(
        Buffer.from(buffer),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "INVALID_DATE"
      ) {
        return reply.code(400).send({
          error: "INVALID_DATE",
        });
      }

      throw error;
    }
  });
}