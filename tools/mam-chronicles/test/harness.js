import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fengari from 'fengari';

const here = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(here, '..', '..', '..');
export const addonRoot = resolve(repositoryRoot, 'addons', 'MAMChronicles');
export const addonPath = (...parts) => resolve(addonRoot, ...parts);
export const readAddonFile = (name) => readFileSync(addonPath(name), 'utf8');
export const multi = (...values) => ({ __luaReturns: values });
const { lua, lauxlib, lualib, to_jsstring, to_luastring } = fengari;

function push(L, value) {
  if (value == null) lua.lua_pushnil(L);
  else if (typeof value === 'boolean') lua.lua_pushboolean(L, value);
  else if (typeof value === 'number') lua.lua_pushnumber(L, value);
  else if (typeof value === 'string') lua.lua_pushstring(L, to_luastring(value));
  else if (typeof value === 'function') lua.lua_pushjsfunction(L, state => {
    const args = []; for (let i = 1; i <= lua.lua_gettop(state); i++) args.push(toJs(state, i));
    let result; try { result = value(...args); } catch (error) { return lauxlib.luaL_error(state, to_luastring(error.message)); }
    const results = result?.__luaReturns ?? [result]; for (const item of results) push(state, item); return results.length;
  });
  else {
    const entries = Array.isArray(value) ? value.map((v, i) => [i + 1, v]) : Object.entries(value);
    lua.lua_createtable(L, Array.isArray(value) ? value.length : 0, entries.length);
    for (const [key, item] of entries) { push(L, item); if (typeof key === 'number') lua.lua_rawseti(L, -2, key); else lua.lua_setfield(L, -2, to_luastring(key)); }
  }
}
function toJs(L, index, seen = new Map()) {
  const type = lua.lua_type(L, index);
  if (type === lua.LUA_TNIL) return null;
  if (type === lua.LUA_TBOOLEAN) return !!lua.lua_toboolean(L, index);
  if (type === lua.LUA_TNUMBER) return lua.lua_tonumber(L, index);
  if (type === lua.LUA_TSTRING) return to_jsstring(lua.lua_tostring(L, index));
  if (type !== lua.LUA_TTABLE) return `<${to_jsstring(lua.lua_typename(L, type))}>`;
  const ptr = lua.lua_topointer(L, index); if (seen.has(ptr)) return seen.get(ptr);
  const result = {}; seen.set(ptr, result); const abs = lua.lua_absindex(L, index); lua.lua_pushnil(L);
  while (lua.lua_next(L, abs) !== 0) { result[toJs(L, -2, seen)] = toJs(L, -1, seen); lua.lua_pop(L, 1); }
  return result;
}
function run(L, source, name) {
  let status = lauxlib.luaL_loadbuffer(L, to_luastring(source), null, to_luastring(name));
  if (status !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
  status = lua.lua_pcall(L, 0, lua.LUA_MULTRET, 0); if (status !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(L, -1)));
}
function global(L, name, value) { push(L, value); lua.lua_setglobal(L, to_luastring(name)); }

export function createHarness({ globals = {}, savedVariables } = {}) {
  const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
  const calls = { registered: [], printed: [] };
  const defaults = {
    GetServerTime: () => 1790704800, time: value => value && typeof value === 'object' ? Math.floor(new Date(value.year, value.month - 1, value.day, value.hour ?? 0, value.min ?? 0, value.sec ?? 0).getTime() / 1000) : 1790704800,
    GetBuildInfo: () => multi('12.1.0', '69933', 'Sep 2026', 120100),
    UnitGUID: unit => unit === 'player' ? 'Player-1234-ABCDEF' : null,
    UnitName: () => multi('Mumtest', 'Draenor'), GetRealmName: () => 'Draenor',
    UnitClass: () => multi('Mage', 'MAGE', 8), GetLocale: () => 'enGB',
    DEFAULT_CHAT_FRAME: { AddMessage: (_self, message) => calls.printed.push(message) }, SlashCmdList: {},
  };
  for (const [name, value] of Object.entries({ ...defaults, ...globals })) global(L, name, value);
  if (savedVariables !== undefined) global(L, 'MAMChroniclesDB', savedVariables);
  run(L, `
    __mamCalls={registered={}}
    function CreateFrame()
      local f={scripts={},shown=false}
      function f:RegisterEvent(e) if __mamFailEvent==e then error("unsupported event: "..e) end table.insert(__mamCalls.registered,e) end
      function f:SetScript(k,v) self.scripts[k]=v end
      function f:Show() self.shown=true end function f:Hide() self.shown=false end function f:IsShown() return self.shown end
      function f:SetSize() end function f:SetPoint() end function f:SetMovable() end function f:EnableMouse() end
      function f:RegisterForDrag() end function f:SetClampedToScreen() end function f:SetResizable() end function f:SetMinResize() end
      function f:SetBackdrop() end function f:SetBackdropColor() end function f:SetBackdropBorderColor() end function f:SetFrameStrata() end
      function f:SetText(value) self.text=value end function f:SetNormalFontObject() end function f:SetWidth() end function f:SetHeight() end
      function f:CreateFontString() return {SetPoint=function()end,SetText=function()end,SetWidth=function()end,SetJustifyH=function()end,Show=function()end,Hide=function()end} end
      function f:CreateTexture() return {SetAllPoints=function()end,SetColorTexture=function()end,SetPoint=function()end,SetSize=function()end} end
      __mamLastFrame=f return f
    end`, 'frame-stub');
  return {
    load(files) { for (const file of files) run(L, readAddonFile(file), file); },
    run(source) { run(L, source, 'test'); },
    get(expression) { lua.lua_settop(L, 0); let s=lauxlib.luaL_loadstring(L,to_luastring(`return ${expression}`)); if(s!==lua.LUA_OK)throw new Error(to_jsstring(lua.lua_tostring(L,-1))); s=lua.lua_pcall(L,0,1,0);if(s!==lua.LUA_OK)throw new Error(to_jsstring(lua.lua_tostring(L,-1)));return toJs(L,-1); },
    fire(name, ...args) { global(L,'__event',name);global(L,'__args',args);run(L,'local f=MAMChronicles.eventFrame; if f and f.scripts.OnEvent then f.scripts.OnEvent(f,__event,table.unpack(__args)) else MAMChronicles:HandleEvent(__event,table.unpack(__args)) end','event'); },
    slash(command='') { global(L,'__command',command);run(L,'SlashCmdList.MAMCHRONICLES(__command)','slash'); }, calls,
  };
}
