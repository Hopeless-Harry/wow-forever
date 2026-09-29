import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fengari from 'fengari';

const here = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(here, '..', '..', '..');
export const addonRoot = resolve(repositoryRoot, 'addons', 'MAMChroniclesDiagnostics');
export const addonPath = (...parts) => resolve(addonRoot, ...parts);
export const readAddonFile = (name) => readFileSync(addonPath(name), 'utf8');
export const multi = (...values) => ({ __luaReturns: values });

const { lua, lauxlib, lualib, to_jsstring, to_luastring } = fengari;

function pushJsValue(L, value) {
  if (value === undefined || value === null) {
    lua.lua_pushnil(L);
  } else if (typeof value === 'boolean') {
    lua.lua_pushboolean(L, value);
  } else if (typeof value === 'number') {
    lua.lua_pushnumber(L, value);
  } else if (typeof value === 'string') {
    lua.lua_pushstring(L, to_luastring(value));
  } else if (typeof value === 'function') {
    lua.lua_pushjsfunction(L, (state) => {
      const args = [];
      for (let index = 1; index <= lua.lua_gettop(state); index += 1) {
        args.push(toJsValue(state, index));
      }
      let result;
      try {
        result = value(...args);
      } catch (error) {
        return lauxlib.luaL_error(state, to_luastring(error.message));
      }
      const results = result && Array.isArray(result.__luaReturns) ? result.__luaReturns : [result];
      for (const item of results) pushJsValue(state, item);
      return results.length;
    });
  } else if (Array.isArray(value)) {
    lua.lua_createtable(L, value.length, 0);
    value.forEach((item, index) => {
      pushJsValue(L, item);
      lua.lua_rawseti(L, -2, index + 1);
    });
  } else {
    const entries = Object.entries(value);
    lua.lua_createtable(L, 0, entries.length);
    for (const [key, item] of entries) {
      pushJsValue(L, item);
      lua.lua_setfield(L, -2, to_luastring(key));
    }
  }
}

function toJsValue(L, index, seen = new Map()) {
  const type = lua.lua_type(L, index);
  if (type === lua.LUA_TNIL) return null;
  if (type === lua.LUA_TBOOLEAN) return Boolean(lua.lua_toboolean(L, index));
  if (type === lua.LUA_TNUMBER) return lua.lua_tonumber(L, index);
  if (type === lua.LUA_TSTRING) return to_jsstring(lua.lua_tostring(L, index));
  if (type !== lua.LUA_TTABLE) return `<${to_jsstring(lua.lua_typename(L, type))}>`;

  const pointer = lua.lua_topointer(L, index);
  if (seen.has(pointer)) return seen.get(pointer);
  const result = {};
  seen.set(pointer, result);
  const absoluteIndex = lua.lua_absindex(L, index);
  lua.lua_pushnil(L);
  while (lua.lua_next(L, absoluteIndex) !== 0) {
    const key = toJsValue(L, -2, seen);
    result[key] = toJsValue(L, -1, seen);
    lua.lua_pop(L, 1);
  }
  return result;
}

function runChunk(L, source, name) {
  const status = lauxlib.luaL_loadbuffer(L, to_luastring(source), null, to_luastring(name));
  if (status !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
  const callStatus = lua.lua_pcall(L, 0, lua.LUA_MULTRET, 0);
  if (callStatus !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
}

function setGlobal(L, name, value) {
  pushJsValue(L, value);
  lua.lua_setglobal(L, to_luastring(name));
}

export function createWowHarness({ globals = {}, savedVariables = null } = {}) {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  const calls = { registered: [], messages: [], printed: [] };

  const defaults = {
    GetServerTime: () => 1790704800,
    time: () => 1790704800,
    GetBuildInfo: () => multi('1.60.1', '70009', 'Sep 25 2026', 16001),
    GetLocale: () => 'enGB',
    GetCVar: () => '15',
    UnitName: () => multi('PRIVATE_CHARACTER', 'PRIVATE_REALM'),
    IsInGuild: () => true,
    CreateFrame: () => null,
    DEFAULT_CHAT_FRAME: { AddMessage: (_self, message) => calls.printed.push(message) },
    SlashCmdList: {},
  };

  for (const [name, value] of Object.entries({ ...defaults, ...globals })) {
    setGlobal(L, name, value);
  }
  if (savedVariables !== null) setGlobal(L, 'MAMChroniclesDiagnosticsDB', savedVariables);

  runChunk(L, `
    __mamCalls = { registered = {}, messages = {}, printed = {} }
    function __mamCreateFrame()
      local frame = { scripts = {}, shown = false }
      function frame:RegisterEvent(eventName)
        if __mamFailEvent == eventName then error("unsupported event: " .. eventName) end
        table.insert(__mamCalls.registered, eventName)
      end
      function frame:SetScript(kind, callback) self.scripts[kind] = callback end
      function frame:SetSize() end
      function frame:SetPoint() end
      function frame:SetMovable() end
      function frame:EnableMouse() end
      function frame:RegisterForDrag() end
      function frame:SetClampedToScreen() end
      function frame:SetBackdrop() end
      function frame:SetBackdropColor() end
      function frame:SetBackdropBorderColor() end
      function frame:SetFrameStrata() end
      function frame:Hide() self.shown = false end
      function frame:Show() self.shown = true end
      function frame:IsShown() return self.shown end
      function frame:StartMoving() end
      function frame:StopMovingOrSizing() end
      function frame:CreateFontString()
        return { SetPoint = function() end, SetText = function() end, SetTextColor = function() end }
      end
      function frame:CreateTexture()
        return { SetAllPoints = function() end, SetColorTexture = function() end }
      end
      __mamLastFrame = frame
      return frame
    end
    CreateFrame = __mamCreateFrame
  `, 'wow-frame-stub');

  return {
    lua: L,
    calls,
    load(files) {
      for (const file of files) runChunk(L, readAddonFile(file), file);
    },
    run(source, name = 'test-chunk') {
      runChunk(L, source, name);
    },
    get(expression) {
      lua.lua_settop(L, 0);
      const status = lauxlib.luaL_loadstring(L, to_luastring(`return ${expression}`));
      if (status !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
      const callStatus = lua.lua_pcall(L, 0, 1, 0);
      if (callStatus !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
      return toJsValue(L, -1);
    },
    call(expression) {
      runChunk(L, expression, 'test-call');
    },
    fireEvent(eventName, ...args) {
      setGlobal(L, '__mamEventArgs', args);
      setGlobal(L, '__mamEventName', eventName);
      runChunk(L, 'local frame = MAMChroniclesDiagnostics and MAMChroniclesDiagnostics.eventFrame or __mamLastFrame; if frame and frame.scripts.OnEvent then frame.scripts.OnEvent(frame, __mamEventName, table.unpack(__mamEventArgs)) end', 'fire-event');
    },
    runSlash(command = '') {
      setGlobal(L, '__mamSlashCommand', command);
      runChunk(L, 'SlashCmdList.MAMCHRONICLESDIAGNOSTICS(__mamSlashCommand)', 'slash-command');
    },
  };
}
