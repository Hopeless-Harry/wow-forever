local Addon = MAMChronicles
local Theme = {}
Addon.Theme = Theme

-- Flat, dependency-free look: solid colours on the stock white texture. No custom art,
-- so it behaves the same on Retail and WoW Forever. Accent colours echo the addon icon.
local WHITE = "Interface\\Buttons\\WHITE8x8"
Theme.WHITE = WHITE

Theme.colors = {
  bg       = { 0.050, 0.050, 0.070, 0.97 },
  panel    = { 0.085, 0.085, 0.115, 1.00 },
  raised   = { 0.125, 0.125, 0.165, 1.00 },
  hover    = { 0.190, 0.190, 0.250, 1.00 },
  border   = { 0.240, 0.240, 0.310, 1.00 },
  accent   = { 0.800, 0.210, 0.290, 1.00 },
  gold     = { 0.900, 0.720, 0.280, 1.00 },
  text     = { 0.900, 0.900, 0.930, 1.00 },
  muted    = { 0.620, 0.640, 0.720, 1.00 },
  disabled = { 0.400, 0.410, 0.460, 1.00 },
  danger   = { 0.860, 0.270, 0.300, 1.00 },
  stripe   = { 1.000, 1.000, 1.000, 0.035 },
}

Theme.kindColors = {
  death    = { 0.860, 0.270, 0.300, 1 },
  quest    = { 0.930, 0.740, 0.270, 1 },
  world    = { 0.360, 0.780, 0.520, 1 },
  instance = { 0.380, 0.620, 0.950, 1 },
  loot     = { 0.700, 0.470, 0.930, 1 },
  memory   = { 0.300, 0.800, 0.800, 1 },
}

local typeInfo = {
  ["character.death"]      = { "Death", "death" },
  ["character.resurrected"] = { "Return", "death" },
  ["quest.accepted"]       = { "Quest taken", "quest" },
  ["quest.completed"]      = { "Quest", "quest" },
  ["world.zone_discovered"] = { "Discovery", "world" },
  ["instance.entered"]     = { "Entered", "instance" },
  ["instance.exited"]      = { "Left", "instance" },
  ["loot.notable"]         = { "Loot", "loot" },
  ["profession.changed"]   = { "Profession", "world" },
  ["achievement.earned"]   = { "Achievement", "quest" },
  ["memory.manual"]        = { "Memory", "memory" },
  ["medal.earned"]         = { "Medal", "quest" },
}

local function safeMethod(object, method, ...)
  if object and type(object[method]) == "function" then return pcall(object[method], object, ...) end
end

local function unpackColor(color) return color[1], color[2], color[3], color[4] or 1 end

-- Sheet rectangles for the art themes (defined early so every function below can see them).
local buttonRects = { normal = { 0, 0, 256, 64 }, hover = { 0, 64, 256, 64 }, pressed = { 0, 128, 256, 64 }, disabled = { 0, 192, 256, 64 } }
local tabRects = { normal = { 0, 0, 256, 64 }, selected = { 0, 64, 256, 64 } }

function Theme:Hex(color)
  local function channel(value) return string.format("%02x", math.floor(math.max(0, math.min(1, value or 0)) * 255 + 0.5)) end
  return channel(color[1]) .. channel(color[2]) .. channel(color[3])
end

function Theme:Colorize(text, color)
  return "|cff" .. self:Hex(color) .. tostring(text) .. "|r"
end

function Theme:DescribeType(eventType)
  local info = typeInfo[eventType]
  if info then return info[1], self.kindColors[info[2]] or self.colors.muted end
  local readable = tostring(eventType or "event"):gsub("[%._]", " ")
  return readable:sub(1, 1):upper() .. readable:sub(2), self.colors.muted
end

function Theme:KindFor(eventType)
  local info = typeInfo[eventType]
  return info and info[2] or nil
end

-- Stock font objects have fixed colours (white, grey, gold) that vanish on the light Parchment panel,
-- so every label is created through here and takes its colour from the current palette.
local textRoles = {
  GameFontHighlight = "text", GameFontHighlightSmall = "text", GameFontNormal = "gold", GameFontNormalSmall = "gold",
  GameFontNormalLarge = "gold", GameFontNormalHuge = "gold", GameFontDisable = "muted", GameFontDisableSmall = "muted",
}

function Theme:Text(parent, template)
  -- A font template that a client lacks (for example a newer Huge font) falls back to the Large one instead of failing.
  local ok, fontString = pcall(parent.CreateFontString, parent, nil, "OVERLAY", template)
  if not ok or not fontString then fontString = parent:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge") end
  local role = textRoles[template]
  if role then safeMethod(fontString, "SetTextColor", unpackColor(self.colors[role])) end
  return fontString
end

function Theme:Fill(frame, layer, color)
  if not (frame and frame.CreateTexture) then return nil end
  local texture = frame:CreateTexture(nil, layer or "BACKGROUND")
  safeMethod(texture, "SetAllPoints", frame)
  safeMethod(texture, "SetColorTexture", unpackColor(color))
  return texture
end

function Theme:Panel(frame, background, border)
  if self.artTheme and frame and frame.CreateTexture and not frame.__slices then
    frame.__slices = self:NineSlice(frame, "Inset", { 0, 0, 128, 128 }, 8, "BACKGROUND", 8)
    return frame
  end
  return self:FlatPanel(frame, background, border)
end

function Theme:FlatPanel(frame, background, border)
  background = background or self.colors.panel
  border = border or self.colors.border
  safeMethod(frame, "SetBackdrop", { bgFile = WHITE, edgeFile = WHITE, edgeSize = 1, insets = { left = 1, right = 1, top = 1, bottom = 1 } })
  safeMethod(frame, "SetBackdropColor", unpackColor(background))
  safeMethod(frame, "SetBackdropBorderColor", unpackColor(border))
  return frame
end

function Theme:StyleLabel(label, color)
  safeMethod(label, "SetFontObject", "GameFontHighlight")
  safeMethod(label, "SetTextColor", unpackColor(color or self.colors.text))
end

function Theme:SetEnabled(button, enabled)
  if not button then return end
  safeMethod(button, "SetEnabled", enabled and true or false)
  if button.label then safeMethod(button.label, "SetTextColor", unpackColor(enabled and self.colors.text or self.colors.disabled)) end
  button.themeDisabled = not enabled
end

local function restColor(button)
  if button.themeSelected then return button.selectedFill or Theme.colors.raised end
  return button.restFill or Theme.colors.raised
end

function Theme:Button(parent, text, width, height, options)
  options = options or {}
  if self.artTheme then return self:ArtButtonFrame(parent, text, width, height, options) end
  local button = CreateFrame("Button", nil, parent, "BackdropTemplate")
  safeMethod(button, "SetSize", width or 100, height or 24)
  button.restFill = options.fill or self.colors.raised
  self:Panel(button, button.restFill, self.colors.border)
  local label = button:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  safeMethod(label, "SetPoint", "CENTER", 0, 0)
  safeMethod(button, "SetFontString", label)
  safeMethod(label, "SetTextColor", unpackColor(self.colors.text))
  button.label = label
  safeMethod(button, "SetText", text or "")
  safeMethod(button, "RegisterForClicks", "LeftButtonUp")
  local previousEnter, previousLeave
  safeMethod(button, "SetScript", "OnEnter", function(self_)
    if not self_.themeDisabled then safeMethod(self_, "SetBackdropColor", unpackColor(Theme.colors.hover)) end
  end)
  safeMethod(button, "SetScript", "OnLeave", function(self_)
    safeMethod(self_, "SetBackdropColor", unpackColor(restColor(self_)))
  end)
  return button
end

function Theme:Tab(parent, text, width, height)
  if self.artTheme then return self:ArtTab(parent, text, width, height) end
  local tab = self:Button(parent, text, width, height, { fill = self.colors.panel })
  safeMethod(tab, "SetBackdropBorderColor", 0, 0, 0, 0)
  local underline = tab:CreateTexture(nil, "OVERLAY")
  safeMethod(underline, "SetColorTexture", unpackColor(self.colors.accent))
  safeMethod(underline, "SetPoint", "BOTTOMLEFT", 6, 0)
  safeMethod(underline, "SetPoint", "BOTTOMRIGHT", -6, 0)
  safeMethod(underline, "SetHeight", 2)
  safeMethod(underline, "Hide")
  tab.underline = underline
  tab.selectedFill = self.colors.panel
  return tab
end

function Theme:SetSelected(tab, selected)
  tab.themeSelected = selected and true or false
  if tab.__slices and tab.isTab then
    tab.__slices:SetRect(selected and tabRects.selected or tabRects.normal)
    if tab.label then safeMethod(tab.label, "SetTextColor", unpackColor(selected and self.colors.gold or self.colors.muted)) end
    return
  end
  if tab.underline then safeMethod(tab.underline, selected and "Show" or "Hide") end
  if tab.label then safeMethod(tab.label, "SetTextColor", unpackColor(selected and self.colors.gold or self.colors.muted)) end
  safeMethod(tab, "SetBackdropColor", unpackColor(restColor(tab)))
end

function Theme:Check(parent, text)
  if self.artTheme then return self:ArtCheck(parent, text) end
  local check = CreateFrame("CheckButton", nil, parent, "BackdropTemplate")
  safeMethod(check, "SetSize", 18, 18)
  self:Panel(check, self.colors.bg, self.colors.border)
  safeMethod(check, "SetCheckedTexture", WHITE)
  local mark = check.GetCheckedTexture and check:GetCheckedTexture()
  if mark then
    safeMethod(mark, "SetVertexColor", unpackColor(self.colors.accent))
    safeMethod(mark, "ClearAllPoints")
    safeMethod(mark, "SetPoint", "TOPLEFT", 4, -4)
    safeMethod(mark, "SetPoint", "BOTTOMRIGHT", -4, 4)
  end
  local caption = check:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  safeMethod(caption, "SetPoint", "LEFT", check, "RIGHT", 8, 0)
  safeMethod(caption, "SetText", text or "")
  safeMethod(caption, "SetTextColor", unpackColor(self.colors.text))
  check.caption = caption
  safeMethod(check, "SetScript", "OnEnter", function(self_) safeMethod(self_, "SetBackdropBorderColor", unpackColor(Theme.colors.gold)) end)
  safeMethod(check, "SetScript", "OnLeave", function(self_) safeMethod(self_, "SetBackdropBorderColor", unpackColor(Theme.colors.border)) end)
  return check, caption
end

function Theme:Scrollbar(slider)
  if self.artTheme then return self:ArtScrollbar(slider) end
  self:Panel(slider, self.colors.bg, self.colors.bg)
  safeMethod(slider, "SetThumbTexture", WHITE)
  local thumb = slider.GetThumbTexture and slider:GetThumbTexture()
  if thumb then
    safeMethod(thumb, "SetSize", 8, 42)
    safeMethod(thumb, "SetVertexColor", unpackColor(self.colors.muted))
  end
  return slider
end

function Theme:Input(box)
  if self.artTheme and box and box.CreateTexture then
    self:Panel(box, self.colors.bg, self.colors.border)
    safeMethod(box, "SetFontObject", "GameFontHighlight")
    safeMethod(box, "SetTextInsets", 10, 10, 4, 4)
    safeMethod(box, "SetScript", "OnEditFocusGained", function(b) if b.__slices then b.__slices:SetVertexColor(1, 0.85, 0.45, 1) end end)
    safeMethod(box, "SetScript", "OnEditFocusLost", function(b) if b.__slices then b.__slices:SetVertexColor(1, 1, 1, 1) end end)
    return box
  end
  self:Panel(box, self.colors.bg, self.colors.border)
  safeMethod(box, "SetFontObject", "GameFontHighlight")
  safeMethod(box, "SetTextInsets", 8, 8, 4, 4)
  safeMethod(box, "SetScript", "OnEditFocusGained", function(self_) safeMethod(self_, "SetBackdropBorderColor", unpackColor(Theme.colors.gold)) end)
  safeMethod(box, "SetScript", "OnEditFocusLost", function(self_) safeMethod(self_, "SetBackdropBorderColor", unpackColor(Theme.colors.border)) end)
  return box
end

-- ---------------------------------------------------------------- art (original textures in the Art folder)
-- The Modern theme draws windows, panels, buttons, tabs and more from texture sheets instead of flat colours.
-- Sheets are generated by tools/mam-chronicles/art/make-art.py. The other themes keep the flat look.
Theme.ART = "Interface\\AddOns\\MAMChronicles\\Art\\"
Theme.sheets = {
  Frame = { 256, 256 }, Inset = { 128, 128 }, ButtonRed = { 256, 256 }, ButtonBrown = { 256, 256 }, Tab = { 256, 128 }, Bar = { 256, 64 },
  Badge = { 256, 64 }, Glow = { 128, 128 }, Shadow = { 128, 128 }, Divider = { 256, 16 }, Checkbox = { 128, 64 }, Scroll = { 64, 64 }, Toast = { 512, 128 },
}
Theme.artTheme = false

local sliceMethods = {}
sliceMethods.__index = sliceMethods

function sliceMethods:SetRect(rect)
  local sheet = Theme.sheets[self.sheet]
  local sw, sh = sheet[1], sheet[2]
  local x, y, w, h, s = rect[1], rect[2], rect[3], rect[4], self.slice
  local u = { x / sw, (x + s) / sw, (x + w - s) / sw, (x + w) / sw }
  local v = { y / sh, (y + s) / sh, (y + h - s) / sh, (y + h) / sh }
  for _, part in ipairs(self.parts) do
    safeMethod(part.texture, "SetTexCoord", u[part.col], u[part.col + 1], v[part.row], v[part.row + 1])
  end
  self.rect = rect
end
function sliceMethods:SetVertexColor(r, g, b, a) for _, part in ipairs(self.parts) do safeMethod(part.texture, "SetVertexColor", r, g, b, a or 1) end end
function sliceMethods:SetAlpha(a) for _, part in ipairs(self.parts) do safeMethod(part.texture, "SetAlpha", a) end end
function sliceMethods:Show() for _, part in ipairs(self.parts) do safeMethod(part.texture, "Show") end end
function sliceMethods:Hide() for _, part in ipairs(self.parts) do safeMethod(part.texture, "Hide") end end

-- Stretchable border: the four corners keep their size, the edges and centre stretch. rect = {x, y, w, h} inside the sheet,
-- slice = corner size in sheet pixels, corner = corner size on screen, outset = how far past the frame the art reaches.
function Theme:NineSlice(frame, sheet, rect, slice, layer, corner, outset)
  if not (frame and frame.CreateTexture and self.sheets[sheet]) then return nil end
  corner = corner or slice
  outset = outset or 0
  local group = setmetatable({ sheet = sheet, slice = slice, parts = {}, frame = frame }, sliceMethods)
  local path = self.ART .. sheet
  local function add(col, row, point1, x1, y1, point2, x2, y2, width, height)
    local texture = frame:CreateTexture(nil, layer or "BACKGROUND")
    safeMethod(texture, "SetTexture", path)
    safeMethod(texture, "SetPoint", point1, frame, point1, x1, y1)
    if point2 then safeMethod(texture, "SetPoint", point2, frame, point2, x2, y2) end
    if width then safeMethod(texture, "SetWidth", width) end
    if height then safeMethod(texture, "SetHeight", height) end
    group.parts[#group.parts + 1] = { texture = texture, col = col, row = row }
  end
  local o, c = outset, corner
  add(1, 1, "TOPLEFT", -o, o, nil, nil, nil, c, c)
  add(3, 1, "TOPRIGHT", o, o, nil, nil, nil, c, c)
  add(1, 3, "BOTTOMLEFT", -o, -o, nil, nil, nil, c, c)
  add(3, 3, "BOTTOMRIGHT", o, -o, nil, nil, nil, c, c)
  add(2, 1, "TOPLEFT", c - o, o, "TOPRIGHT", -c + o, o, nil, c)
  add(2, 3, "BOTTOMLEFT", c - o, -o, "BOTTOMRIGHT", -c + o, -o, nil, c)
  add(1, 2, "TOPLEFT", -o, -c + o, "BOTTOMLEFT", -o, c - o, c, nil)
  add(3, 2, "TOPRIGHT", o, -c + o, "BOTTOMRIGHT", o, c - o, c, nil)
  add(2, 2, "TOPLEFT", c - o, -c + o, "BOTTOMRIGHT", -c + o, c - o)
  group:SetRect(rect)
  return group
end


function Theme:ArtButton(button, red)
  local slices = self:NineSlice(button, red and "ButtonRed" or "ButtonBrown", buttonRects.normal, 14, "BACKGROUND", 12)
  button.__slices = slices
  local function state(name) if slices then slices:SetRect(buttonRects[name]) end end
  local function enabled(b) return not (b.themeDisabled or (b.IsEnabled and b.enabled == false)) end
  safeMethod(button, "SetScript", "OnEnter", function(b) if enabled(b) then state("hover") end end)
  safeMethod(button, "SetScript", "OnLeave", function(b) state(enabled(b) and "normal" or "disabled") end)
  safeMethod(button, "SetScript", "OnMouseDown", function(b) if enabled(b) then state("pressed") end end)
  safeMethod(button, "SetScript", "OnMouseUp", function(b) state(enabled(b) and "hover" or "disabled") end)
  button.__setState = state
  return slices
end

-- Lights a panel while the mouse is over it (art panels get a soft wash, flat panels change colour).
function Theme:PanelHover(frame, on)
  if frame.__slices then
    if not frame.__hoverWash and frame.CreateTexture then
      local wash = frame:CreateTexture(nil, "BORDER")
      safeMethod(wash, "SetColorTexture", 1, 0.93, 0.75, 0.07)
      safeMethod(wash, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 3, -3); safeMethod(wash, "SetPoint", "BOTTOMRIGHT", frame, "BOTTOMRIGHT", -3, 3)
      frame.__hoverWash = wash
    end
    if frame.__hoverWash then safeMethod(frame.__hoverWash, on and "Show" or "Hide") end
  else
    local color = on and self.colors.hover or self.colors.panel
    safeMethod(frame, "SetBackdropColor", unpackColor(color))
  end
end

-- The main window: soft shadow and the ornate frame (art themes), or the plain flat panel.
function Theme:Window(frame)
  if not self.artTheme then return self:Panel(frame, self.colors.bg, self.colors.border) end
  frame.__shadow = self:NineSlice(frame, "Shadow", { 0, 0, 128, 128 }, 40, "BACKGROUND", 40, 26)
  frame.__slices = self:NineSlice(frame, "Frame", { 0, 0, 256, 256 }, 18, "BACKGROUND", 18, 0)
  return frame
end

function Theme:ArtButtonFrame(parent, text, width, height, options)
  local button = CreateFrame("Button", nil, parent)
  safeMethod(button, "SetSize", width or 100, height or 24)
  local label = button:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  safeMethod(label, "SetPoint", "CENTER", 0, 0)
  safeMethod(button, "SetFontString", label)
  safeMethod(label, "SetTextColor", unpackColor(options.red and { 1, 0.91, 0.69, 1 } or self.colors.text))
  button.label = label
  self:ArtButton(button, options.red)
  safeMethod(button, "SetText", text or "")
  safeMethod(button, "RegisterForClicks", "LeftButtonUp")
  return button
end

function Theme:ArtTab(parent, text, width, height)
  local tab = CreateFrame("Button", nil, parent)
  safeMethod(tab, "SetSize", width or 84, height or 28)
  local label = tab:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  safeMethod(label, "SetPoint", "CENTER", 0, 1)
  safeMethod(tab, "SetFontString", label)
  safeMethod(label, "SetTextColor", unpackColor(self.colors.muted))
  tab.label = label; tab.isTab = true
  tab.__slices = self:NineSlice(tab, "Tab", tabRects.normal, 12, "BACKGROUND", 10)
  safeMethod(tab, "SetText", text or "")
  safeMethod(tab, "RegisterForClicks", "LeftButtonUp")
  safeMethod(tab, "SetScript", "OnEnter", function(t) if not t.themeSelected then safeMethod(t.label, "SetTextColor", unpackColor(Theme.colors.text)) end end)
  safeMethod(tab, "SetScript", "OnLeave", function(t) if not t.themeSelected then safeMethod(t.label, "SetTextColor", unpackColor(Theme.colors.muted)) end end)
  return tab
end

local checkRects = { unchecked = { 0, 0, 0.5, 1 }, checked = { 0.5, 0, 1, 1 } }

function Theme:ArtCheck(parent, text)
  local check = CreateFrame("CheckButton", nil, parent)
  safeMethod(check, "SetSize", 22, 22)
  local box = check:CreateTexture(nil, "ARTWORK")
  safeMethod(box, "SetTexture", self.ART .. "Checkbox"); safeMethod(box, "SetAllPoints", check)
  check.__box = box
  local function refresh(c)
    local r = (c.GetChecked and c:GetChecked()) and checkRects.checked or checkRects.unchecked
    safeMethod(box, "SetTexCoord", r[1], r[3], r[2], r[4])
  end
  local original = check.SetChecked
  if type(original) == "function" then check.SetChecked = function(c, value) original(c, value); refresh(c) end end
  safeMethod(check, "HookScript", "OnClick", refresh)
  refresh(check)
  local caption = check:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  safeMethod(caption, "SetPoint", "LEFT", check, "RIGHT", 8, 0)
  safeMethod(caption, "SetText", text or "")
  safeMethod(caption, "SetTextColor", unpackColor(self.colors.text))
  check.caption = caption
  safeMethod(check, "SetScript", "OnEnter", function() safeMethod(box, "SetVertexColor", 1, 0.93, 0.7, 1) end)
  safeMethod(check, "SetScript", "OnLeave", function() safeMethod(box, "SetVertexColor", 1, 1, 1, 1) end)
  return check, caption
end

function Theme:ArtScrollbar(slider)
  self:FlatPanel(slider, self.colors.bg, self.colors.bg)
  safeMethod(slider, "SetThumbTexture", self.ART .. "Scroll")
  local thumb = slider.GetThumbTexture and slider:GetThumbTexture()
  if thumb then
    safeMethod(thumb, "SetTexCoord", 0, 0.5, 0, 0.5)
    safeMethod(thumb, "SetSize", 10, 42)
  end
  return slider
end

-- ---------------------------------------------------------------- presets
local function copyPalette(palette)
  local copy = {}
  for key, color in pairs(palette) do copy[key] = { color[1], color[2], color[3], color[4] } end
  return copy
end

Theme.presetOrder = { "modern", "midnight", "parchment", "crimson", "slate" }
Theme.presetNames = { modern = "Modern", midnight = "Midnight", parchment = "Parchment", crimson = "Crimson", slate = "Slate" }
Theme.presets = {
  midnight = copyPalette(Theme.colors),
  -- Warm charcoal and gold, like the game's own windows. Uses the texture art.
  modern = {
    bg = { 0.086, 0.071, 0.055, 1.00 }, panel = { 0.114, 0.094, 0.071, 1.00 }, raised = { 0.165, 0.129, 0.086, 1.00 },
    hover = { 0.227, 0.184, 0.129, 1.00 }, border = { 0.420, 0.333, 0.188, 1.00 }, accent = { 0.850, 0.230, 0.310, 1.00 },
    gold = { 1.000, 0.820, 0.000, 1.00 }, text = { 0.950, 0.920, 0.850, 1.00 }, muted = { 0.745, 0.690, 0.545, 1.00 },
    disabled = { 0.450, 0.420, 0.360, 1.00 }, danger = { 0.900, 0.360, 0.320, 1.00 }, stripe = { 1.000, 1.000, 1.000, 0.030 },
  },
  parchment = {
    bg = { 0.930, 0.890, 0.800, 1.00 }, panel = { 0.890, 0.840, 0.730, 1.00 }, raised = { 0.840, 0.780, 0.660, 1.00 },
    hover = { 0.780, 0.700, 0.560, 1.00 }, border = { 0.550, 0.440, 0.280, 1.00 }, accent = { 0.620, 0.140, 0.160, 1.00 },
    gold = { 0.450, 0.290, 0.050, 1.00 }, text = { 0.160, 0.120, 0.080, 1.00 }, muted = { 0.330, 0.270, 0.180, 1.00 },
    disabled = { 0.580, 0.520, 0.420, 1.00 }, danger = { 0.700, 0.120, 0.120, 1.00 }, stripe = { 0.000, 0.000, 0.000, 0.050 },
  },
  crimson = {
    bg = { 0.070, 0.030, 0.040, 1.00 }, panel = { 0.110, 0.050, 0.060, 1.00 }, raised = { 0.160, 0.070, 0.090, 1.00 },
    hover = { 0.250, 0.100, 0.130, 1.00 }, border = { 0.340, 0.140, 0.170, 1.00 }, accent = { 0.850, 0.200, 0.280, 1.00 },
    gold = { 0.950, 0.750, 0.350, 1.00 }, text = { 0.940, 0.900, 0.900, 1.00 }, muted = { 0.720, 0.620, 0.640, 1.00 },
    disabled = { 0.460, 0.380, 0.400, 1.00 }, danger = { 1.000, 0.350, 0.350, 1.00 }, stripe = { 1.000, 1.000, 1.000, 0.035 },
  },
  slate = {
    bg = { 0.060, 0.080, 0.100, 1.00 }, panel = { 0.090, 0.120, 0.150, 1.00 }, raised = { 0.130, 0.170, 0.210, 1.00 },
    hover = { 0.190, 0.250, 0.310, 1.00 }, border = { 0.240, 0.310, 0.380, 1.00 }, accent = { 0.250, 0.620, 0.850, 1.00 },
    gold = { 0.550, 0.800, 0.900, 1.00 }, text = { 0.900, 0.930, 0.950, 1.00 }, muted = { 0.600, 0.680, 0.750, 1.00 },
    disabled = { 0.380, 0.440, 0.500, 1.00 }, danger = { 0.900, 0.350, 0.350, 1.00 }, stripe = { 1.000, 1.000, 1.000, 0.035 },
  },
}
-- Event and medal-tier colours are tuned for dark panels; Parchment has a light panel and needs darker ones.
Theme.presetKinds = {
  parchment = {
    death = { 0.620, 0.100, 0.120, 1 }, quest = { 0.480, 0.290, 0.000, 1 }, world = { 0.080, 0.380, 0.200, 1 },
    instance = { 0.120, 0.290, 0.640, 1 }, loot = { 0.440, 0.170, 0.600, 1 }, memory = { 0.040, 0.350, 0.370, 1 },
  },
}
Theme.presetTiers = {
  parchment = {
    bronze = { 0.500, 0.260, 0.060, 1 }, silver = { 0.300, 0.330, 0.400, 1 }, gold = { 0.470, 0.330, 0.000, 1 }, platinum = { 0.080, 0.360, 0.480, 1 },
  },
}
Theme.defaultKinds = copyPalette(Theme.kindColors)
Theme.current = "midnight"

local function assignColors(target, source)
  for key, color in pairs(source or {}) do
    local slot = target[key]
    if slot then for index = 1, 4 do slot[index] = color[index] or 1 end end
  end
end

-- Recolours the shared palette in place, so any code holding a reference sees the new colours.
-- Frames that were already built keep the colours they were created with; a UI reload applies it everywhere.
function Theme:ApplyPreset(name)
  if not self.presets[name] then name = "modern" end
  for key, color in pairs(self.presets[name]) do
    local target = self.colors[key]
    for index = 1, 4 do target[index] = color[index] end
  end
  assignColors(self.kindColors, self.presetKinds[name] or self.defaultKinds)
  local medals = Addon.Medals
  if medals and medals.tierColours then
    medals.defaultTiers = medals.defaultTiers or copyPalette(medals.tierColours)
    assignColors(medals.tierColours, self.presetTiers[name] or medals.defaultTiers)
  end
  self.current = name
  self.artTheme = name == "modern"
  return name
end

-- ---------------------------------------------------------------- animations
-- Engine-driven animation groups: nothing here runs Lua per frame. Every helper returns false (and does nothing) when
-- animations are switched off in Settings or the client has no animation API.
function Theme:CanAnimate()
  local settings = Addon.db and Addon.db.settings
  return not (settings and settings.animations == false)
end

local function newGroup(region)
  if type(region) ~= "table" or type(region.CreateAnimationGroup) ~= "function" then return nil end
  local ok, group = pcall(region.CreateAnimationGroup, region)
  if ok and type(group) == "table" then return group end
  return nil
end

local function groupFor(region, field, build)
  local group = region[field]
  if group then return group end
  group = newGroup(region)
  if not group then return nil end
  if build(group) == false then return nil end
  region[field] = group
  return group
end

-- Fades a frame from invisible to fully visible.
function Theme:FadeIn(region, duration)
  if not self:CanAnimate() then return false end
  local group = groupFor(region, "__fadeGroup", function(g)
    local alpha = g:CreateAnimation("Alpha")
    safeMethod(alpha, "SetFromAlpha", 0); safeMethod(alpha, "SetToAlpha", 1); safeMethod(alpha, "SetDuration", duration or 0.15); safeMethod(alpha, "SetSmoothing", "OUT")
    safeMethod(g, "SetToFinalAlpha", true)
  end)
  if not group then return false end
  safeMethod(group, "Stop"); safeMethod(group, "Play")
  return true
end

-- Breathes a region between two alphas until StopPulse.
function Theme:Pulse(region, low, high, period)
  if not self:CanAnimate() then return false end
  local group = groupFor(region, "__pulseGroup", function(g)
    local alpha = g:CreateAnimation("Alpha")
    safeMethod(alpha, "SetFromAlpha", high or 1); safeMethod(alpha, "SetToAlpha", low or 0.5); safeMethod(alpha, "SetDuration", (period or 0.9) / 2); safeMethod(alpha, "SetSmoothing", "IN_OUT")
    safeMethod(g, "SetLooping", "BOUNCE")
  end)
  if not group then return false end
  safeMethod(group, "Play")
  return true
end

function Theme:StopPulse(region)
  local group = type(region) == "table" and region.__pulseGroup
  if group then safeMethod(group, "Stop") end
end

-- Grows a bar out from its left edge.
function Theme:GrowBar(region, duration)
  if not self:CanAnimate() then return false end
  local group = groupFor(region, "__growGroup", function(g)
    local scale = g:CreateAnimation("Scale")
    if type(scale.SetScaleFrom) ~= "function" then return false end
    scale:SetScaleFrom(0.001, 1); scale:SetScaleTo(1, 1)
    safeMethod(scale, "SetOrigin", "LEFT", 0, 0); safeMethod(scale, "SetDuration", duration or 0.35); safeMethod(scale, "SetSmoothing", "OUT")
  end)
  if not group then return false end
  safeMethod(group, "Stop"); safeMethod(group, "Play")
  return true
end

-- A quick "pop": starts small and settles at full size.
function Theme:Pop(region)
  if not self:CanAnimate() then return false end
  local group = groupFor(region, "__popGroup", function(g)
    local scale = g:CreateAnimation("Scale")
    if type(scale.SetScaleFrom) ~= "function" then return false end
    scale:SetScaleFrom(0.6, 0.6); scale:SetScaleTo(1, 1)
    safeMethod(scale, "SetOrigin", "CENTER", 0, 0); safeMethod(scale, "SetDuration", 0.3); safeMethod(scale, "SetSmoothing", "OUT")
  end)
  if not group then return false end
  safeMethod(group, "Stop"); safeMethod(group, "Play")
  return true
end

-- ---------------------------------------------------------------- horizontal slider
function Theme:Slider(parent, width, minimum, maximum, step)
  local slider = CreateFrame("Slider", nil, parent, "BackdropTemplate")
  safeMethod(slider, "SetOrientation", "HORIZONTAL"); safeMethod(slider, "SetSize", width or 220, 16)
  safeMethod(slider, "SetMinMaxValues", minimum or 0, maximum or 100); safeMethod(slider, "SetValueStep", step or 1); safeMethod(slider, "SetObeyStepOnDrag", true)
  self:Panel(slider, self.colors.bg, self.colors.border)
  safeMethod(slider, "SetThumbTexture", WHITE)
  local thumb = slider.GetThumbTexture and slider:GetThumbTexture()
  if thumb then safeMethod(thumb, "SetSize", 10, 20); safeMethod(thumb, "SetVertexColor", unpackColor(self.colors.gold)) end
  return slider
end

-- ---------------------------------------------------------------- scroll area (scroll frame, child, themed scrollbar)
function Theme:ScrollArea(parent)
  local area = { offset = 0, range = 0 }
  area.scroll = CreateFrame("ScrollFrame", nil, parent)
  area.child = CreateFrame("Frame", nil, area.scroll)
  safeMethod(area.scroll, "SetScrollChild", area.child); safeMethod(area.scroll, "EnableMouseWheel", true)
  area.slider = CreateFrame("Slider", nil, parent, "BackdropTemplate")
  safeMethod(area.slider, "SetOrientation", "VERTICAL"); safeMethod(area.slider, "SetWidth", 10); safeMethod(area.slider, "SetMinMaxValues", 0, 0); safeMethod(area.slider, "SetValueStep", 1)
  self:Scrollbar(area.slider)
  safeMethod(area.slider, "Hide"); safeMethod(area.scroll, "Hide")

  function area:SetOffset(value)
    local target = math.max(0, math.min(self.range, tonumber(value) or 0))
    self.offset = target
    safeMethod(self.scroll, "SetVerticalScroll", target)
    self.updating = true; safeMethod(self.slider, "SetValue", target); self.updating = false
    if self.onScroll then self.onScroll(target) end
  end
  function area:Place(parentFrame, top, bottom, side, barWidth)
    safeMethod(self.scroll, "ClearAllPoints")
    safeMethod(self.scroll, "SetPoint", "TOPLEFT", parentFrame, "TOPLEFT", side, -top)
    safeMethod(self.scroll, "SetPoint", "BOTTOMRIGHT", parentFrame, "BOTTOMRIGHT", -(side + barWidth), bottom)
    safeMethod(self.slider, "ClearAllPoints")
    safeMethod(self.slider, "SetPoint", "TOPRIGHT", parentFrame, "TOPRIGHT", -side, -top)
    safeMethod(self.slider, "SetPoint", "BOTTOMRIGHT", parentFrame, "BOTTOMRIGHT", -side, bottom)
  end
  function area:Update(contentHeight, viewHeight, width)
    local view = math.max(40, viewHeight or 0)
    self.range = math.max(0, (contentHeight or 0) - view)
    safeMethod(self.child, "SetSize", width or 600, math.max(contentHeight or 0, view))
    self.updating = true; safeMethod(self.slider, "SetMinMaxValues", 0, self.range); self.updating = false
    self:SetOffset(self.offset)
    safeMethod(self.slider, (self.visible and self.range > 0) and "Show" or "Hide")
  end
  function area:Show() self.visible = true; safeMethod(self.scroll, "Show") end
  function area:Hide() self.visible = false; safeMethod(self.scroll, "Hide"); safeMethod(self.slider, "Hide") end

  safeMethod(area.scroll, "SetScript", "OnMouseWheel", function(_, delta) area:SetOffset(area.offset - delta * 28) end)
  safeMethod(area.slider, "SetScript", "OnValueChanged", function(_, value) if not area.updating then area:SetOffset(value) end end)
  return area
end
