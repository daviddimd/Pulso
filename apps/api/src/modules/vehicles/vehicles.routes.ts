import type { FastifyInstance } from "fastify";

import { getAuthenticatedUser } from "../../common/auth";
import { prisma } from "../../lib/prisma";

export async function vehicleRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return reply.code(401).send({
        error: "UNAUTHENTICATED",
      });
    }

    const vehicles = await prisma.vehicle.findMany({
      where: {
        active: true,
      },

      orderBy: {
        roleCode: "asc",
      },

      select: {
        id: true,
        roleCode: true,
        licensePlate: true,
        currentOdometerKm: true,
      },
    });

    return {
      vehicles,
    };
  });
}