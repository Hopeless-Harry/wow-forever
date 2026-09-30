MAMChronicles = MAMChronicles or {}
local Addon = MAMChronicles

Addon.name = "MAMChronicles"
Addon.version = "0.2.0-alpha9"
Addon.schemaVersion = 1

function Addon:Now()
  local ok, value = pcall(function() return GetServerTime and GetServerTime() end)
  if ok and type(value) == "number" then return math.floor(value) end
  return time and time() or 0
end

function Addon:SafeCall(fn, ...)
  if type(fn) ~= "function" then return nil end
  local function pack(...) return { n = select("#", ...), ... } end
  local results = pack(pcall(fn, ...))
  if not results[1] then return nil end
  return (table.unpack or unpack)(results, 2, results.n)
end

Addon.errorStats = { count = 0, last = nil }

local function shortMessage(label, err)
  local text = tostring(err or "failed")
  text = text:gsub("%a:[/\\]%S*", ""):gsub("Interface[/\\]%S*", ""):gsub("%S*#%d+", ""):gsub("%s+", " "):gsub("^%s+", "")
  return string.sub(tostring(label) .. ": " .. text, 1, 80)
end

function Addon:RecordError(label, err)
  local stats = self.errorStats
  stats.count = stats.count + 1
  stats.last = shortMessage(label, err)
end

-- Runs a handler so one failure never breaks the addon; failures are counted for /mam diag.
function Addon:Guard(label, fn, ...)
  if type(fn) ~= "function" then return nil end
  local results = { n = 0 }
  local function pack(...) results = { n = select("#", ...), ... } end
  pack(pcall(fn, ...))
  if not results[1] then self:RecordError(label, results[2]); return nil end
  return (table.unpack or unpack)(results, 2, results.n)
end

local function normalise(value)
  return string.lower(tostring(value or "unknown")):gsub("[^%w%-]", "-")
end

function Addon:IdentifyCharacter()
  local guid = self:SafeCall(UnitGUID, "player")
  local name, realm = self:SafeCall(UnitName, "player")
  realm = realm or self:SafeCall(GetRealmName) or "unknown"
  local _, _, classID = self:SafeCall(UnitClass, "player")
  self.characterKey = guid or (normalise(name) .. "-" .. normalise(realm))
  self.character = { guid = guid, name = name or "Unknown", realm = realm, classID = classID }
  return self.characterKey
end

function Addon:Print(message)
  if DEFAULT_CHAT_FRAME and DEFAULT_CHAT_FRAME.AddMessage then
    DEFAULT_CHAT_FRAME:AddMessage("|cffc99cffMAM Chronicles:|r " .. tostring(message))
  end
end

local WELCOME_VERSION = "personal-chronicle-v3"

-- One line shown on Home after an update; keep it in step with CHANGELOG.md.
Addon.whatsNewText = "a Getting started card, Copy diagnostics, Medals filters and search, tougher data handling."

function Addon:GetWhatsNew()
  local settings = self.db and self.db.settings
  if not settings or settings.whatsNewVersion ~= self.version or settings.whatsNewSeen == self.version then return nil end
  return "What's new in " .. self.version .. ": " .. self.whatsNewText
end

function Addon:DismissWhatsNew()
  if self.db and self.db.settings then self.db.settings.whatsNewSeen = self.version end
end

function Addon:ShowWelcome()
  local settings = self.db and self.db.settings
  if not settings or settings.welcomeVersion == WELCOME_VERSION then return end
  self:Print("Welcome! Type /mam to begin. Medals you earn are shared with your guild; opt out in Settings.")
  settings.welcomeVersion = WELCOME_VERSION
end

function Addon:Boot()
  if self.booted then return self.db end
  self:IdentifyCharacter()
  self.db = self.Database:Open(MAMChroniclesDB)
  MAMChroniclesDB = self.db
  if self.Theme and self.Theme.ApplyPreset then self.Theme:ApplyPreset(self.db.settings.theme) end
  self.Database:RegisterCharacter(self.characterKey, self.character)
  self.booted = true
  if self.EventStore and self.EventStore.Initialise then self.EventStore:Initialise() end
  if self.Collectors and self.Collectors.Register then self.Collectors:Register() end
  if self.UI and self.UI.InitialiseSlashCommands then self.UI:InitialiseSlashCommands() end
  if self.Launcher and self.Launcher.Initialise then self:Guard("Launcher", self.Launcher.Initialise, self.Launcher) end
  if self.SettingsPanel and self.SettingsPanel.Register then self:Guard("SettingsPanel", self.SettingsPanel.Register, self.SettingsPanel) end
  self:ShowWelcome()
  if self.Toast then self:Guard("Toast", self.Toast.Initialise, self.Toast) end
  if self.Counters then self:Guard("Counters", self.Counters.Initialise, self.Counters) end
  if self.Comms then self:Guard("Comms", self.Comms.Initialise, self.Comms) end
  if self.Medals then self:Guard("Medals", self.Medals.Evaluate, self.Medals, "boot") end
  return self.db
end

function Addon:HandleEvent(eventName, ...)
  if eventName == "ADDON_LOADED" then
    local loadedName = ...
    if loadedName == self.name then self:Boot() end
    return
  end
  if not self.booted then self:Boot() end
  if self.Counters and self.Counters.handles[eventName] then self:Guard("Counters", self.Counters.OnEvent, self.Counters, eventName, ...) end
  if eventName == "CHAT_MSG_ADDON" then
    if self.Comms then self:Guard("Comms", self.Comms.OnAddonMessage, self.Comms, ...) end
    return
  end
  if eventName == "PLAYER_REGEN_ENABLED" and self.Toast then self:Guard("Toast", self.Toast.Flush, self.Toast) end
  if eventName == "PLAYER_ENTERING_WORLD" and self.AchievementStats then self:Guard("Statistics", self.AchievementStats.Schedule, self.AchievementStats) end
  if self.Collectors then self.Collectors:HandleEvent(eventName, ...) end
end

Addon.eventFrame = CreateFrame and CreateFrame("Frame") or nil
if Addon.eventFrame then
  Addon.eventFrame:RegisterEvent("ADDON_LOADED")
  Addon.eventFrame:SetScript("OnEvent", function(_, eventName, ...) Addon:HandleEvent(eventName, ...) end)
end
