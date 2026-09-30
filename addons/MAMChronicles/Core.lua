MAMChronicles = MAMChronicles or {}
local Addon = MAMChronicles

Addon.name = "MAMChronicles"
Addon.version = "0.2.0-alpha3"
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

local WELCOME_VERSION = "personal-chronicle-v1"

function Addon:ShowWelcome()
  local settings = self.db and self.db.settings
  if not settings or settings.welcomeVersion == WELCOME_VERSION then return end
  self:Print("Welcome! Type /mam to open your personal Chronicle. Everything stays on this computer; nothing is shared or uploaded.")
  settings.welcomeVersion = WELCOME_VERSION
end

function Addon:Boot()
  if self.booted then return self.db end
  self:IdentifyCharacter()
  self.db = self.Database:Open(MAMChroniclesDB)
  MAMChroniclesDB = self.db
  self.Database:RegisterCharacter(self.characterKey, self.character)
  self.booted = true
  if self.EventStore and self.EventStore.Initialise then self.EventStore:Initialise() end
  if self.Collectors and self.Collectors.Register then self.Collectors:Register() end
  if self.UI and self.UI.InitialiseSlashCommands then self.UI:InitialiseSlashCommands() end
  if self.Launcher and self.Launcher.Initialise then self:SafeCall(self.Launcher.Initialise, self.Launcher) end
  if self.SettingsPanel and self.SettingsPanel.Register then self:SafeCall(self.SettingsPanel.Register, self.SettingsPanel) end
  self:ShowWelcome()
  return self.db
end

function Addon:HandleEvent(eventName, ...)
  if eventName == "ADDON_LOADED" then
    local loadedName = ...
    if loadedName == self.name then self:Boot() end
    return
  end
  if not self.booted then self:Boot() end
  if eventName == "PLAYER_ENTERING_WORLD" and self.AchievementStats then self:SafeCall(self.AchievementStats.Schedule, self.AchievementStats) end
  if self.Collectors then self.Collectors:HandleEvent(eventName, ...) end
end

Addon.eventFrame = CreateFrame and CreateFrame("Frame") or nil
if Addon.eventFrame then
  Addon.eventFrame:RegisterEvent("ADDON_LOADED")
  Addon.eventFrame:SetScript("OnEvent", function(_, eventName, ...) Addon:HandleEvent(eventName, ...) end)
end
