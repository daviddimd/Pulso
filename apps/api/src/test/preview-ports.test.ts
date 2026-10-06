import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { assertPortAvailable } from "./preview-ports";

test("informa un puerto ocupado y permite reutilizarlo después del cierre", async () => {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await assert.rejects(assertPortAvailable(address.port, "127.0.0.1"), /ya está ocupado/);
    assert.equal(server.listening, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  await assertPortAvailable(address.port, "127.0.0.1");
  await assertPortAvailable(address.port, "127.0.0.1");
});
