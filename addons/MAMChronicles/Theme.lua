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
  accent   = { 0.720, 0.160, 0.240, 1.00 },
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
}

local function safeMethod(object, method, ...)
  if object and type(object[method]) == "function" then return pcall(object[method], object, ...) end
end

local function unpackColor(color) return color[1], color[2], color[3], color[4] or 1 end

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

function Theme:Fill(frame, layer, color)
  if not (frame and frame.CreateTexture) then return nil end
  local texture = frame:CreateTexture(nil, layer or "BACKGROUND")
  safeMethod(texture, "SetAllPoints", frame)
  safeMethod(texture, "SetColorTexture", unpackColor(color))
  return texture
end

function Theme:Panel(frame, background, border)
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
  if tab.underline then safeMethod(tab.underline, selected and "Show" or "Hide") end
  if tab.label then safeMethod(tab.label, "SetTextColor", unpackColor(selected and self.colors.gold or self.colors.muted)) end
  safeMethod(tab, "SetBackdropColor", unpackColor(restColor(tab)))
end

function Theme:Check(parent, text)
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
  self:Panel(box, self.colors.bg, self.colors.border)
  safeMethod(box, "SetFontObject", "GameFontHighlight")
  safeMethod(box, "SetTextInsets", 8, 8, 4, 4)
  safeMethod(box, "SetScript", "OnEditFocusGained", function(self_) safeMethod(self_, "SetBackdropBorderColor", unpackColor(Theme.colors.gold)) end)
  safeMethod(box, "SetScript", "OnEditFocusLost", function(self_) safeMethod(self_, "SetBackdropBorderColor", unpackColor(Theme.colors.border)) end)
  return box
end
