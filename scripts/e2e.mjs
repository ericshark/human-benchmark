import net from "node:net";
import { spawn } from "node:child_process";
import { createServer, preview } from "vite";
const production = process.argv.includes("--production");
const argumentsForTests = process.argv
  .slice(2)
  .filter((argument) => argument !== "--production");
async function available(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}
let port = production ? 4174 : 5174;
while (!(await available(port))) port++;
const server = production
  ? await preview({ preview: { host: "127.0.0.1", port, strictPort: true } })
  : await createServer({
      server: { host: "127.0.0.1", port, strictPort: true },
    });
if (!production) await server.listen();
const child = spawn(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...argumentsForTests],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PW_HEADLESS: "true",
      HUMANRANK_TEST_URL: `http://127.0.0.1:${port}`,
    },
  },
);
const interrupt = () => child.kill("SIGTERM");
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
let exitCode;
let released;
try {
  exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
  if (production)
    await new Promise((resolve) => server.httpServer.close(resolve));
  else await server.close();
  released = await available(port);
}
if (!released) throw new Error(`Test server port ${port} was not released.`);
process.exitCode = exitCode;
