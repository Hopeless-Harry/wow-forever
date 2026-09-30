local Addon = MAMChronicles
local Comms = {}
Addon.Comms = Comms

-- Guild medal announcements over hidden addon messages. Only the medal id, its points and the
-- definition version are sent: never chat, location, gold or history. Everything degrades quietly
-- when the client or realm restricts addon messages.
local PREFIX = "MAMCHR"
local MAX_LENGTH = 64
local SEND_INTERVAL = 3
local CHAT_INTERVAL = 30
local RESTRICT_BACKOFF = 600
local FLOOD_LIMIT, FLOOD_WINDOW = 5, 60
local FEED_MAX = 50

Comms.prefix = PREFIX
Comms.queue = {}
Comms.floods = {}
Comms.status = { state = "starting", sent = 0, received = 0, dropped = 0, unknown = 0, otherVersion = 0 }

local function now() return Addon:Now() end
local function settings() return Addon.db and Addon.db.settings or {} end
local function drop(self) self.status.dropped = self.status.dropped + 1 end

function Comms:Initialise()
  if self.initialised then return end
  self.initialised = true
  local register = C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix or RegisterAddonMessagePrefix
  local registered = false
  if register then registered = select(1, pcall(register, PREFIX)) end
  if Addon.eventFrame then pcall(function() Addon.eventFrame:RegisterEvent("CHAT_MSG_ADDON") end) end
  if Addon.Medals then Addon.Medals:AddListener(function(def, info) Comms:OnMedal(def, info) end) end
  self.status.state = registered and "ready" or "unavailable"
end

local function sendFunction()
  if C_ChatInfo and C_ChatInfo.SendAddonMessage then return C_ChatInfo.SendAddonMessage end
  return SendAddonMessage
end

function Comms:Availability()
  if not sendFunction() then return "unavailable" end
  if IsInGuild and not IsInGuild() then return "not in guild" end
  if self.restrictedUntil and now() < self.restrictedUntil then return "restricted" end
  return nil
end

local function classify(ok, result)
  if not ok then return "restricted" end
  local success = Enum and Enum.SendAddonMessageResult and Enum.SendAddonMessageResult.Success
  if result == nil or result == true or result == 0 or (success ~= nil and result == success) then return "sent" end
  local codes = Enum and Enum.SendAddonMessageResult
  if result == 3 or result == 8 or (codes and (result == codes.AddonMessageThrottle or result == codes.ChannelThrottle)) then return "throttled" end
  return "restricted"
end

function Comms:SchedulePump()
  if self.pumpScheduled or not (C_Timer and C_Timer.After) then return end
  self.pumpScheduled = true
  C_Timer.After(SEND_INTERVAL, function() Comms.pumpScheduled = false; Comms:Pump() end)
end

function Comms:Pump()
  if #self.queue == 0 then return end
  local reason = self:Availability()
  if reason then
    self.status.state = reason
    self.queue = {}
    return
  end
  if self.lastSent and now() - self.lastSent < SEND_INTERVAL then self:SchedulePump(); return end
  local text = self.queue[1]
  local outcome = classify(pcall(sendFunction(), PREFIX, text, "GUILD"))
  if outcome == "sent" then
    table.remove(self.queue, 1)
    self.lastSent = now(); self.status.sent = self.status.sent + 1; self.status.state = "ready"
    if #self.queue > 0 then self:SchedulePump() end
  elseif outcome == "throttled" then
    self.lastSent = now(); self:SchedulePump()
  else
    self.status.state = "restricted"; self.restrictedUntil = now() + RESTRICT_BACKOFF; self.queue = {}
  end
end

function Comms:OnMedal(def, info)
  if not def or not info or info.retro or info.summary then return end
  local config = settings()
  if config.announceMedals then
    table.insert(self.queue, string.format("M1|%s|%d|%d", def.id, def.points, Addon.Medals.version))
    self:Pump()
  end
  if config.announceGuildChat and IsInGuild and IsInGuild() and (SendChatMessage or (C_ChatInfo and C_ChatInfo.SendChatMessage)) and (not self.lastChat or now() - self.lastChat >= CHAT_INTERVAL) then
    local who = Addon.character and Addon.character.name or "Someone"
    local line = "[Moms Against Magic Chronicles] " .. who .. " earned the " .. def.name .. " Mom Medal (+" .. tostring(def.points) .. " Mom Money)!"
    if pcall(C_ChatInfo and C_ChatInfo.SendChatMessage or SendChatMessage, line, "GUILD") then self.lastChat = now() end
  end
end

local function shortName(sender) return (tostring(sender):match("^[^-]+")) or tostring(sender) end

function Comms:Record(sender, def)
  local database = Addon.db
  if not database then return false end
  database.guildFeed = type(database.guildFeed) == "table" and database.guildFeed or {}
  for _, entry in ipairs(database.guildFeed) do if entry.sender == sender and entry.id == def.id then return false end end
  table.insert(database.guildFeed, 1, { sender = sender, id = def.id, name = def.name, points = def.points, at = now() })
  while #database.guildFeed > FEED_MAX do table.remove(database.guildFeed) end
  if Addon.Toast then
    Addon.Toast:Show({ kind = "guild", title = shortName(sender) .. " earned " .. def.name, text = def.description, points = def.points, action = "Medals" })
  end
  return true
end

function Comms:OnAddonMessage(prefix, text, channel, sender)
  if prefix ~= PREFIX then return end
  if channel ~= "GUILD" then drop(self); return end
  sender = tostring(sender or "")
  if #sender == 0 or #sender > 60 or sender:find("[%c|]") then drop(self); return end
  local player = Addon:SafeCall(UnitName, "player")
  if player and shortName(sender) == player then return end
  if settings().receiveGuildAlerts == false then return end
  if type(text) ~= "string" or #text > MAX_LENGTH then drop(self); return end
  local parts = {}
  for piece in (text .. "|"):gmatch("([^|]*)|") do table.insert(parts, piece) end
  if #parts ~= 4 or parts[1] ~= "M1" then drop(self); return end
  if not parts[2]:match("^[%w_]+$") or #parts[2] > 40 then drop(self); return end
  local def = Addon.Medals and Addon.Medals:GetDefinition(parts[2])
  -- A newer or older build may know medals this one does not: count them quietly instead of treating them as attacks.
  local kind
  if not def then kind = "unknown"
  elseif tonumber(parts[4]) ~= Addon.Medals.version then kind = "otherVersion"
  elseif tonumber(parts[3]) ~= def.points then drop(self); return end
  local stamps = self.floods[sender] or {}
  local kept, current = {}, now()
  for _, stamp in ipairs(stamps) do if current - stamp < FLOOD_WINDOW then table.insert(kept, stamp) end end
  if #kept >= FLOOD_LIMIT then self.floods[sender] = kept; drop(self); return end
  table.insert(kept, current); self.floods[sender] = kept
  if kind then self.status[kind] = self.status[kind] + 1; return end
  self.status.received = self.status.received + 1
  self:Record(sender, def)
end
