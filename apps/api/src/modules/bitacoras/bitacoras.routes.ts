import type { FastifyInstance } from "fastify";

import {
  BitacoraStatus,
  UserRole,
} from "../../generated/prisma/client";

import { requireRole } from "../../common/auth";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../audit/audit.service";
import {
  startBitacoraSchema,
  finalizeBitacoraSchema,
  finalizeBitacoraParamsSchema,
} from "./bitacoras.schemas";

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function bitacoraRoutes(app: FastifyInstance) {
  app.post("/", async (request, reply) => {
    const user = await requireRole(
      request,
      reply,
      UserRole.DRIVER,
    );

    if (!user) {
      return;
    }

    const parsed =
      startBitacoraSchema.safeParse(
        request.body,
      );

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_BITACORA_DATA",
      });
    }

    const body = parsed.data;

    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: body.vehicleId,
      },
    });

    if (!vehicle || !vehicle.active) {
      return reply.code(404).send({
        error: "VEHICULO_NO_DISPONIBLE",
      });
    }

    const driverOpenEntry =
      await prisma.bitacoraEntry.findFirst({
        where: {
          driverId: user.id,
          status: BitacoraStatus.OPEN,
        },
      });

    if (driverOpenEntry) {
      return reply.code(409).send({
        error: "EL_CHOFER_YA_COMENZO_EL_SERVICIO",
      });
    }

    const vehicleOpenEntry =
      await prisma.bitacoraEntry.findFirst({
        where: {
          vehicleId: vehicle.id,
          status: BitacoraStatus.OPEN,
        },
      });

    if (vehicleOpenEntry) {
      return reply.code(409).send({
        error: "EL_VEHICULO_YA_ESTA_EN_USO",
      });
    }

    try {
      const entry = await prisma.$transaction(
        async (tx) => {
          const createdEntry =
            await tx.bitacoraEntry.create({
              data: {
                driverId: user.id,
                vehicleId: vehicle.id,

                serviceAddress:
                  body.serviceAddress,

                actionPerformed:
                  body.actionPerformed,

                status: BitacoraStatus.OPEN,
              },

              include: {
                vehicle: {
                  select: {
                    roleCode: true,
                    licensePlate: true,
                  },
                },
              },
            });

          await createAuditLog(
            {
              actorUserId: user.id,
              entityType: "BITACORA",
              entityId: createdEntry.id,
              action: "CREATE",
              afterData: createdEntry,
              ipAddress: request.ip,
            },
            tx,
          );

          return createdEntry;
        },
      );

      return reply.code(201).send({
        entry,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return reply.code(409).send({
          error: "CONFLICTO_DE_SERVICIO_ACTIVO",
        });
      }

      throw error;
    }
  });

  app.patch("/:id/finalize", async (request, reply) => {
    const user = await requireRole(
      request,
      reply,
      UserRole.DRIVER,
    );

    if (!user) {
      return;
    }

    const parsedParams =
      finalizeBitacoraParamsSchema.safeParse(
        request.params,
      );

    if (!parsedParams.success) {
      return reply.code(400).send({
        error: "INVALID_ENTRY_ID",
      });
    }

    const params = parsedParams.data;

    const parsed =
      finalizeBitacoraSchema.safeParse(
        request.body,
      );

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_ODOMETER",
      });
    }

    const body = parsed.data;

    const result = await prisma.$transaction(
      async (tx) => {
        const entry =
          await tx.bitacoraEntry.findUnique({
            where: {
              id: params.id,
            },

            include: {
              vehicle: true,
            },
          });

        if (!entry) {
          return {
            error: "ENTRY_NOT_FOUND" as const,
          };
        }

        if (entry.driverId !== user.id) {
          return {
            error: "FORBIDDEN" as const,
          };
        }

        if (entry.status !== BitacoraStatus.OPEN) {
          return {
            error: "ENTRY_NOT_OPEN" as const,
          };
        }

        if (
          entry.vehicle.currentOdometerKm !== null &&
          body.odometerKm <
            entry.vehicle.currentOdometerKm
        ) {
          return {
            error: "ODOMETER_BELOW_CURRENT" as const,
            currentOdometerKm:
              entry.vehicle.currentOdometerKm,
          };
        }

        const updatedEntry =
          await tx.bitacoraEntry.update({
            where: {
              id: entry.id,
            },

            data: {
              status: BitacoraStatus.COMPLETED,
              endedAt: new Date(),
              odometerKm: body.odometerKm,
            },

            include: {
              vehicle: {
                select: {
                  roleCode: true,
                  licensePlate: true,
                },
              },
            },
          });

        await tx.vehicle.update({
          where: {
            id: entry.vehicleId,
          },

          data: {
            currentOdometerKm:
              body.odometerKm,
          },
        });

        await createAuditLog(
          {
            actorUserId: user.id,
            entityType: "BITACORA",
            entityId: entry.id,
            action: "FINALIZE",
            beforeData: entry,
            afterData: updatedEntry,
            ipAddress: request.ip,
          },
          tx,
        );

        return {
          entry: updatedEntry,
        };
      },
    );

    if ("error" in result) {
      if (result.error === "ENTRY_NOT_FOUND") {
        return reply.code(404).send(result);
      }

      if (result.error === "FORBIDDEN") {
        return reply.code(403).send(result);
      }

      return reply.code(409).send(result);
    }

    return reply.code(200).send(result);
  });

  app.get("/mine", async (request, reply) => {
    const user = await requireRole(
      request,
      reply,
      UserRole.DRIVER,
    );

    if (!user) {
      return;
    }

    const entries = await prisma.bitacoraEntry.findMany({
      where: {
        driverId: user.id,
      },

      orderBy: {
        startedAt: "desc",
      },

      include: {
        vehicle: {
          select: {
            roleCode: true,
            licensePlate: true,
          },
        },
      },
    });

    return {
      entries,
    };
  });
}