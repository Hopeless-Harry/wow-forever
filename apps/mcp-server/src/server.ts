import path from "node:path";

import { McpServer } from "@modelcontextprotocol/server";
import {
  findSavedVariables,
  inspectClient,
  installProjectAddon,
  listAddons,
  readLogTail,
  restoreAddonBackup,
  type WowPaths,
} from "@wow-forever/core";
import { z } from "zod/v4";

export interface WowMcpOptions {
  paths: WowPaths;
  repoRoot: string;
  backupRoot?: string;
}

const addonNameSchema = z.string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/u, "Use only letters, numbers, underscores and hyphens")
  .describe("Exact addon folder name, for example ForeverBridge");
const logNameSchema = z.enum(["FrameXML.log", "Lua.log", "CombatLog.txt", "WoWCombatLog.txt"]);
const responseFormatSchema = z.enum(["json", "markdown"]).default("json");

function textResult(data: Record<string, unknown>, markdown?: string) {
  return {
    content: [{ type: "text" as const, text: markdown ?? JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{
      type: "text" as const,
      text: `WoW Forever operation failed: ${message}. Check the addon name and run wow_status for current paths.`,
    }],
  };
}

export function createWowMcpServer(options: WowMcpOptions): McpServer {
  const server = new McpServer({ name: "wow-forever-mcp-server", version: "0.1.0" });
  const backupRoot = path.resolve(options.backupRoot ?? path.join(options.repoRoot, "backups", "addons"));

  server.registerResource(
    "wow-client-status",
    "wow://client/status",
    { title: "WoW Forever client status", description: "Installed build, running state and interface.", mimeType: "application/json" },
    async (uri) => {
      const status = await inspectClient(options.paths);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(status, null, 2) }] };
    },
  );
  server.registerResource(
    "wow-addons",
    "wow://addons",
    { title: "Installed WoW Forever addons", description: "Redacted addon inventory.", mimeType: "application/json" },
    async (uri) => {
      const addons = await listAddons(options.paths);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ addons }, null, 2) }] };
    },
  );
  server.registerResource(
    "wow-framexml-log",
    "wow://logs/framexml",
    { title: "Recent FrameXML log", description: "The most recent 100 FrameXML lines.", mimeType: "application/json" },
    async (uri) => {
      const log = await readLogTail(options.paths, "FrameXML.log", 100);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(log, null, 2) }] };
    },
  );

  server.registerTool(
    "wow_status",
    {
      title: "Check WoW Forever status",
      description: "Read the installed WoW Forever product, build, interface and running state. Makes no changes.",
      inputSchema: z.object({ response_format: responseFormatSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ response_format }) => {
      try {
        const status = await inspectClient(options.paths);
        return textResult(
          { ...status },
          response_format === "markdown"
            ? `# WoW Forever\n\n- Installed: ${status.installed}\n- Running: ${status.running}\n- Build: ${status.version ?? "unknown"}\n- Interface: ${status.interfaceVersion ?? "unknown"}`
            : undefined,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "wow_list_addons",
    {
      title: "List WoW Forever addons",
      description: "List installed addon names and TOC metadata with simple pagination. Makes no changes.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        response_format: responseFormatSchema,
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ limit, offset, response_format }) => {
      try {
        const all = await listAddons(options.paths);
        const addons = all.slice(offset, offset + limit);
        const output = {
          total: all.length,
          count: addons.length,
          offset,
          has_more: offset + addons.length < all.length,
          addons,
        };
        const markdown = ["# Installed addons", "", ...addons.map((addon) => `- ${addon.name} ${addon.version}`)].join("\n");
        return textResult(output, response_format === "markdown" ? markdown : undefined);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "wow_read_log",
    {
      title: "Read a WoW Forever log tail",
      description: "Read up to 500 final lines from one approved Blizzard log. Other paths are rejected.",
      inputSchema: z.object({ name: logNameSchema, lines: z.number().int().min(1).max(500).default(100) }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, lines }) => {
      try {
        return textResult({ ...(await readLogTail(options.paths, name, lines)) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "wow_saved_variables",
    {
      title: "Find addon SavedVariables",
      description: "Find one addon's saved files after WoW writes them. Account, realm and character path names are redacted.",
      inputSchema: z.object({ addonName: addonNameSchema }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ addonName }) => {
      try {
        const files = await findSavedVariables(options.paths, addonName);
        return textResult({ addonName, count: files.length, files });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "wow_install_project_addon",
    {
      title: "Install a project addon safely",
      description: "Back up any installed copy, then install one addon from this repository. Auctionator is always protected.",
      inputSchema: z.object({ addonName: addonNameSchema }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ addonName }) => {
      try {
        const result = await installProjectAddon({
          repoRoot: options.repoRoot,
          paths: options.paths,
          addonName,
          backupRoot,
        });
        return textResult({ ...result });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "wow_restore_addon_backup",
    {
      title: "Restore an addon backup",
      description: "Restore one selected backup from the approved backup folder and preserve the current addon first.",
      inputSchema: z.object({ addonName: addonNameSchema, backupPath: z.string().min(1).max(500) }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ addonName, backupPath }) => {
      try {
        const result = await restoreAddonBackup({
          paths: options.paths,
          addonName,
          backupPath,
          backupRoot,
        });
        return textResult({ ...result });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

