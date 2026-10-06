import dotenv from "dotenv";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { assertPreviewPortsAvailable } from "./preview-ports";

dotenv.config({ path: ".env.test", override: true, quiet: true });
const url = process.env.DATABASE_URL;
if (!url || new URL(url).pathname !== "/pulso_test") throw new Error("La base de pruebas debe ser pulso_test.");
const schema = "pulso_test_" + randomUUID().replaceAll("-", "");
const client = new Client({ connectionString: url });
process.on("SIGINT", () => {});
async function run(args: string[]) {
  const child = spawn(process.execPath, ["--import", "tsx", ...args], {
    stdio: "inherit", env: { ...process.env, NODE_ENV: "test", PULSO_TEST_SCHEMA: schema, PULSO_PROTOTYPE: process.argv.includes("--preview") ? "1" : "0" },
  });
  return new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(
      process.argv.includes("--preview") ? "No se pudo iniciar el prototipo; revisa el mensaje anterior." : "Pruebas fallidas: " + code,
    )));
  });
}
async function main() {
  if (process.argv.includes("--preview")) await assertPreviewPortsAvailable();
  await client.connect();
  try {
    await client.query('CREATE SCHEMA "' + schema + '"');
    await client.query('SET search_path TO "' + schema + '"');
    const legacyUser = randomUUID();
    const legacyVehicle = randomUUID();
    const legacyIds = [randomUUID(), randomUUID(), randomUUID()];
    for (const name of (await readdir("prisma/migrations")).sort()) {
      if (!/^\d/.test(name)) continue;
      if (name === "20260926000100_service_states") {
        await client.query('INSERT INTO users (id, username, full_name, password_hash, role, updated_at) VALUES ($1,$2,$2,$2,$3,now())', [legacyUser, "migration_fixture", "DRIVER"]);
        await client.query('INSERT INTO vehicles (id, role_code, license_plate, current_odometer_km, updated_at) VALUES ($1,$2,$2,123,now())', [legacyVehicle, "MIGRATION"]);
        for (const [i, status] of ["OPEN", "COMPLETED", "VOIDED"].entries()) {
          await client.query("INSERT INTO bitacora_entries (id, driver_id, vehicle_id, status, service_address, action_performed, odometer_km, ended_at, updated_at, started_at) VALUES ($1,$2,$3,$4,'Destino histórico','Actividad histórica',$5,$6,now(),now() - interval '1 hour')",
            [legacyIds[i], legacyUser, legacyVehicle, status, status === "COMPLETED" ? 120 : null, status === "COMPLETED" ? new Date() : null]);
        }
      }
      await client.query(await readFile(path.join("prisma/migrations", name, "migration.sql"), "utf8"));
    }
    const migrated = await client.query('SELECT id, status, origin FROM bitacora_entries WHERE driver_id = $1', [legacyUser]);
    assert.equal(migrated.rows.find(r => r.id === legacyIds[0]).status, "IN_PROGRESS");
    assert.equal(migrated.rows.find(r => r.id === legacyIds[1]).status, "COMPLETED");
    assert.equal(migrated.rows.find(r => r.id === legacyIds[2]).status, "CANCELLED");
    const history = await client.query('SELECT * FROM service_address_revisions WHERE service_id = ANY($1::uuid[])', [legacyIds]);
    assert.equal(history.rowCount, 3);
    assert.ok(history.rows.every(r => r.actor_user_id === null && r.source === "LEGACY"));
    const legs = await client.query('SELECT * FROM service_legs WHERE service_id = ANY($1::uuid[])', [legacyIds]);
    assert.equal(legs.rowCount, 2);
    assert.ok(legs.rows.every(r => r.departure_odometer_km === null));
    assert.equal(legs.rows.filter(r => r.ended_at === null).length, 1);
    await client.query('DELETE FROM bitacora_entries WHERE driver_id = $1', [legacyUser]);
    await client.query('DELETE FROM users WHERE id = $1', [legacyUser]);
    await client.query('DELETE FROM vehicles WHERE id = $1', [legacyVehicle]);
    console.log("Migración histórica verificada: estados, direcciones y kilometrajes desconocidos preservados.");
    await run(["prisma/seed.ts"]);
    if (process.argv.includes("--preview")) {
      await run(["prisma/demo-data.ts"]);
      await run(["src/test/preview.ts"]);
      return;
    }
    const tests = (await readdir("src/test/integration")).filter(f => f.endsWith(".test.ts")).map(f => "src/test/integration/" + f);
    await run(["--test", "--test-concurrency=1", ...tests]);
  } finally {
    await client.query("ROLLBACK");
    if (!/^pulso_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Esquema temporal inválido.");
    await client.query('DROP SCHEMA "' + schema + '" CASCADE');
    await client.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
