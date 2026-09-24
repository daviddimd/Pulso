import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

type AuditAction = {
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string | null;
};

function toJson(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

export async function createAuditLog(
  data: AuditAction,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;

  const beforeData = toJson(data.beforeData);
  const afterData = toJson(data.afterData);

  await client.auditLog.create({
    data: {
      actorUserId: data.actorUserId ?? null,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      ipAddress: data.ipAddress ?? null,

      ...(beforeData !== undefined
        ? { beforeData }
        : {}),

      ...(afterData !== undefined
        ? { afterData }
        : {}),
    },
  });
}