import path from "node:path";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const repoRoot = process.cwd();
const serverPath = path.join(repoRoot, "apps", "mcp-server", "dist", "src", "index.js");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: repoRoot,
  stderr: "pipe",
});
const client = new Client({ name: "wow-forever-smoke-test", version: "0.1.0" });

try {
  await client.connect(transport);
  const [tools, resources, status] = await Promise.all([
    client.listTools(),
    client.listResources(),
    client.callTool({ name: "wow_status", arguments: {} }),
  ]);
  console.log(JSON.stringify({
    tools: tools.tools.map((tool) => tool.name),
    resources: resources.resources.map((resource) => resource.uri),
    status: status.structuredContent,
  }, null, 2));
} finally {
  await client.close();
}

