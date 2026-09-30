local Addon = MAMChronicles
local Launcher = {}
Addon.Launcher = Launcher

local ICON = "Interface\\AddOns\\MAMChronicles\\MAMChroniclesIcon"
local DEFAULT_ANGLE = 225
local RADIUS = 80

local function safeMethod(object, method, ...)
  if object and type(object[method]) == "function" then return pcall(object[method], object, ...) end
end
local function finite(value) return type(value) == "number" and value == value and value ~= math.huge and value ~= -math.huge end

local function ui()
  if Addon.db and Addon.db.settings then return Addon.db.settings.ui end
end

function Launcher:SetAngle(angle)
  angle = ((tonumber(angle) or DEFAULT_ANGLE) % 360 + 360) % 360
  if not finite(angle) then angle = DEFAULT_ANGLE end
  local settings = ui()
  if settings then settings.minimapAngle = angle end
  if self.button then
    local radians = math.rad(angle)
    safeMethod(self.button, "ClearAllPoints")
    safeMethod(self.button, "SetPoint", "CENTER", Minimap, "CENTER", math.cos(radians) * RADIUS, math.sin(radians) * RADIUS)
  end
  return angle
end

function Launcher:ResetPosition()
  return self:SetAngle(DEFAULT_ANGLE)
end

function Launcher:UpdateFromCursor()
  if not (Minimap and Minimap.GetCenter and GetCursorPosition) then return end
  local cx, cy = Minimap:GetCenter()
  local scale = (Minimap.GetEffectiveScale and Minimap:GetEffectiveScale()) or 1
  local mx, my = GetCursorPosition()
  if not (finite(cx) and finite(cy) and finite(mx) and finite(my) and finite(scale)) or scale == 0 then return end
  local dx, dy = mx / scale - cx, my / scale - cy
  local radians = math.atan2 and math.atan2(dy, dx) or math.atan(dy, dx)
  if not finite(radians) then return end
  self:SetAngle(math.deg(radians))
end

function Launcher:HandleClick(button)
  if button == "RightButton" then
    if Addon.SettingsPanel and Addon.SettingsPanel.Open then
      Addon.SettingsPanel:Open()
    elseif Addon.UI then
      Addon.UI:Create()
      Addon.UI:SetActiveTab("Settings")
      Addon.UI:Show()
    end
  elseif Addon.UI then
    Addon.UI:Toggle()
  end
end

function Launcher:ShowTooltip(owner)
  local tip = GameTooltip
  if not tip then return end
  safeMethod(tip, "SetOwner", owner or self.button or UIParent, "ANCHOR_LEFT")
  safeMethod(tip, "SetText", "Moms Against Magic Chronicles")
  safeMethod(tip, "AddLine", "Left-click: open or close the Chronicle")
  safeMethod(tip, "AddLine", "Right-click: open settings")
  safeMethod(tip, "AddLine", "Drag: move this button")
  safeMethod(tip, "Show")
end

function Launcher:HideTooltip()
  if GameTooltip then safeMethod(GameTooltip, "Hide") end
end

function Launcher:Show()
  if self.button then safeMethod(self.button, "Show") end
end

function Launcher:Hide()
  if self.button then safeMethod(self.button, "Hide") end
end

function Launcher:ApplyVisibility()
  local settings = Addon.db and Addon.db.settings
  if settings and settings.showMinimapButton == false then self:Hide() else self:Show() end
end

function Launcher:Create()
  if self.button then return self.button end
  if not CreateFrame then return nil end
  local button = CreateFrame("Button", "MAMChroniclesMinimapButton", Minimap or UIParent)
  safeMethod(button, "SetSize", 32, 32)
  safeMethod(button, "SetFrameStrata", "MEDIUM")
  safeMethod(button, "RegisterForClicks", "LeftButtonUp", "RightButtonUp")
  safeMethod(button, "RegisterForDrag", "LeftButton")
  safeMethod(button, "SetClampedToScreen", true)
  local icon = button.CreateTexture and button:CreateTexture(nil, "BACKGROUND")
  if icon then
    safeMethod(icon, "SetTexture", ICON)
    safeMethod(icon, "SetSize", 20, 20)
    safeMethod(icon, "SetPoint", "CENTER", 0, 0)
  end
  local border = button.CreateTexture and button:CreateTexture(nil, "OVERLAY")
  if border then
    safeMethod(border, "SetTexture", "Interface\\Minimap\\MiniMap-TrackingBorder")
    safeMethod(border, "SetSize", 54, 54)
    safeMethod(border, "SetPoint", "TOPLEFT", 0, 0)
  end
  safeMethod(button, "SetHighlightTexture", "Interface\\Minimap\\UI-Minimap-ZoomButton-Highlight")
  safeMethod(button, "SetScript", "OnClick", function(_, mouseButton) Launcher:HandleClick(mouseButton) end)
  safeMethod(button, "SetScript", "OnEnter", function(owner) Launcher:ShowTooltip(owner) end)
  safeMethod(button, "SetScript", "OnLeave", function() Launcher:HideTooltip() end)
  safeMethod(button, "SetScript", "OnDragStart", function(b)
    Launcher:HideTooltip()
    safeMethod(b, "SetScript", "OnUpdate", function() Launcher:UpdateFromCursor() end)
  end)
  safeMethod(button, "SetScript", "OnDragStop", function(b) safeMethod(b, "SetScript", "OnUpdate", nil) end)
  self.button = button
  return button
end

-- A soft glow on the minimap button while something new is waiting (a toast appeared while the window was closed).
function Launcher:SetAttention(on)
  local T = Addon.Theme
  if not (self.button and T) then return false end
  if on and T:CanAnimate() then
    if not self.glow and self.button.CreateTexture then
      local glow = self.button:CreateTexture(nil, "OVERLAY")
      if T.artTheme then
        safeMethod(glow, "SetTexture", T.ART .. "Glow"); safeMethod(glow, "SetSize", 64, 64); safeMethod(glow, "SetPoint", "CENTER", self.button, "CENTER", 0, 0)
      else
        safeMethod(glow, "SetTexture", "Interface\\Minimap\\UI-Minimap-ZoomButton-Highlight"); safeMethod(glow, "SetAllPoints", self.button)
      end
      safeMethod(glow, "SetBlendMode", "ADD")
      self.glow = glow
    end
    if not self.glow then return false end
    safeMethod(self.glow, "Show")
    return T:Pulse(self.glow, 0.25, 1, 1.2)
  end
  if self.glow then T:StopPulse(self.glow); safeMethod(self.glow, "Hide") end
  return false
end

function Launcher:Initialise()
  if not self.button and Addon:InCombat() then Addon:AfterCombat(function() Launcher:Initialise() end); return end
  if not self:Create() then return end
  local settings = ui()
  self:SetAngle(settings and settings.minimapAngle or DEFAULT_ANGLE)
  self:ApplyVisibility()
end

local function frameArg(...)
  for i = 1, select("#", ...) do
    local value = select(i, ...)
    if type(value) == "table" then return value end
  end
end

function MAMChronicles_AddonCompartmentClick(_, mouseButton)
  Launcher:HandleClick(mouseButton)
end

function MAMChronicles_AddonCompartmentEnter(...)
  Launcher:ShowTooltip(frameArg(...))
end

function MAMChronicles_AddonCompartmentLeave()
  Launcher:HideTooltip()
end
