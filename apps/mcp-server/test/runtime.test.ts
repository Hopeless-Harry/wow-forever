import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { findProjectRoot } from "../src/runtime.js";

test("finds the project root from compiled or source nesting", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wow-mcp-root-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const nested = path.join(root, "apps", "mcp-server", "dist", "src");
  await mkdir(nested, { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "wow-forever-platform" }));

  assert.equal(await findProjectRoot(nested), root);
});

test("fails clearly when started outside the project", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wow-mcp-missing-root-"));
  context.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(() => findProjectRoot(root), /project root/i);
});
