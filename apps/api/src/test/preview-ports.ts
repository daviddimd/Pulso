import { createServer } from "node:net";

export function assertPortAvailable(port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      reject(error.code === "EADDRINUSE"
        ? new Error(`El puerto ${port} ya está ocupado. Si Pulso está abierto, usa http://localhost:5177. Para reiniciarlo, pulsa Enter en la terminal de la instancia anterior y vuelve a ejecutar el comando. No se han creado datos de prueba.`)
        : error);
    });
    server.listen({ port, host, exclusive: true }, () => server.close(error => error ? reject(error) : resolve()));
  });
}

export async function assertPreviewPortsAvailable() {
  await assertPortAvailable(3107, "127.0.0.1");
  await assertPortAvailable(5177, "localhost");
}
