#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { resolveWowPaths } from "@wow-forever/core";

import { createWowMcpServer } from "./server.js";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

serveStdio(
  () => createWowMcpServer({ paths: resolveWowPaths(), repoRoot }),
  { onerror: (error) => console.error(`WoW Forever MCP error: ${error.message}`) },
);
