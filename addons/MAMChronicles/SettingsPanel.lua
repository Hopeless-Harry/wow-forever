local Addon = MAMChronicles
local SettingsPanel = {}
Addon.SettingsPanel = SettingsPanel

local PANEL_NAME = "Moms Against Magic Chronicles"
local POPUP = "MAMCHRONICLES_ERASE_HISTORY"
local uiSettings = { enabled = true, recordQuestAccepts = true, recordCoordinates = true, notableQuality = true, maxEvents = true, recordStatistics = true, recordGoldStatistics = true }

local function safeMethod(object, method, ...)
  if object and type(object[method]) == "function" then return pcall(object[method], object, ...) end
end

function SettingsPanel:ApplySetting(key, value)
  if not (Addon.db and Addon.db.settings) then return false end
  if key == "showMinimapButton" then
    Addon.db.settings.showMinimapButton = value == true
    Addon.db.meta.updatedAt = Addon:Now()
    if Addon.Launcher then Addon.Launcher:ApplyVisibility() end
    return true
  end
  if uiSettings[key] and Addon.UI then return Addon.UI:SetSetting(key, value) end
  return false
end

function SettingsPanel:ResetWindow()
  if Addon.UI then Addon.UI:ResetWindow() end
end

function SettingsPanel:ResetMinimap()
  if Addon.Launcher then Addon.Launcher:ResetPosition() end
end

function SettingsPanel:RegisterPopup()
  if not StaticPopupDialogs then return false end
  StaticPopupDialogs[POPUP] = {
    text = "Erase all recorded Chronicle history? Your addon settings will be kept. This cannot be undone.",
    button1 = YES, button2 = NO,
    OnAccept = function()
      Addon.Database:ClearHistory()
      if Addon.UI and Addon.UI.frame then Addon.UI:Refresh() end
    end,
    timeout = 0, whileDead = true, hideOnEscape = true, preferredIndex = 3,
  }
  return true
end

function SettingsPanel:RequestEraseHistory()
  if not (StaticPopup_Show and self:RegisterPopup()) then
    Addon:Print("Erase is unavailable because this client has no confirmation dialog. Nothing was deleted.")
    return false
  end
  StaticPopup_Show(POPUP)
  return true
end

local function addCheckbox(panel, key, text, index)
  local check = CreateFrame("CheckButton", nil, panel, "UICheckButtonTemplate")
  safeMethod(check, "SetPoint", "TOPLEFT", 16, -60 - (index - 1) * 28)
  safeMethod(check, "SetChecked", Addon.db.settings[key] ~= false)
  local caption = check.CreateFontString and check:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  if caption then safeMethod(caption, "SetPoint", "LEFT", check, "RIGHT", 4, 0); safeMethod(caption, "SetText", text) end
  safeMethod(check, "SetScript", "OnClick", function(button)
    local checked = button.GetChecked and button:GetChecked() or false
    SettingsPanel:ApplySetting(key, checked)
  end)
end

local function addButton(panel, text, y, handler)
  local button = CreateFrame("Button", nil, panel, "UIPanelButtonTemplate")
  safeMethod(button, "SetSize", 180, 24)
  safeMethod(button, "SetPoint", "TOPLEFT", 20, y)
  safeMethod(button, "SetText", text)
  safeMethod(button, "SetScript", "OnClick", handler)
  return button
end

function SettingsPanel:BuildPanel()
  local panel = CreateFrame("Frame", "MAMChroniclesSettingsPanel", UIParent)
  panel.name = PANEL_NAME
  local title = panel.CreateFontString and panel:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
  if title then safeMethod(title, "SetPoint", "TOPLEFT", 16, -16); safeMethod(title, "SetText", PANEL_NAME) end
  addCheckbox(panel, "enabled", "Record Chronicle", 1)
  addCheckbox(panel, "recordQuestAccepts", "Record quest accepts", 2)
  addCheckbox(panel, "recordCoordinates", "Attach coordinates to notable events", 3)
  addCheckbox(panel, "showMinimapButton", "Show minimap button", 4)
  addCheckbox(panel, "recordStatistics", "Collect achievement statistics", 5)
  addCheckbox(panel, "recordGoldStatistics", "Include gold statistics (stays on this computer)", 6)
  addButton(panel, "Reset Window", -250, function() SettingsPanel:ResetWindow() end)
  addButton(panel, "Reset Minimap Button", -280, function() SettingsPanel:ResetMinimap() end)
  addButton(panel, "Erase Chronicle Data...", -320, function() SettingsPanel:RequestEraseHistory() end)
  return panel
end

function SettingsPanel:Register()
  if self.registered or not CreateFrame then return self.registered or false end
  self.panel = self:BuildPanel()
  if Settings and Settings.RegisterCanvasLayoutCategory and Settings.RegisterAddOnCategory then
    self.category = Settings.RegisterCanvasLayoutCategory(self.panel, self.panel.name)
    Settings.RegisterAddOnCategory(self.category)
    self.registered = "modern"
  elseif InterfaceOptions_AddCategory then
    InterfaceOptions_AddCategory(self.panel)
    self.registered = "legacy"
  else
    self.registered = false
  end
  return self.registered
end

function SettingsPanel:Open()
  local opened = false
  if self.registered == "modern" and Settings.OpenToCategory then
    local category = self.category
    local id = category and (category.ID or (category.GetID and category:GetID()))
    opened = id ~= nil and pcall(Settings.OpenToCategory, id)
  elseif self.registered == "legacy" and InterfaceOptionsFrame_OpenToCategory then
    -- Legacy client quirk: the first call only opens the frame, the second selects the category.
    opened = pcall(InterfaceOptionsFrame_OpenToCategory, self.panel) and pcall(InterfaceOptionsFrame_OpenToCategory, self.panel)
  end
  if not opened and Addon.UI then
    Addon.UI:Create()
    Addon.UI:SetActiveTab("Settings")
    Addon.UI:Show()
  end
  return opened
end
