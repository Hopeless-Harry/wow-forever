# WoW Forever Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local monorepo that safely develops WoW Forever addons and exposes client, addon, log, SavedVariables, build and installation capabilities through MCP.

**Architecture:** A shared TypeScript package owns all filesystem discovery, parsing, redaction and safe mutations. A small stdio MCP server wraps that package without duplicating logic. A diagnostic Lua addon proves the build/install/SavedVariables path while remaining passive during gameplay.

**Tech Stack:** Node.js 24, TypeScript 5.9, MCP TypeScript SDK 2, Zod 4, Node test runner, PowerShell launch helpers, WoW Lua/XML/TOC.

## Global Constraints

- The live client root is `C:\Program Files (x86)\World of Warcraft\_classic_beta_`.
- The expected product is `wow_classic_beta` and current interface is `16001`.
- Auctionator must remain installed and unchanged.
- Back up before replacing or removing an addon.
- Never read process memory, inspect packets, generate gameplay input or bypass protected actions.
- Never expose account or character path identifiers unless the user explicitly requests them.
- `backups/`, build output and local MCP configuration must not be committed.

---

### Task 1: Monorepo foundation and configuration

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/wow-core/package.json`
- Create: `packages/wow-core/tsconfig.json`
- Create: `packages/wow-core/src/config.ts`
- Create: `packages/wow-core/test/config.test.ts`

**Interfaces:**
- Produces: `WowPaths`, `DEFAULT_CLIENT_ROOT`, `resolveWowPaths(clientRoot?)`

- [ ] **Step 1: Write the failing configuration test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { resolveWowPaths } from "../src/config.js";

test("derives every path from one explicit client root", () => {
  const paths = resolveWowPaths("C:\\Games\\Forever");
  assert.equal(paths.addons, "C:\\Games\\Forever\\Interface\\AddOns");
  assert.equal(paths.logs, "C:\\Games\\Forever\\Logs");
  assert.equal(paths.wtf, "C:\\Games\\Forever\\WTF");
});
```

- [ ] **Step 2: Run the test and confirm it fails because the module is missing**

Run: `npm test --workspace @wow-forever/core`
Expected: FAIL with a module-not-found error for `src/config.js`.

- [ ] **Step 3: Add workspace configuration and the minimal path implementation**

```ts
import path from "node:path";

export const DEFAULT_CLIENT_ROOT = String.raw`C:\Program Files (x86)\World of Warcraft\_classic_beta_`;

export interface WowPaths {
  clientRoot: string;
  executable: string;
  flavorInfo: string;
  buildInfo: string;
  addons: string;
  logs: string;
  wtf: string;
}

export function resolveWowPaths(clientRoot = process.env.WOW_FOREVER_ROOT ?? DEFAULT_CLIENT_ROOT): WowPaths {
  const root = path.resolve(clientRoot);
  return {
    clientRoot: root,
    executable: path.join(root, "WowB.exe"),
    flavorInfo: path.join(root, ".flavor.info"),
    buildInfo: path.join(root, "..", ".build.info"),
    addons: path.join(root, "Interface", "AddOns"),
    logs: path.join(root, "Logs"),
    wtf: path.join(root, "WTF"),
  };
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `npm test --workspace @wow-forever/core && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add .gitignore package.json tsconfig.base.json packages/wow-core
git commit -m "chore: establish WoW Forever workspace"
```

### Task 2: Client, addon, log and SavedVariables inspection

**Files:**
- Create: `packages/wow-core/src/client.ts`
- Create: `packages/wow-core/src/addons.ts`
- Create: `packages/wow-core/src/logs.ts`
- Create: `packages/wow-core/src/saved-variables.ts`
- Create: `packages/wow-core/src/redact.ts`
- Create: `packages/wow-core/src/index.ts`
- Create: `packages/wow-core/test/inspection.test.ts`

**Interfaces:**
- Produces: `inspectClient(paths): Promise<ClientStatus>`
- Produces: `listAddons(paths): Promise<AddonSummary[]>`
- Produces: `readLogTail(paths, name, lines?): Promise<LogTail>`
- Produces: `findSavedVariables(paths, addon): Promise<SavedVariableSummary[]>`
- Produces: `redactWowPath(value, wtfRoot): string`

- [ ] **Step 1: Write fixture-based failing tests**

Create a temporary client containing `.flavor.info`, `.build.info`, `WTF/Config.wtf`, one addon TOC and one log. Assert product `wow_classic_beta`, version `1.60.1.69913`, interface `16001`, addon metadata, last log lines and redacted account/character segments.

- [ ] **Step 2: Run the focused tests**

Run: `npm test --workspace @wow-forever/core -- inspection.test.ts`
Expected: FAIL because inspection modules do not exist.

- [ ] **Step 3: Implement strict parsers**

The client parser must verify `WowB.exe` and `Product Flavor`, select the `wow_classic_beta` row from `.build.info`, and read `engineSurveyPatch` from `WTF/Config.wtf`. The addon parser reads only top-level `## Key: Value` TOC metadata. The log reader accepts only a fixed allowlist: `FrameXML.log`, `Lua.log`, `CombatLog.txt`, and `WoWCombatLog.txt`.

- [ ] **Step 4: Implement redacted SavedVariables discovery**

Walk only under `WTF`, match the exact filename `<Addon>.lua`, and return redacted relative paths plus size and modified time. Reject addon names outside `^[A-Za-z0-9_-]+$`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test --workspace @wow-forever/core && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```text
git add packages/wow-core
git commit -m "feat: inspect Forever client state safely"
```

### Task 3: Backup, install and restore project addons

**Files:**
- Create: `packages/wow-core/src/addon-operations.ts`
- Create: `packages/wow-core/test/addon-operations.test.ts`

**Interfaces:**
- Produces: `installProjectAddon(request): Promise<AddonOperationResult>`
- Produces: `restoreAddonBackup(request): Promise<AddonOperationResult>`

- [ ] **Step 1: Write failing safety tests**

Tests must prove that installation rejects path traversal, rejects Auctionator, rejects source folders without a matching TOC, creates a timestamped backup before replacement, copies through a temporary sibling folder, and can restore the backup.

- [ ] **Step 2: Run the focused tests**

Run: `npm test --workspace @wow-forever/core -- addon-operations.test.ts`
Expected: FAIL because addon operations are missing.

- [ ] **Step 3: Implement validated operations**

Use `realpath`/`resolve` containment checks for source, destination and backup roots. Only addon folders inside the repository `addons/` directory are installable. Refuse the exact protected name `Auctionator`. Return action, affected paths and backup path in every success result.

- [ ] **Step 4: Run all core tests**

Run: `npm test --workspace @wow-forever/core && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add packages/wow-core
git commit -m "feat: add recoverable addon installation"
```

### Task 4: Diagnostic ForeverBridge addon

**Files:**
- Create: `addons/ForeverBridge/ForeverBridge.toc`
- Create: `addons/ForeverBridge/Core.lua`
- Create: `addons/ForeverBridge/README.md`
- Create: `tests/addon-manifest.test.ts`
- Create: `scripts/package-addons.ts`

**Interfaces:**
- Saved variable: `ForeverBridgeDB`
- Slash command: `/wfmcp`
- Package output: `dist/addons/ForeverBridge.zip`

- [ ] **Step 1: Write the failing manifest test**

Assert interface `16001`, visible source, `ForeverBridgeDB`, no forbidden input/network/memory terms, and exact TOC file ordering.

- [ ] **Step 2: Run the test**

Run: `npm test -- addon-manifest.test.ts`
Expected: FAIL because the addon does not exist.

- [ ] **Step 3: Implement the passive addon**

The addon records version, locale, interface, game mode, login timestamp, logout timestamp and last slash-command timestamp using permitted Lua APIs. `/wfmcp` prints a short status message. It creates no secure buttons and performs no protected action.

- [ ] **Step 4: Add deterministic ZIP packaging**

The packager includes only the TOC, Lua and README files under a single `ForeverBridge/` root and writes to `dist/addons`.

- [ ] **Step 5: Run addon and package tests**

Run: `npm test && npm run build`
Expected: PASS and `dist/addons/ForeverBridge.zip` exists.

- [ ] **Step 6: Commit**

```text
git add addons scripts tests
git commit -m "feat: add passive Forever diagnostic addon"
```

### Task 5: Local MCP server

**Files:**
- Create: `apps/mcp-server/package.json`
- Create: `apps/mcp-server/tsconfig.json`
- Create: `apps/mcp-server/src/server.ts`
- Create: `apps/mcp-server/src/index.ts`
- Create: `apps/mcp-server/test/server.test.ts`

**Interfaces:**
- Produces: `createWowMcpServer(options): McpServer`
- Resources: `wow://client/status`, `wow://addons`, `wow://logs/framexml`
- Read tools: `wow_status`, `wow_list_addons`, `wow_read_log`, `wow_saved_variables`
- Write tools: `wow_install_project_addon`, `wow_restore_addon_backup`

- [ ] **Step 1: Write failing in-memory MCP tests**

Use the SDK in-memory transport. Assert all resources and tools are listed, read tools return redacted JSON, `wow_read_log` rejects non-allowlisted names, and install refuses Auctionator.

- [ ] **Step 2: Run the MCP tests**

Run: `npm test --workspace @wow-forever/mcp-server`
Expected: FAIL because the server does not exist.

- [ ] **Step 3: Implement the server**

Register resources and tools with Zod schemas. All handlers delegate to `@wow-forever/core`. Use stdio transport only, write logs to stderr, and never print non-protocol text to stdout.

- [ ] **Step 4: Run MCP tests and typecheck**

Run: `npm test --workspace @wow-forever/mcp-server && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add apps/mcp-server package.json package-lock.json
git commit -m "feat: expose WoW Forever MCP server"
```

### Task 6: Simple CLI, setup and end-to-end verification

**Files:**
- Create: `apps/cli/package.json`
- Create: `apps/cli/tsconfig.json`
- Create: `apps/cli/src/index.ts`
- Create: `scripts/Setup.ps1`
- Create: `scripts/Start-Mcp.ps1`
- Create: `tests/cli.test.ts`
- Create: `README.md`
- Create: `docs/CAPABILITIES.md`
- Create: `docs/RECOVERY.md`

**Interfaces:**
- Commands: `setup`, `status`, `test`, `build`, `install ForeverBridge`, `restore <backup>`, `mcp`

- [ ] **Step 1: Write failing CLI tests**

Assert `status --json` returns product/build/interface/running/addons, unknown commands exit non-zero with one-line help, and `install Auctionator` is rejected.

- [ ] **Step 2: Implement the CLI and PowerShell wrappers**

Keep console output under short headings. `Setup.ps1` installs locked dependencies, runs typecheck/tests/build, and reports that it has not installed an addon. `Start-Mcp.ps1` starts the stdio server without opening a network port.

- [ ] **Step 3: Write short user documentation**

README starts with exactly five commands: setup, status, test, install and MCP. Capability documentation separates VERIFIED, AVAILABLE, LIMITED and NOT ALLOWED. Recovery documentation gives one restore command and the dated manual backup path.

- [ ] **Step 4: Run full verification**

Run: `npm ci && npm run typecheck && npm test && npm run build && npm run status -- --json`
Expected: all commands exit 0; status identifies `wow_classic_beta`, build `1.60.1.69913`, interface `16001`, and Auctionator.

- [ ] **Step 5: Install the diagnostic addon safely**

Run: `npm run install:addon -- ForeverBridge`
Expected: any previous ForeverBridge is backed up; Auctionator remains byte-identical; ForeverBridge is installed from the project source.

- [ ] **Step 6: Verify the live addon directory**

Run: `npm run status -- --json`
Expected: exactly Auctionator and ForeverBridge are listed. No client, SavedVariables or account files are changed by status inspection.

- [ ] **Step 7: Commit**

```text
git add apps scripts tests README.md docs package.json package-lock.json
git commit -m "docs: complete Forever platform setup"
```

### Task 7: Final review and MCP registration handoff

**Files:**
- Modify: `docs/CAPABILITIES.md`
- Create: `docs/MCP-SETUP.md`

**Interfaces:**
- Produces: tested stdio command for Codex MCP registration

- [ ] **Step 1: Run the verification suite again from a clean dependency install**

Run: `npm ci && npm run typecheck && npm test && npm run build`
Expected: PASS with no warnings from project code.

- [ ] **Step 2: Smoke-test MCP over stdio**

Start the built server with the official SDK client, list tools/resources, call `wow_status`, then close the transport.
Expected: every registered capability appears and the client status is valid JSON.

- [ ] **Step 3: Record what is genuinely live**

Mark process status and log tailing VERIFIED. Mark SavedVariables as LIMITED to WoW save points. Mark live character control, memory, packets and automatic input NOT ALLOWED.

- [ ] **Step 4: Document the exact local registration command**

Use the built absolute server path and `WOW_FOREVER_ROOT` environment variable. Do not edit global Codex configuration unless the user explicitly requests registration.

- [ ] **Step 5: Commit**

```text
git add docs
git commit -m "docs: record MCP verification and setup"
```
