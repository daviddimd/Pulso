import type { FastifyInstance } from "fastify";
import argon2 from "argon2";

import { prisma } from "../../lib/prisma";
import { getAuthenticatedUser } from "../../common/auth";
import { env } from "../../config/env";
import { loginSchema } from "./auth.schemas";

import {
  createSessionToken,
  hashSessionToken,
} from "../../lib/security";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 15;

export async function authRoutes(app: FastifyInstance) {


  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_LOGIN_DATA" });
    }

    const body = parsed.data;
    const username = body.username.toLowerCase();

      const user =
        await prisma.user.findUnique({
          where: {
            username,
          },
        });

      if (!user || !user.active) {
        return reply.code(401).send({
          error: "INVALID_CREDENTIALS",
        });
      }

      if (
        user.lockedUntil &&
        user.lockedUntil > new Date()
      ) {
        return reply.code(423).send({
          error: "ACCOUNT_TEMPORARILY_LOCKED",
        });
      }

      const validPassword =
        await argon2.verify(
          user.passwordHash,
          body.password,
        );

      if (!validPassword) {
        const attempts =
          user.failedLoginAttempts + 1;

        const shouldLock =
          attempts >= MAX_LOGIN_ATTEMPTS;

        await prisma.user.update({
          where: {
            id: user.id,
          },

          data: {
            failedLoginAttempts:
              shouldLock ? 0 : attempts,

            lockedUntil:
              shouldLock
                ? new Date(
                    Date.now() +
                      LOCK_TIME_MINUTES *
                        60 *
                        1000,
                  )
                : null,
          },
        });

        return reply.code(401).send({
          error: "INVALID_CREDENTIALS",
        });
      }


      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      const token =
        createSessionToken();

      const tokenHash =
        hashSessionToken(token);

      const expiresAt =
        new Date(
          Date.now() +
            env.SESSION_TTL_HOURS *
              60 *
              60 *
              1000,
        );

      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      reply.setCookie(
        env.SESSION_COOKIE_NAME,
        token,
        {
          httpOnly: true,
          secure:
            env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          expires: expiresAt,
        },
      );

      return {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
      };
    },
  );

  app.get("/me", async (request, reply) => {
    const user =
      await getAuthenticatedUser(request);

    if (!user) {
      return reply.code(401).send({
        error: "UNAUTHENTICATED",
      });
    }

    return {
      user,
    };
  });

  app.post("/logout", async (request, reply) => {
    const token =
      request.cookies[
        env.SESSION_COOKIE_NAME
      ];

    if (token) {
      const tokenHash =
        hashSessionToken(token);

      await prisma.session.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      });
    }

    reply.clearCookie(
      env.SESSION_COOKIE_NAME,
      {
        path: "/",
      },
    );

    return reply.code(204).send();
  });
}