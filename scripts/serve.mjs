import net from "node:net";
import { createServer, preview } from "vite";

const isPreview = process.argv.includes("--preview");
let port = isPreview ? 4174 : 5174;
async function available(candidate) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(candidate, "127.0.0.1", () =>
      probe.close(() => resolve(true)),
    );
  });
}
while (!(await available(port))) port++;
const server = isPreview
  ? await preview({ preview: { host: "127.0.0.1", port, strictPort: true } })
  : await createServer({
      server: { host: "127.0.0.1", port, strictPort: true },
    });
if (!isPreview) await server.listen();
server.printUrls();
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (isPreview)
    await new Promise((resolve) => server.httpServer.close(resolve));
  else await server.close();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
