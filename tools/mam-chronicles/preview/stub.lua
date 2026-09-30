-- Recording stub of the WoW frame API. It keeps anchors, sizes, colours and text so preview.mjs can lay the
-- window out and draw it without the game. It is an approximation: fonts are estimated, not measured.
__pv = { objects = {}, n = 0 }

local fonts = {
  GameFontNormal = { 12, { 1.0, 0.82, 0.0 } }, GameFontNormalSmall = { 10, { 1.0, 0.82, 0.0 } }, GameFontNormalLarge = { 16, { 1.0, 0.82, 0.0 } },
  GameFontHighlight = { 12, { 1, 1, 1 } }, GameFontHighlightSmall = { 10, { 1, 1, 1 } },
  GameFontDisable = { 12, { 0.5, 0.5, 0.5 } }, GameFontDisableSmall = { 10, { 0.5, 0.5, 0.5 } }, GameFontDisableLarge = { 16, { 0.5, 0.5, 0.5 } },
}

local methods = {}
local meta = {
  __index = function(t, k)
    local m = methods[k]
    if m then return m end
    if type(k) == "string" and k:match("^[A-Z]") then return function() end end
    return nil
  end,
}

local function newObject(kind, parent, extra)
  __pv.n = __pv.n + 1
  local o = setmetatable({ id = __pv.n, kind = kind, parent = parent, points = {}, shown = true, children = {}, regions = {}, scripts = {}, alpha = 1 }, meta)
  if extra then for k, v in pairs(extra) do o[k] = v end end
  __pv.objects[o.id] = o
  if parent then
    if kind == "Texture" or kind == "FontString" then table.insert(parent.regions, o) else table.insert(parent.children, o) end
  end
  return o
end

function CreateFrame(kind, name, parent, template)
  local o = newObject(kind or "Frame", parent or UIParent, { name = name, template = template })
  if name then _G[name] = o end
  return o
end

UIParent = newObject("Frame", nil, { name = "UIParent", width = 1280, height = 800 })
Minimap = newObject("Frame", UIParent, { name = "Minimap", width = 140, height = 140 })
Minimap.points = { { "TOPRIGHT", UIParent, "TOPRIGHT", -40, -30 } }
GameTooltip = { lines = {} }
function GameTooltip:SetOwner() end
function GameTooltip:SetText(v) self.lines = { v } end
function GameTooltip:AddLine(v) table.insert(self.lines, v) end
function GameTooltip:Show() end
function GameTooltip:Hide() end
UISpecialFrames = {}

function methods.CreateTexture(self, _, layer) return newObject("Texture", self, { layer = layer or "ARTWORK" }) end
function methods.CreateFontString(self, _, layer, template)
  local f = fonts[template] or fonts.GameFontNormal
  return newObject("FontString", self, { layer = layer or "OVERLAY", size = f[1], color = { f[2][1], f[2][2], f[2][3], 1 }, justify = "LEFT", wrap = true, template = template })
end
function methods.SetPoint(self, point, a, b, c, d)
  local rel, relPoint, x, y = nil, point, 0, 0
  if type(a) == "table" then rel = a; if type(b) == "string" then relPoint = b; x, y = c or 0, d or 0 else x, y = b or 0, c or 0 end
  elseif type(a) == "string" then rel = _G[a]; relPoint = b or point; x, y = c or 0, d or 0
  elseif type(a) == "number" then x, y = a, b or 0 end
  table.insert(self.points, { point, rel, relPoint, x, y })
end
function methods.ClearAllPoints(self) self.points = {} end
function methods.SetAllPoints(self, rel) self.points = { { "TOPLEFT", rel or self.parent, "TOPLEFT", 0, 0 }, { "BOTTOMRIGHT", rel or self.parent, "BOTTOMRIGHT", 0, 0 } } end
function methods.SetSize(self, w, h) self.width, self.height = w, h end
function methods.SetWidth(self, w) self.width = w end
function methods.SetHeight(self, h) self.height = h end
function methods.GetWidth(self) return self.width or 0 end
function methods.GetHeight(self) return self.height or 0 end
function methods.Show(self) self.shown = true end
function methods.Hide(self) self.shown = false end
function methods.IsShown(self) return self.shown end
function methods.SetAlpha(self, a) self.alpha = a end
function methods.SetBackdrop(self, t) self.backdrop = t and true or false end
function methods.SetBackdropColor(self, r, g, b, a) self.bg = { r, g, b, a or 1 } end
function methods.SetBackdropBorderColor(self, r, g, b, a) self.border = { r, g, b, a or 1 } end
function methods.SetColorTexture(self, r, g, b, a) self.color = { r, g, b, a or 1 } end
function methods.SetVertexColor(self, r, g, b, a) self.color = { r, g, b, a or 1 } end
function methods.SetTexture(self, v) self.texture = v end
function methods.SetText(self, v)
  if self.fontString then self.fontString.text = v else self.text = v end
end
function methods.GetText(self) if self.fontString then return self.fontString.text or "" end return self.text or "" end
function methods.SetFontString(self, fs) self.fontString = fs end
function methods.SetTextColor(self, r, g, b, a) self.color = { r, g, b, a or 1 } end
function methods.SetFontObject(self, name) local f = fonts[name]; if f then self.size = f[1]; self.color = { f[2][1], f[2][2], f[2][3], 1 } end end
function methods.SetTextHeight(self, h) self.size = h end
function methods.SetJustifyH(self, v) self.justify = v end
function methods.SetWordWrap(self, v) self.wrap = v end
function methods.GetStringHeight(self)
  local lines = 0
  local width = self.width
  for line in (tostring(self.text or "") .. "\n"):gmatch("(.-)\n") do
    local chars = #line
    local per = width and math.max(1, math.floor(width / (self.size * 0.52))) or chars
    lines = lines + math.max(1, math.ceil(chars / per))
  end
  return lines * (self.size + 3)
end
function methods.SetMinMaxValues(self, lo, hi) self.minValue, self.maxValue = lo, hi end
function methods.SetValue(self, v) self.value = v; if self.scripts.OnValueChanged then self.scripts.OnValueChanged(self, v) end end
function methods.GetValue(self) return self.value end
function methods.SetScrollChild(self, c) self.scrollChild = c; c.isScrollChild = true end
function methods.SetVerticalScroll(self, v) self.vscroll = v end
function methods.GetVerticalScroll(self) return self.vscroll or 0 end
function methods.SetChecked(self, v) self.checked = v end
function methods.GetChecked(self) return self.checked end
function methods.SetEnabled(self, v) self.enabled = v end
function methods.LockHighlight(self) self.highlighted = true end
function methods.UnlockHighlight(self) self.highlighted = false end
function methods.SetScript(self, k, v) self.scripts[k] = v end
function methods.HookScript(self, k, fn) local prior = self.scripts[k]; self.scripts[k] = function(...) if prior then prior(...) end fn(...) end end
function methods.GetPoint(self) local p = self.points[1]; if p then return p[1], p[2], p[3], p[4], p[5] end end
function methods.GetThumbTexture(self)
  if not self.thumb then self.thumb = newObject("Texture", self, { layer = "OVERLAY" }); self.thumb.isThumb = true end
  return self.thumb
end
function methods.GetCenter() return 640, 400 end
function methods.GetEffectiveScale() return 1 end
function methods.GetEffectiveScale() return 1 end

-- ---------------------------------------------------------------- serialiser
local function esc(s)
  return (tostring(s):gsub('[%c"\\]', function(c)
    if c == '"' then return '\\"' elseif c == "\\" then return "\\\\" elseif c == "\n" then return "\\n" end
    return string.format("\\u%04x", c:byte())
  end))
end
local function num(n) if type(n) ~= "number" or n ~= n then return "null" end return tostring(n) end
local function arr(t) if not t then return "null" end local p = {} for i = 1, #t do p[i] = num(t[i]) end return "[" .. table.concat(p, ",") .. "]" end

function __pv.dump()
  local out = {}
  for id = 1, __pv.n do
    local o = __pv.objects[id]
    local pts = {}
    for _, p in ipairs(o.points) do
      pts[#pts + 1] = string.format('{"p":"%s","rel":%s,"rp":"%s","x":%s,"y":%s}', p[1], p[2] and num(p[2].id) or "null", tostring(p[3]), num(p[4]), num(p[5]))
    end
    local text = o.text
    out[#out + 1] = string.format(
      '{"id":%d,"kind":"%s","parent":%s,"shown":%s,"w":%s,"h":%s,"points":[%s],"bg":%s,"border":%s,"color":%s,"text":%s,"size":%s,"justify":"%s","wrap":%s,"layer":"%s","scroll":%s,"scrollChild":%s,"thumb":%s,"highlighted":%s,"alpha":%s,"label":%s,"name":%s}',
      o.id, o.kind, o.parent and num(o.parent.id) or "null", tostring(o.shown), num(o.width), num(o.height), table.concat(pts, ","),
      arr(o.bg), arr(o.border), arr(o.color), text and ('"' .. esc(text) .. '"') or "null", num(o.size), o.justify or "LEFT", tostring(o.wrap ~= false),
      o.layer or "", num(o.vscroll), o.scrollChild and num(o.scrollChild.id) or "null", tostring(o.isThumb == true), tostring(o.highlighted == true), num(o.alpha),
      o.fontString and num(o.fontString.id) or "null", o.name and ('"' .. esc(o.name) .. '"') or "null")
  end
  return "[" .. table.concat(out, ",") .. "]"
end
