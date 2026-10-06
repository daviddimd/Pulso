import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || new URL(connectionString).pathname !== "/pulso_dev" || process.env.NODE_ENV === "production" || process.env.PULSO_TEST_SCHEMA) {
  throw new Error("Este cambio de claves solo se permite en el prototipo pulso_dev/public.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
async function main() {
  const [adminHash, driverHash] = await Promise.all([
    argon2.hash("admin", { type: argon2.argon2id }),
    argon2.hash("chofer", { type: argon2.argon2id }),
  ]);
  const result = await prisma.$transaction(async tx => {
    const users = await tx.user.findMany({ where: { OR: [{ username: "admin", role: "ADMIN" }, { role: "DRIVER" }] }, select: { id: true, role: true } });
    for (const user of users) await tx.user.update({ where: { id: user.id }, data: { passwordHash: user.role === "ADMIN" ? adminHash : driverHash, failedLoginAttempts: 0, lockedUntil: null } });
    await tx.session.updateMany({ where: { userId: { in: users.map(u => u.id) }, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { entityType: "MAINTENANCE", entityId: "prototype-passwords", action: "RESET_PROTOTYPE_PASSWORDS", afterData: { userIds: users.map(u => u.id) } } });
    return { administrators: users.filter(u => u.role === "ADMIN").length, drivers: users.filter(u => u.role === "DRIVER").length };
  });
  const users = await prisma.user.findMany({ where: { OR: [{ username: "admin", role: "ADMIN" }, { role: "DRIVER" }] } });
  for (const user of users) if (!await argon2.verify(user.passwordHash, user.role === "ADMIN" ? "admin" : "chofer")) throw new Error("No se pudo verificar la clave de " + user.username);
  console.log("Claves actualizadas y verificadas:", result);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
