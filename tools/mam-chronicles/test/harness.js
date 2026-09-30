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
    UIParent={}; UISpecialFrames={}; Minimap={}; GameTooltip={lines={}}
    function UIParent:GetEffectiveScale() return 1 end
    function Minimap:GetCenter() return 100,100 end
    function Minimap:GetEffectiveScale() return 1 end
    function GameTooltip:SetOwner(owner,anchor) self.owner=owner self.anchor=anchor end
    function GameTooltip:SetText(value) self.lines={value} end
    function GameTooltip:AddLine(value) table.insert(self.lines,value) end
    function GameTooltip:Show() self.shown=true end function GameTooltip:Hide() self.shown=false end
    function GetCursorPosition() return 200,100 end
    function __mamNewGroup()
      local g={anims={},playing=false,plays=0,scripts={}}
      function g:CreateAnimation(kind)
        local a={kind=kind}
        function a:SetDuration(v) self.duration=v end function a:SetFromAlpha(v) self.fromAlpha=v end function a:SetToAlpha(v) self.toAlpha=v end
        function a:SetSmoothing(v) self.smoothing=v end function a:SetOrder(v) self.order=v end function a:SetStartDelay(v) self.delay=v end
        function a:SetScaleFrom(x,y) self.scaleFromX,self.scaleFromY=x,y end function a:SetScaleTo(x,y) self.scaleToX,self.scaleToY=x,y end
        function a:SetOrigin(point) self.origin=point end
        table.insert(self.anims,a) return a
      end
      function g:Play() self.playing=true self.plays=self.plays+1 end function g:Stop() self.playing=false end function g:IsPlaying() return self.playing end
      function g:SetLooping(v) self.looping=v end function g:SetToFinalAlpha(v) self.toFinal=v end function g:SetScript(k,v) self.scripts[k]=v end
      return g
    end
    function CreateFrame(_,name)
      local f={scripts={},shown=false,name=name,width=0,height=0,enabled=true,highlighted=false}
      function f:RegisterEvent(e) if __mamFailEvent==e then error("unsupported event: "..e) end table.insert(__mamCalls.registered,e) end
      function f:SetScript(k,v) self.scripts[k]=v end function f:HookScript(k,fn) local prior=self.scripts[k] self.scripts[k]=function(...) if prior then prior(...) end fn(...) end end
      function f:Show() self.shown=true end function f:Hide() self.shown=false end function f:IsShown() return self.shown end
      function f:SetSize(w,h) self.width=w self.height=h end function f:GetWidth() return self.width end function f:GetHeight() return self.height end
      function f:SetPoint(...) self.point={...} end function f:GetPoint() return table.unpack(self.point or {}) end function f:ClearAllPoints() self.point=nil end
      function f:SetMovable() end function f:EnableMouse() end function f:SetUserPlaced(value) self.userPlaced=value end
      function f:RegisterForDrag() end function f:RegisterForClicks() end function f:SetClampedToScreen() end function f:SetResizable() end function f:SetMinResize(w,h) self.minResize={w,h} end
      function f:SetBackdrop(t) self.backdrop=t end function f:SetBackdropColor(r,g,b,a) self.backdropColor={r,g,b,a} end function f:SetBackdropBorderColor(r,g,b,a) self.borderColor={r,g,b,a} end function f:SetFontString(fs) self.fontString=fs end function f:SetThumbTexture(t) self.thumb=self.thumb or {} self.thumb.texture=t end function f:GetThumbTexture() self.thumb=self.thumb or {SetSize=function()end,SetVertexColor=function(t,r,g,b,a) t.color={r,g,b,a} end} return self.thumb end function f:SetFrameStrata() end
      function f:CreateAnimationGroup() return __mamNewGroup() end function f:SetAlpha(v) self.alpha=v end function f:GetAlpha() return self.alpha or 1 end
      function f:SetText(value) self.text=value end function f:SetNormalFontObject() end function f:SetWidth(value) self.width=value end function f:SetHeight(value) self.height=value end
      function f:SetMinMaxValues(lo,hi) self.minValue=lo self.maxValue=hi end function f:GetValue() return self.value end function f:SetValue(v) self.value=v if self.scripts.OnValueChanged then self.scripts.OnValueChanged(self,v) end end
      function f:GetText() return self.text or "" end function f:SetChecked(v) self.checked=v end function f:GetChecked() return self.checked end function f:SetScrollChild(c) self.scrollChild=c end function f:SetVerticalScroll(v) self.verticalScroll=v end function f:GetVerticalScroll() return self.verticalScroll or 0 end
      function f:SetEnabled(value) self.enabled=value end function f:LockHighlight() self.highlighted=true end function f:UnlockHighlight() self.highlighted=false end
      function f:CreateFontString() return {SetWidth=function(t,v)t.width=v end,GetStringHeight=function(t) local n=1 for _ in tostring(t.text or ""):gmatch("\\n") do n=n+1 end return n*14 end,SetTextColor=function(t,r,g,b,a)t.textColor={r,g,b,a}end,SetFontObject=function()end,SetPoint=function()end,SetText=function(self,v)self.text=v end,SetJustifyH=function()end,Show=function(t)t.shown=true end,Hide=function(t)t.shown=false end} end
      function f:CreateTexture() return {CreateAnimationGroup=function() return __mamNewGroup() end,SetAllPoints=function()end,SetColorTexture=function(t,r,g,b,a)t.color={r,g,b,a}end,SetVertexColor=function(t,r,g,b,a)t.color={r,g,b,a}end,Show=function(t)t.shown=true end,Hide=function(t)t.shown=false end,SetPoint=function(t,...)t.points=t.points or {} table.insert(t.points,{...}) end,SetSize=function(t,w,h)t.width,t.height=w,h end,SetWidth=function(t,v)t.width=v end,SetHeight=function(t,v)t.height=v end,SetAlpha=function(t,v)t.alpha=v end,SetTexture=function(self,value)self.texture=value end,SetTexCoord=function(t,a,b,c,d)t.coord={a,b,c,d} end} end
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
