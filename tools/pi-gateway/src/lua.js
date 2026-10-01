// A small, non-executing parser for the Lua data files WoW writes to SavedVariables, plus a serialiser for the inbox.
// It understands only constant data: nil, booleans, numbers, strings and tables. Any function call, variable use, operator
// or unknown token throws, so a hostile or corrupted file can never run anything.

const MAX_DEPTH = 40;
const MAX_NODES = 5_000_000;
const ESCAPES = { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', '"': '"', "'": "'", '\n': '\n' };

export class LuaParseError extends Error {}

class Reader {
  constructor(text) { this.s = text; this.i = 0; this.nodes = 0; }
  fail(message) { throw new LuaParseError(`${message} at offset ${this.i}`); }
  skip() {
    for (;;) {
      const s = this.s;
      while (this.i < s.length && /\s/.test(s[this.i])) this.i += 1;
      if (s.startsWith('--', this.i)) {
        const long = /^--\[(=*)\[/.exec(s.slice(this.i, this.i + 40));
        if (long) { const end = s.indexOf(`]${long[1]}]`, this.i); if (end < 0) this.fail('unterminated comment'); this.i = end + long[1].length + 2; }
        else { const end = s.indexOf('\n', this.i); this.i = end < 0 ? s.length : end + 1; }
      } else return;
    }
  }
  peek() { this.skip(); return this.s[this.i]; }
  eat(ch) { if (this.peek() !== ch) this.fail(`expected "${ch}"`); this.i += 1; }
  ident() { this.skip(); const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.s.slice(this.i, this.i + 80)); if (!m) this.fail('expected a name'); this.i += m[0].length; return m[0]; }

  string() {
    const q = this.s[this.i]; this.i += 1;
    let out = '';
    for (;;) {
      if (this.i >= this.s.length) this.fail('unterminated string');
      const c = this.s[this.i];
      if (c === q) { this.i += 1; return out; }
      if (c === '\n') this.fail('newline in string');
      if (c !== '\\') { out += c; this.i += 1; continue; }
      const e = this.s[this.i + 1]; this.i += 2;
      if (e in ESCAPES) out += ESCAPES[e];
      else if (/[0-9]/.test(e)) { let d = e; while (d.length < 3 && /[0-9]/.test(this.s[this.i] ?? '')) { d += this.s[this.i]; this.i += 1; } const n = Number(d); if (n > 255) this.fail('bad escape'); out += String.fromCharCode(n); }
      else if (e === 'x') { const h = this.s.slice(this.i, this.i + 2); if (!/^[0-9a-fA-F]{2}$/.test(h)) this.fail('bad escape'); out += String.fromCharCode(parseInt(h, 16)); this.i += 2; }
      else if (e === 'z') { while (/\s/.test(this.s[this.i] ?? '')) this.i += 1; }
      else this.fail('bad escape');
    }
  }
  longString() {
    const m = /^\[(=*)\[/.exec(this.s.slice(this.i, this.i + 40));
    const close = `]${m[1]}]`; const end = this.s.indexOf(close, this.i + m[0].length);
    if (end < 0) this.fail('unterminated long string');
    let body = this.s.slice(this.i + m[0].length, end); if (body.startsWith('\n')) body = body.slice(1);
    this.i = end + close.length; return body;
  }
  number() {
    const m = /^-?(0[xX][0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)/.exec(this.s.slice(this.i, this.i + 60));
    if (!m) this.fail('bad number');
    this.i += m[0].length;
    const v = Number(m[0]); if (!Number.isFinite(v)) this.fail('number out of range');
    return v;
  }

  value(depth) {
    if (depth > MAX_DEPTH) this.fail('nesting too deep');
    if ((this.nodes += 1) > MAX_NODES) this.fail('file too large');
    const c = this.peek();
    if (c === '{') return this.table(depth);
    if (c === '"' || c === "'") return this.string();
    if (c === '[' && /^\[=*\[/.test(this.s.slice(this.i, this.i + 40))) return this.longString();
    if (c === '-' || c === '.' || /[0-9]/.test(c ?? '')) return this.number();
    const word = this.ident();
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'nil') return null;
    return this.fail(`unexpected "${word}"`);
  }

  table(depth) {
    this.eat('{');
    const entries = []; let positional = 0;
    for (;;) {
      const c = this.peek();
      if (c === '}') { this.i += 1; break; }
      if (c === undefined) this.fail('unterminated table');
      let key;
      if (c === '[' && !/^\[=*\[/.test(this.s.slice(this.i, this.i + 40))) {
        this.i += 1; key = this.value(depth + 1); this.eat(']'); this.eat('=');
        if (typeof key !== 'string' && typeof key !== 'number') this.fail('bad table key');
      } else if (/[A-Za-z_]/.test(c) && /^[A-Za-z_][A-Za-z0-9_]*\s*=(?!=)/.test(this.s.slice(this.i, this.i + 90))) {
        key = this.ident(); this.eat('=');
      } else { positional += 1; key = positional; }
      const value = this.value(depth + 1);
      if (value !== null) entries.push([key, value]);
      const sep = this.peek();
      if (sep === ',' || sep === ';') this.i += 1; else if (sep !== '}') this.fail('expected "," or "}"');
    }
    // A table whose keys are exactly 1..n becomes an array; anything else a prototype-free object.
    const numeric = entries.every(([k]) => typeof k === 'number' && Number.isInteger(k) && k >= 1);
    if (numeric && entries.length) {
      const sorted = [...entries].sort((a, b) => a[0] - b[0]);
      if (sorted.every(([k], idx) => k === idx + 1)) return sorted.map(([, v]) => v);
    }
    const out = Object.create(null);
    for (const [k, v] of entries) out[String(k)] = v;
    return out;
  }
}

// Returns an object of the top-level `Name = value` assignments. Only names in `wanted` are kept when given.
export function parseLuaFile(text, wanted = null) {
  const r = new Reader(text.replace(/^﻿/, ''));
  const out = Object.create(null);
  while (r.peek() !== undefined) {
    const name = r.ident();
    r.eat('=');
    const value = r.value(0);
    if (!wanted || wanted.includes(name)) out[name] = value;
    if (r.peek() === ';') r.i += 1;
  }
  return out;
}

// ---------------------------------------------------------------- serialiser (inbox)
const luaString = (s) => `"${String(s).replace(/[\\"\x00-\x1f\x7f-￿]/g, (c) => {
  if (c === '\\') return '\\\\'; if (c === '"') return '\\"'; if (c === '\n') return '\\n';
  const code = c.charCodeAt(0); return code < 256 ? `\\${String(code).padStart(3, '0')}` : '?';
})}"`;

export function toLua(value, indent = 0) {
  const pad = '  '.repeat(indent + 1), end = '  '.repeat(indent);
  if (value === null || value === undefined) return 'nil';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('cannot serialise a non-finite number'); return String(value); }
  if (typeof value === 'string') return luaString(value);
  if (Array.isArray(value)) return value.length ? `{\n${value.map((v) => `${pad}${toLua(v, indent + 1)},`).join('\n')}\n${end}}` : '{}';
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) return '{}';
    return `{\n${keys.map((k) => `${pad}${/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : `[${luaString(k)}]`} = ${toLua(value[k], indent + 1)},`).join('\n')}\n${end}}`;
  }
  throw new Error(`cannot serialise ${typeof value}`);
}
