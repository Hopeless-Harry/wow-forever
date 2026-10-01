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
local QUEUE_MAX = 10
local LOCKDOWN_RETRY = 15

Comms.prefix = PREFIX
Comms.queue = {}
-- Longest accepted message per guild hub type; everything else keeps the 64 character limit.
Comms.hubLimits = { G1 = 40, C1 = 90, S1 = 240, F1 = 8, N1 = 240, Q1 = 120, K1 = 140 }
Comms.floods = {}
local ROSTER_MAX = 200

-- Last known totals of guildmates, kept between sessions so the leaderboard is not empty after a /reload.
local function rosterTable()
  local database = Addon.db
  if not database then return nil end
  if type(database.guildRoster) ~= "table" then database.guildRoster = {} end
  return database.guildRoster
end
local SUMMARY_DELAY = 20
Comms.status = { state = "starting", sent = 0, received = 0, dropped = 0, unknown = 0, otherVersion = 0, awards = 0, unverified = 0 }

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
  self:RequestRoster()
end

-- On login (Core calls this), so guildmates who missed the live toasts can still see where you stand.
function Comms:ScheduleSummary()
  if not (C_Timer and C_Timer.After) then return end
  C_Timer.After(SUMMARY_DELAY, function() Addon:Guard("Comms", Comms.SendSummary, Comms) end)
end

-- T1|<medal count>|<Mom Money>|<definition version>. Totals only: no medal ids, names, places or history.
function Comms:SendSummary(force)
  if settings().announceMedals ~= true or not Addon.Medals then return false end
  local summary = Addon.Medals:GetSummary()
  local money = tonumber(Addon.Medals:GetMomMoney()) or 0
  local count = math.max(0, math.min(99999, math.floor(tonumber(summary.count) or 0)))
  if count == 0 then return false end
  -- /reload fires login again; one total per ten minutes is plenty.
  if not force and self.lastSummary and now() - self.lastSummary < 600 then return false end
  self.lastSummary = now()
  while #self.queue >= QUEUE_MAX do table.remove(self.queue, 1) end
  table.insert(self.queue, string.format("T1|%d|%d|%d", count, math.max(0, math.min(9999999, math.floor(money))), Addon.Medals.version))
  self:Pump()
  return true
end


local function sendFunction()
  if C_ChatInfo and C_ChatInfo.SendAddonMessage then return C_ChatInfo.SendAddonMessage end
  return SendAddonMessage
end

-- Midnight can switch addon messages off for the whole realm (outgoing restricted) or only for a while (chat messaging
-- lockdown: boss encounters, Mythic+ and rated PvP). A lockdown is temporary, so messages wait for it instead of being dropped.
local function flag(fn)
  if type(fn) ~= "function" then return false end
  local ok, value = pcall(fn)
  return ok and value == true
end

function Comms:Availability()
  if not sendFunction() then return "unavailable" end
  if IsInGuild and not IsInGuild() then return "not in guild" end
  if self.restrictedUntil and now() < self.restrictedUntil then return "restricted" end
  if C_ChatInfo and flag(C_ChatInfo.AreOutgoingAddonChatMessagesRestricted) then return "restricted" end
  if C_ChatInfo and flag(C_ChatInfo.InChatMessagingLockdown) then return "locked" end
  if C_RestrictedActions and flag(C_RestrictedActions.IsInRestrictedInstance) then return "locked" end
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

-- Sends one prebuilt message to the guild channel (used by Map.lua). Returns "sent", "throttled", "restricted" or a reason.
function Comms:SendRaw(text)
  local reason = self:Availability()
  if reason then return reason end
  local outcome = classify(pcall(sendFunction(), PREFIX, text, "GUILD"))
  if outcome == "restricted" then self.status.state = "restricted"; self.restrictedUntil = now() + RESTRICT_BACKOFF end
  return outcome
end

function Comms:Pump()
  if #self.queue == 0 then return end
  local reason = self:Availability()
  if reason == "locked" then
    -- Keep the queued announcements and look again shortly; PLAYER_ENTERING_WORLD also triggers a pump.
    self.status.state = reason
    if not self.lockdownScheduled and C_Timer and C_Timer.After then
      self.lockdownScheduled = true
      C_Timer.After(LOCKDOWN_RETRY, function() Comms.lockdownScheduled = false; Comms:Pump() end)
    end
    return
  end
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
    while #self.queue >= QUEUE_MAX do table.remove(self.queue, 1) end
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

-- Sorted list of guildmates whose totals were received this session.
function Comms:GetRoster()
  local list = {}
  for name, entry in pairs(rosterTable() or {}) do
    if type(entry) == "table" and tonumber(entry.count) and tonumber(entry.points) then list[#list + 1] = { name = name, count = entry.count, points = entry.points, at = tonumber(entry.at) or 0 } end
  end
  table.sort(list, function(a, b) if a.points ~= b.points then return a.points > b.points end return a.name < b.name end)
  return list
end

function Comms:HandleSummary(sender, channel, parts)
  if channel ~= "GUILD" or settings().receiveGuildAlerts == false then return end
  -- Totals are sent once per login, so more than two a minute from one sender is noise.
  local stamps, kept, current = self.floods["T:" .. sender] or {}, {}, now()
  for _, stamp in ipairs(stamps) do if current - stamp < FLOOD_WINDOW then kept[#kept + 1] = stamp end end
  if #kept >= 2 then self.floods["T:" .. sender] = kept; drop(self); return end
  kept[#kept + 1] = current; self.floods["T:" .. sender] = kept
  local count, points, version = tonumber(parts[2]), tonumber(parts[3]), tonumber(parts[4])
  if not (count and points and version) or count ~= math.floor(count) or points ~= math.floor(points) then drop(self); return end
  if count < 0 or count > 99999 or points < 0 or points > 9999999 then drop(self); return end
  if version ~= Addon.Medals.version then self.status.otherVersion = self.status.otherVersion + 1; return end
  local name = shortName(sender)
  local roster = rosterTable()
  if not roster then return end
  if not roster[name] then
    local total, oldest, oldestAt = 0, nil, nil
    for known, entry in pairs(roster) do
      total = total + 1
      local stamp = type(entry) == "table" and tonumber(entry.at) or 0
      if not oldestAt or stamp < oldestAt then oldest, oldestAt = known, stamp end
    end
    if total >= ROSTER_MAX and oldest then roster[oldest] = nil end
  end
  roster[name] = { count = count, points = points, at = now() }
end

-- Guild roster helpers. The rank comes from the roster the client has cached; an empty or stale roster fails closed.
function Comms:RequestRoster()
  if C_GuildInfo and C_GuildInfo.GuildRoster then pcall(C_GuildInfo.GuildRoster)
  elseif GuildRoster then pcall(GuildRoster) end
end

-- Rank index of a character on the cached roster (0 is the Guild Master), or nil when they are not on it.
function Comms:RosterRank(name)
  if not (GetNumGuildMembers and GetGuildRosterInfo) then return nil end
  local wanted = string.lower(shortName(name))
  local total = tonumber(Addon:SafeCall(GetNumGuildMembers)) or 0
  for index = 1, total do
    local member, _, rank = Addon:SafeCall(GetGuildRosterInfo, index)
    if member and string.lower(shortName(member)) == wanted then return tonumber(rank) end
  end
  return nil
end

function Comms:IsGuildmate(name) return self:RosterRank(name) ~= nil end
function Comms:IsGuildLead(name) return self:RosterRank(name) == 0 end
-- Ranks 0 (Guild Master) and 1 may confirm and award guild-verified medals.
function Comms:IsAwarder(name) local rank = self:RosterRank(name); return rank ~= nil and rank <= 1 end

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

-- Award (A1) and revoke (R1) messages: `<type>|<recipient>|<medalId>|<version>`.
-- Real ones need the sender to be rank 0 or 1 on the guild channel. Test mode also accepts whispers.
function Comms:HandleAward(kind, channel, sender, parts)
  local test = false
  if channel == "GUILD" then
    if not self:IsAwarder(sender) then self.status.unverified = self.status.unverified + 1; self:RequestRoster(); return end
  elseif channel == "WHISPER" and self.testMode == true then
    test = true
  else
    drop(self); return
  end
  local player = Addon:SafeCall(UnitName, "player")
  if not player or string.lower(shortName(parts[2])) ~= string.lower(player) then return end
  local def = Addon.Medals and Addon.Medals:GetDefinition(parts[3])
  if not (def and def.verified) or tonumber(parts[4]) ~= Addon.Medals.version then drop(self); return end
  local ok
  if kind == "A1" then ok = Addon.Medals:GrantVerified(def.id, { test = test }) else ok = Addon.Medals:RevokeVerified(def.id, test and { testOnly = true } or nil) end
  if ok then self.status.awards = self.status.awards + 1 end
end

function Comms:OnAddonMessage(prefix, text, channel, sender)
  -- Inside restricted content the payload and sender can be secret values that cannot be measured or matched.
  if Addon:IsSecret(prefix) or Addon:IsSecret(text) or Addon:IsSecret(channel) or Addon:IsSecret(sender) then return end
  if prefix ~= PREFIX then return end
  if channel ~= "GUILD" and channel ~= "WHISPER" then drop(self); return end
  sender = tostring(sender or "")
  if #sender == 0 or #sender > 60 or sender:find("[%c|]") then drop(self); return end
  local player = Addon:SafeCall(UnitName, "player")
  if player and shortName(sender) == player then return end
  if type(text) ~= "string" or #text > (self.hubLimits[text:sub(1, 2)] or MAX_LENGTH) then drop(self); return end
  -- Guild hub messages (G1 beacon, C1/S1/F1 member summaries): handled by Share.lua and Gateway.lua, guild channel only.
  if self.hubLimits[text:sub(1, 2)] and text:sub(3, 3) == "|" then
    if channel ~= "GUILD" then drop(self); return end
    local head = text:sub(1, 2)
    if head == "G1" and Addon.Share then Addon:Guard("Share", Addon.Share.OnBeacon, Addon.Share, sender, channel, text)
    elseif (head == "N1" or head == "Q1" or head == "K1") and Addon.Orders then Addon:Guard("Orders", Addon.Orders.OnMessage, Addon.Orders, sender, text)
    elseif Addon.Gateway and Addon.Gateway.OnMessage then Addon:Guard("Gateway", Addon.Gateway.OnMessage, Addon.Gateway, sender, text) end
    return
  end
  -- Live location updates (L1) are handled by Map.lua, guild channel only.
  if text:sub(1, 3) == "L1|" then
    if channel == "GUILD" and Addon.Map then Addon:Guard("Map", Addon.Map.OnMessage, Addon.Map, sender, text) else drop(self) end
    return
  end
  local parts = {}
  for piece in (text .. "|"):gmatch("([^|]*)|") do table.insert(parts, piece) end
  if #parts ~= 4 then drop(self); return end
  if parts[1] == "A1" or parts[1] == "R1" then
    if not (parts[2]:match("^[^%s%c|]+$") and #parts[2] <= 24 and parts[3]:match("^[%w_]+$") and #parts[3] <= 40) then drop(self); return end
    self:HandleAward(parts[1], channel, sender, parts)
    return
  end
  if parts[1] == "T1" then self:HandleSummary(sender, channel, parts); return end
  if parts[1] ~= "M1" or channel ~= "GUILD" then drop(self); return end
  if settings().receiveGuildAlerts == false then return end
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

-- The UI shows award actions to ranks 0 and 1 (or in test mode). The real check is on every receiver.
function Comms:CanAward()
  local player = Addon:SafeCall(UnitName, "player")
  return self.testMode == true or (player ~= nil and self:IsAwarder(player))
end

function Comms:ApplyLocal(kind, medalId)
  if kind == "A1" then return Addon.Medals:GrantVerified(medalId, { test = true }) end
  return Addon.Medals:RevokeVerified(medalId, { testOnly = true })
end

-- kind is "A1" (award) or "R1" (revoke). Returns ok, reason.
function Comms:SendAward(kind, recipient, medalId)
  local def = Addon.Medals and Addon.Medals:GetDefinition(medalId)
  if not (def and def.verified) then return false, "not a verified medal" end
  recipient = tostring(recipient or "")
  if not (recipient:match("^[^%s%c|]+$") and #recipient <= 24) then return false, "bad character name" end
  local text = string.format("%s|%s|%s|%d", kind, recipient, medalId, Addon.Medals.version)
  if #text > MAX_LENGTH then return false, "message too long" end
  local player = Addon:SafeCall(UnitName, "player")
  if self.testMode == true then
    if player and string.lower(shortName(recipient)) == string.lower(player) then return self:ApplyLocal(kind, medalId) end
    local send = sendFunction()
    if not send then return false, "unavailable" end
    local outcome = classify(pcall(send, PREFIX, text, "WHISPER", recipient))
    return outcome == "sent", outcome
  end
  self:RequestRoster()
  if not (player and self:IsAwarder(player)) then return false, "only the Guild Master or rank 1 can award medals (guild roster may still be loading)" end
  local reason = self:Availability()
  if reason then return false, reason end
  local outcome = classify(pcall(sendFunction(), PREFIX, text, "GUILD"))
  return outcome == "sent", outcome
end
