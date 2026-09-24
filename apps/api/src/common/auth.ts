import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { UserRole } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { hashSessionToken } from "../lib/security";

export async function getAuthenticatedUser(
  request: FastifyRequest,
) {
  const token =
    request.cookies[env.SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const tokenHash =
    hashSessionToken(token);

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash,
      },

      include: {
        user: true,
      },
    });

  if (!session) {
    return null;
  }

  if (session.revokedAt) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    return null;
  }

  if (!session.user.active) {
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    fullName: session.user.fullName,
    role: session.user.role,
  };
}

export async function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  requiredRole: UserRole,
) {
  const user =
    await getAuthenticatedUser(request);

  if (!user) {
    reply.code(401).send({
      error: "UNAUTHENTICATED",
    });

    return null;
  }

  if (user.role !== requiredRole) {
    reply.code(403).send({
      error: "FORBIDDEN",
    });

    return null;
  }

  return user;
}