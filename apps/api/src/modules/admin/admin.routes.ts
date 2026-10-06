import type { FastifyInstance } from "fastify";

import {
  UserRole,
} from "../../generated/prisma/client";

import { requireRole } from "../../common/auth";
import { prisma } from "../../lib/prisma";
import { DateTime } from "luxon";

import {
  adminBitacorasQuerySchema,
  adminOverviewQuerySchema,
} from "./admin.schemas";

export async function adminRoutes(app: FastifyInstance) {
  
  

  app.get("/drivers", async (request, reply) => {
    const user = await requireRole(
      request,
      reply,
      UserRole.ADMIN,
    );

    if (!user) {
      return;
    }

    const drivers = await prisma.user.findMany({
      where: {
        role: UserRole.DRIVER,
        active: true,
      },

      orderBy: {
        fullName: "asc",
      },

      select: {
        id: true,
        username: true,
        fullName: true,
        serviceLegs: { where: { endedAt: null }, select: { serviceId: true } },
      },
    });

    return {
      drivers,
    };
  });

  app.get("/bitacoras", async (request, reply) => {
    const user = await requireRole(
      request,
      reply,
      UserRole.ADMIN,
    );

    if (!user) {
      return;
    }

    const parsedQuery =
      adminBitacorasQuerySchema.safeParse(
        request.query,
      );

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "INVALID_ADMIN_QUERY",
      });
    }

    const query = parsedQuery.data;

    let dateFilter = {};

    if (query.date) {
      const startOfDay = DateTime.fromISO(
        query.date,
        {
          zone: "America/Santiago",
        },
      ).startOf("day");

      if (!startOfDay.isValid) {
        return reply.code(400).send({
          error: "INVALID_DATE",
        });
      }

      const endOfDay =
        startOfDay.plus({ days: 1 });

      dateFilter = {
        startedAt: {
          gte: startOfDay.toUTC().toJSDate(),
          lt: endOfDay.toUTC().toJSDate(),
        },
      };
    }

    const entries =
      await prisma.bitacoraEntry.findMany({
        where: {
          ...(query.driverId
            ? {
                driverId: query.driverId,
              }
            : {}),

          ...dateFilter,
        },

        include: {
          driver: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },

          vehicle: {
            select: {
              id: true,
              roleCode: true,
              licensePlate: true,
            },
          },
        },

        orderBy: {
          startedAt: "desc",
        },

        take: 500,
      });

    return {
      entries,
    };
  });

  app.get("/overview", async (request, reply) => {
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
      adminOverviewQuerySchema.safeParse(
        rawQuery,
      );

    if (!parsedQuery.success) {
      if (!("date" in rawQuery)) {
        return reply.code(400).send({
          error: "DATE_REQUIRED",
        });
      }

      return reply.code(400).send({
        error: "INVALID_ADMIN_QUERY",
      });
    }

    const query = parsedQuery.data;

    const startOfDay = DateTime.fromISO(
      query.date,
      {
        zone: "America/Santiago",
      },
    ).startOf("day");

    if (!startOfDay.isValid) {
      return reply.code(400).send({
        error: "INVALID_DATE",
      });
    }

    const endOfDay =
      startOfDay.plus({ days: 1 });

    const drivers = await prisma.user.findMany({
      where: {
        role: UserRole.DRIVER,
        active: true,
      },

      orderBy: {
        fullName: "asc",
      },

      select: {
        id: true,
        username: true,
        fullName: true,

        bitacoras: {
          where: {
            OR: [
              { startedAt: { gte: startOfDay.toUTC().toJSDate(), lt: endOfDay.toUTC().toJSDate() } },
              { status: "IN_PROGRESS" },
              { closurePending: true },
            ],
          },

          orderBy: {
            startedAt: "desc",
          },

          include: {
            vehicle: {
              select: {
                id: true,
                roleCode: true,
                licensePlate: true,
              },
            },
          },
        },
      },
    });

    return {
      date: query.date,
      drivers,
    };
  });
}
