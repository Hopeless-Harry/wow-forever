import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLuaFile, toLua, LuaParseError } from '../src/lua.js';

const sample = `
MAMChroniclesDB = {
	["schemaVersion"] = 1,
	["settings"] = {
		["shareStats"] = true,
		["windowAlpha"] = 0.85,
	},
	["gateway"] = {
		["members"] = {
			["Alice"] = {
				["level"] = 60,
				["title"] = "Wine Mom",
				["stats"] = {
					["wine"] = 3,
				},
			},
		},
		["forget"] = {
			{
				["name"] = "Bob",
				["at"] = 1790600000,
			}, -- [1]
			{
				["name"] = "Cy",
				["at"] = 1790600001,
			}, -- [2]
		},
		["negative"] = -4,
		["float"] = 1.5e3,
		["hex"] = 0x10,
	},
	["escaped"] = "line\\nbreak \\"quoted\\" back\\\\slash \\065\\x42",
	["list"] = { "a", "b", "c" },
	["gap"] = { [1] = "a", [3] = "c" },
	["falsey"] = false,
}
--[[ block
comment ]]
OtherGlobal = "x"
`;

test('parses a SavedVariables style file without running anything', () => {
  const root = parseLuaFile(sample, ['MAMChroniclesDB']);
  const db = root.MAMChroniclesDB;
  assert.equal(db.schemaVersion, 1);
  assert.equal(db.settings.shareStats, true);
  assert.equal(db.settings.windowAlpha, 0.85);
  assert.equal(db.gateway.members.Alice.stats.wine, 3);
  assert.deepEqual(db.gateway.forget.map((f) => f.name), ['Bob', 'Cy']);
  assert.equal(db.gateway.negative, -4); assert.equal(db.gateway.float, 1500); assert.equal(db.gateway.hex, 16);
  assert.equal(db.escaped, 'line\nbreak "quoted" back\\slash AB');
  assert.deepEqual(db.list, ['a', 'b', 'c']);
  assert.equal(Array.isArray(db.gap), false); assert.equal(db.gap['3'], 'c');
  assert.equal(db.falsey, false);
  assert.equal('OtherGlobal' in root, false);
});

test('function calls, variables and operators are refused, never executed', () => {
  for (const bad of ['X = os.execute("calc")', 'X = {a = print("hi")}', 'X = 1 + 2', 'X = {[1+1] = 2}', 'X = y', 'X = function() end', 'X = {', 'X = "unterminated', 'X = {1 2}', 'X = 0xZZ']) {
    assert.throws(() => parseLuaFile(bad), LuaParseError, bad);
  }
  globalThis.__pwned = false;
  assert.throws(() => parseLuaFile('X = (function() end)()'));
  assert.equal(globalThis.__pwned, false);
});

test('deep nesting is refused and prototype keys are harmless', () => {
  assert.throws(() => parseLuaFile(`X = ${'{'.repeat(80)}${'}'.repeat(80)}`), /too deep/);
  const root = parseLuaFile('X = { ["__proto__"] = { polluted = true }, ["constructor"] = 1 }');
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(root.X), null);
});

test('serialiser output parses back to the same data and escapes hostile text', () => {
  const data = { version: 1, commands: [{ id: 5, kind: 'announce', text: 'He said "hi" \\ and\nleft' }, { id: 6, kind: 'quests', week: 3, slots: ['-', 'wine', '-'] }], 'odd key': true, none: null };
  const lua = `Inbox = ${toLua(data)}`;
  const back = parseLuaFile(lua).Inbox;
  assert.equal(back.commands[0].text, 'He said "hi" \\ and\nleft');
  assert.deepEqual(back.commands[1].slots, ['-', 'wine', '-']);
  assert.equal(back['odd key'], true);
  assert.equal('none' in back, false);
  const nasty = toLua({ text: '"]] os.execute("x") --' });
  assert.deepEqual(Object.keys(parseLuaFile(`X = ${nasty}`).X), ['text']);
  assert.throws(() => toLua({ n: NaN }));
});
