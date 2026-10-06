import "dotenv/config";
import argon2 from "argon2";
import { importInstitutionalVehicles } from "./vehicle-catalog";
import { importCostCenters, importDrivers } from "./import-institutional";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  UserRole,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida");
}

const adapter = new PrismaPg({
  connectionString,
}, { schema: process.env.PULSO_TEST_SCHEMA ?? "public" });

if (process.env.NODE_ENV === "production" || !["/pulso_dev", "/pulso_test"].includes(new URL(connectionString).pathname)) {
  throw new Error("La semilla de demostración solo se permite en pulso_dev o pulso_test.");
}

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const testFixtures = process.env.NODE_ENV === "test" && !!process.env.PULSO_TEST_SCHEMA && process.env.PULSO_PROTOTYPE !== "1";
  await importCostCenters(prisma);
  console.log("Iniciando seed de Pulso...");

  const adminPassword = await argon2.hash(
    "admin",
    {
      type: argon2.argon2id,
    },
  );

  await prisma.user.upsert({
    where: {
      username: "admin",
    },
    update: {},
    create: {
      username: "admin",
      fullName: "Marcela Sepúlveda",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const driverPassword = await argon2.hash(
    "chofer",
    {
      type: argon2.argon2id,
    },
  );

  const drivers = [
    {
      username: "chofer01",
      fullName: "Mauricio Rojas",
    },
    {
      username: "chofer02",
      fullName: "Rodrigo González",
    },
    {
      username: "chofer03",
      fullName: "Cristian Muñoz",
    },
    {
      username: "chofer04",
      fullName: "Francisco Tapia",
    },
    {
      username: "chofer05",
      fullName: "Luis Contreras",
    },
    {
      username: "chofer06",
      fullName: "Jorge Valdés",
    },
    {
      username: "chofer07",
      fullName: "Patricio Morales",
    },
    {
      username: "chofer08",
      fullName: "Héctor Aravena",
    },
    {
      username: "chofer09",
      fullName: "Claudio Fuentes",
    },
    {
      username: "chofer10",
      fullName: "Sergio Bustamante",
    },
  ];

  for (const driver of testFixtures ? drivers : []) {
    await prisma.user.upsert({
      where: {
        username: driver.username,
      },
      update: {},
      create: {
        username: driver.username,
        fullName: driver.fullName,
        passwordHash: driverPassword,
        role: UserRole.DRIVER,
      },
    });
  }

  const vehicles = [
    {
      roleCode: "101",
      licensePlate: "LRXZ21",
      currentOdometerKm: 124500,
    },
    {
      roleCode: "102",
      licensePlate: "PKGH34",
      currentOdometerKm: 87320,
    },
    {
      roleCode: "103",
      licensePlate: "JLTD67",
      currentOdometerKm: 201450,
    },
    {
      roleCode: "104",
      licensePlate: "RBFP82",
      currentOdometerKm: 54100,
    },
    {
      roleCode: "105",
      licensePlate: "KXWP45",
      currentOdometerKm: 98640,
    },
    {
      roleCode: "106",
      licensePlate: "SGDY19",
      currentOdometerKm: 156220,
    },
    {
      roleCode: "107",
      licensePlate: "HTLC73",
      currentOdometerKm: 72310,
    },
    {
      roleCode: "108",
      licensePlate: "FVNR56",
      currentOdometerKm: 183900,
    },
  ];

  if (!testFixtures) console.log(await importDrivers(prisma));
  for (const vehicle of testFixtures ? vehicles : []) {
    await prisma.vehicle.upsert({
      where: {
        roleCode: vehicle.roleCode,
      },
      update: {},
      create: vehicle,
    });
  }

  if (!testFixtures) console.log(await importInstitutionalVehicles(prisma));
  console.log("Seed completado.");
  console.log("1 administrador");
  console.log(testFixtures ? "10 choferes de prueba" : "9 choferes de la nómina institucional");
  console.log(testFixtures ? "8 vehículos ficticios para pruebas automatizadas" : "8 vehículos del catálogo proporcionado; registrar kilometraje inicial desde administración");
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
