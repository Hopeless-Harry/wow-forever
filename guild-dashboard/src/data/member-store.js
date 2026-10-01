import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";

import { MAX_MEMBER_EVENTS, MEMBER_FIELDS } from "../domain/members.js";

const allStrings = (object, keys) => keys.every((key) => typeof object[key] === "string");

function safeMember(member) {
  return Boolean(member) && typeof member === "object" && allStrings(member, ["name", ...MEMBER_FIELDS]);
}

function safeEvent(event) {
  if (!event || typeof event !== "object" || Number.isNaN(Date.parse(event.at)) || typeof event.name !== "string") return false;
  if (event.type === "joined") return safeMember({ name: event.name, ...event.entry });
  if (event.type === "changed") return allStrings(event, ["field", "from", "to"]);
  return event.type === "left" || event.type === "baseline";
}

export class MemberStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async read() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("members file is not an object");
      return {
        members: Array.isArray(parsed.members) ? parsed.members.filter(safeMember) : [],
        events: Array.isArray(parsed.events) ? parsed.events.filter(safeEvent) : [],
        fetchedAt: typeof parsed.fetchedAt === "string" ? parsed.fetchedAt : null
      };
    } catch (error) {
      if (error.code === "ENOENT") return { members: [], events: [], fetchedAt: null };
      if (error instanceof SyntaxError) {
        // Keep the unreadable file so history can be recovered instead of silently overwritten.
        await rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => {});
        return { members: [], events: [], fetchedAt: null };
      }
      throw error;
    }
  }

  async write({ members, events, fetchedAt }) {
    const data = {
      members: members.filter(safeMember),
      events: events.filter(safeEvent).slice(-MAX_MEMBER_EVENTS),
      fetchedAt
    };
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.tmp`;
    const handle = await open(temporaryPath, "w", 0o600);
    try {
      await handle.chmod(0o600);
      await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, this.filePath);
    return data;
  }
}
