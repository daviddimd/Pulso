import "dotenv/config";
import argon2 from "argon2";
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
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("Iniciando seed de Pulso...");

  const adminPassword = await argon2.hash(
    "PulsoAdminDemo#2026",
    {
      type: argon2.argon2id,
    },
  );

  await prisma.user.upsert({
    where: {
      username: "admin",
    },
    update: {
      fullName: "Marcela Sepúlveda",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      active: true,
    },
    create: {
      username: "admin",
      fullName: "Marcela Sepúlveda",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const driverPassword = await argon2.hash(
    "PulsoChoferDemo#2026",
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

  for (const driver of drivers) {
    await prisma.user.upsert({
      where: {
        username: driver.username,
      },
      update: {
        fullName: driver.fullName,
        passwordHash: driverPassword,
        role: UserRole.DRIVER,
        active: true,
      },
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

  for (const vehicle of vehicles) {
    await prisma.vehicle.upsert({
      where: {
        roleCode: vehicle.roleCode,
      },
      update: {
        licensePlate: vehicle.licensePlate,
        currentOdometerKm: vehicle.currentOdometerKm,
        active: true,
      },
      create: vehicle,
    });
  }

  console.log("Seed completado.");
  console.log("1 administrador");
  console.log("10 choferes");
  console.log("8 ambulancias ficticias");
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