import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { resolveWowPaths } from "@wow-forever/core";

import { createWowMcpServer } from "../src/server.js";

async function fixture(): Promise<{ base: string; repoRoot: string; clientRoot: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), "wow-mcp-"));
  const repoRoot = path.join(base, "repo");
  const clientRoot = path.join(base, "World of Warcraft", "_classic_beta_");
  await mkdir(path.join(repoRoot, "addons"), { recursive: true });
  await mkdir(path.join(clientRoot, "Interface", "AddOns", "Auctionator"), { recursive: true });
  await mkdir(path.join(clientRoot, "Logs"), { recursive: true });
  await mkdir(path.join(clientRoot, "WTF"), { recursive: true });
  await writeFile(path.join(clientRoot, "WowB.exe"), "fixture");
  await writeFile(path.join(clientRoot, ".flavor.info"), "Product Flavor!STRING:0\nwow_classic_beta\n");
  await writeFile(
    path.join(clientRoot, "..", ".build.info"),
    "Branch!STRING:0|Version!STRING:0|Product!STRING:0\nus|1.60.1.69913|wow_classic_beta\n",
  );
  await writeFile(path.join(clientRoot, "WTF", "Config.wtf"), 'SET engineSurveyPatch "16001"\n');
  await writeFile(
    path.join(clientRoot, "Interface", "AddOns", "Auctionator", "Auctionator.toc"),
    "## Interface: 16001\n## Title: Auctionator\n## Version: 338\n",
  );
  await writeFile(path.join(clientRoot, "Logs", "FrameXML.log"), "clean\n");
  return { base, repoRoot, clientRoot };
}

test("lists focused WoW resources and tools and returns redacted client data", async (context) => {
  const data = await fixture();
  context.after(() => rm(data.base, { recursive: true, force: true }));
  const server = createWowMcpServer({
    paths: resolveWowPaths(data.clientRoot),
    repoRoot: data.repoRoot,
    backupRoot: path.join(data.repoRoot, "backups"),
  });
  const client = new Client({ name: "wow-mcp-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  context.after(async () => {
    await client.close();
    await server.close();
  });

  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [
      "wow_install_project_addon",
      "wow_list_addons",
      "wow_read_log",
      "wow_restore_addon_backup",
      "wow_saved_variables",
      "wow_status",
    ],
  );
  const resources = await client.listResources();
  assert.deepEqual(
    resources.resources.map((resource) => resource.uri).sort(),
    ["wow://addons", "wow://client/status", "wow://logs/framexml"],
  );

  const status = await client.callTool({ name: "wow_status", arguments: {} });
  assert.equal(status.isError, undefined);
  assert.equal((status.structuredContent as { product: string }).product, "wow_classic_beta");
  const addons = await client.readResource({ uri: "wow://addons" });
  const addonContent = addons.contents[0];
  assert.equal("text" in addonContent!, true);
  assert.match(addonContent && "text" in addonContent ? addonContent.text : "", /Auctionator/u);
});

test("rejects unapproved logs and protects Auctionator", async (context) => {
  const data = await fixture();
  context.after(() => rm(data.base, { recursive: true, force: true }));
  const server = createWowMcpServer({
    paths: resolveWowPaths(data.clientRoot),
    repoRoot: data.repoRoot,
    backupRoot: path.join(data.repoRoot, "backups"),
  });
  const client = new Client({ name: "wow-mcp-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  context.after(async () => {
    await client.close();
    await server.close();
  });

  const invalidLog = await client.callTool({
    name: "wow_read_log",
    arguments: { name: "../../secret.txt" },
  });
  assert.equal(invalidLog.isError, true);
  assert.match(
    invalidLog.content[0]?.type === "text" ? invalidLog.content[0].text : "",
    /invalid|allowed/i,
  );
  const protectedResult = await client.callTool({
    name: "wow_install_project_addon",
    arguments: { addonName: "Auctionator" },
  });
  assert.equal(protectedResult.isError, true);
  assert.match(protectedResult.content[0]?.type === "text" ? protectedResult.content[0].text : "", /protected/i);
});
