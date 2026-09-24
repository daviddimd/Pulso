import { buildApp } from "./app";
import { prisma } from "./lib/prisma";
import { env } from "./config/env";

const app = buildApp();

async function start() {
  try {
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  app.log.info(
    { signal },
    "Cerrando Pulso de forma segura",
  );

  try {
    await app.close();
    await prisma.$disconnect();

    process.exit(0);
  } catch (error) {
    app.log.error(
      error,
      "Error durante el cierre de Pulso",
    );

    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void start();