import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

async function main() {
  if (!process.env.PULSO_TEST_SCHEMA?.startsWith("pulso_test_")) throw new Error("El prototipo requiere el esquema aislado.");
  process.env.WEB_ORIGIN = "http://localhost:5177";
  const { buildApp } = await import("../app.js");
  const { prisma } = await import("../lib/prisma.js");
  const app = buildApp();
  let web: ChildProcess | undefined;
  try {
    await app.listen({ port: 3107, host: "127.0.0.1" });
    web = spawn(process.execPath, [path.resolve("../web/node_modules/vite/bin/vite.js"), "--host", "localhost", "--port", "5177", "--strictPort"], {
      cwd: path.resolve("../web"), windowsHide: true, stdio: "inherit",
      env: { ...process.env, NODE_ENV: "development", VITE_API_URL: "http://localhost:3107" },
    });
    console.log("Prototipo temporal: http://localhost:5177 · Pulsa Enter para cerrarlo y eliminar sus datos.");
    await new Promise<void>((resolve, reject) => {
      const finish = () => { process.stdin.pause(); resolve(); };
      process.stdin.resume();
      process.stdin.once("data", finish);
      process.once("SIGINT", finish);
      process.once("SIGTERM", finish);
      web!.once("error", error => { process.stdin.pause(); reject(error); });
      web!.once("exit", code => {
        if (code && code !== 0) { process.stdin.pause(); reject(new Error("El frontend no pudo iniciarse. Revisa si el puerto 5177 está ocupado.")); }
        else finish();
      });
    });
  } finally {
    if (web?.pid && web.exitCode === null && web.signalCode === null) {
      const stopped = new Promise<void>(resolve => web!.once("exit", () => resolve()));
      web.kill();
      await stopped;
    }
    await app.close();
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
