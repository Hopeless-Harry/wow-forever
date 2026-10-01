#!/usr/bin/env node
// Erase one member from the stored roster and from every chronicle event.
// Usage: node scripts/forget-member.mjs "<name>" [path/to/members.json]
// Then delete their row from the response Sheet, or they will return on the next sync.
import { MemberStore } from "../src/data/member-store.js";

const [name, file = process.env.MEMBER_PATH] = process.argv.slice(2);
if (!name || !file) {
  console.error('Usage: MEMBER_PATH=/var/lib/guild-ledger/members.json node scripts/forget-member.mjs "<name>"');
  process.exit(2);
}

const store = new MemberStore(file);
const data = await store.read();
const key = name.toLowerCase();
const members = data.members.filter((member) => member.name.toLowerCase() !== key);
const events = data.events.filter((event) => event.name.toLowerCase() !== key);
const removed = { members: data.members.length - members.length, events: data.events.length - events.length };
if (removed.members === 0 && removed.events === 0) {
  console.log("Nothing found for that name.");
  process.exit(0);
}
await store.write({ ...data, members, events });
console.log(`Removed ${removed.members} roster entry and ${removed.events} chronicle events. Delete their Sheet row too, then restart the service.`);
