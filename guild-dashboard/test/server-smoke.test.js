import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

async function waitUntilReady(port, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
      if (response.status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("server did not become ready in time");
}

test("the real server entry point boots in fixture mode, serves every page, persists data and shuts down cleanly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "smoke-"));
  const port = 3300 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: root,
    env: { ...process.env, USE_FIXTURE: "true", NODE_ENV: "development", HOST: "127.0.0.1", PORT: String(port), CACHE_PATH: path.join(dir, "cache.json"), MEMBER_PATH: path.join(dir, "members.json"), RATE_LIMIT_PER_MINUTE: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  try {
    await waitUntilReady(port, child);
    const base = `http://127.0.0.1:${port}`;
    for (const url of ["/", "/responses", "/statistics", "/raid", "/members", "/members/chronicle", "/members/professions", "/members.csv", "/api/public-data", "/assets/styles.css", "/assets/countdown.js", "/assets/table-filters.js", "/assets/live-refresh.js"]) {
      const response = await fetch(base + url);
      assert.equal(response.status, 200, url);
    }
    assert.match(await (await fetch(`${base}/members`)).text(), /Fixture Priest/);
    assert.equal((await fetch(`${base}/member?name=nobody`)).status, 404);

    const cache = JSON.parse(await readFile(path.join(dir, "cache.json"), "utf8"));
    assert.equal(cache.records.length, 3);
    assert.equal(JSON.stringify(cache).includes("Fixture Priest"), false, "the anonymous cache never holds names");
    assert.equal((await stat(path.join(dir, "members.json"))).mode & 0o777, 0o600);
    const members = JSON.parse(await readFile(path.join(dir, "members.json"), "utf8"));
    assert.equal(members.members.length, 3);
  } finally {
    child.kill("SIGTERM");
  }

  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve("timeout"); }, 5000);
    child.on("exit", (exitCode) => { clearTimeout(timer); resolve(exitCode); });
  });
  assert.equal(code, 0, `server should exit 0 on SIGTERM; output: ${output.slice(-400)}`);
});
