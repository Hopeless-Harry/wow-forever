local Addon = MAMChronicles
local Share = {}
Addon.Share = Share

-- Member side of the guild hub. With the player's consent the addon sends a small summary (level, class, race, title,
-- medal count, Mom Money and a few activity counts) as hidden GUILD addon messages, and only while the guild's
-- gateway has announced itself with a recent G1 beacon. Nothing is whispered and nothing is posted in chat.
-- C1|<ver>|<level>|<classID>|<raceID>|<title>|<medals>|<momMoney>
-- S1|<ver>|<seq>|<part>/<parts>|key=value,key=value
-- F1|<ver>                              (forget me)
Share.version = 1
Share.INTERVAL = 1800        -- seconds between sends of changed numbers
Share.KEEPALIVE = 21600      -- unchanged numbers are still repeated this often so "last heard" stays fresh
Share.BEACON_FRESH = 900     -- a beacon older than this means the gateway is probably offline
Share.TICK = 60
Share.PART_CHARS = 200
Share.MAX_PARTS = 3
Share.POPUP = "MAMCHRONICLES_SHARE_STATS"
Share.nextAt = 0
Share.seq = 0
Share.status = { sent = 0, beacons = 0, ignored = 0 }

-- Only these counters and statistics ever leave the computer. No gold, no names, no locations.
Share.counterKeys = { "wine", "ale", "coffee", "food", "cheese", "cookie", "pie", "soup", "fish", "juice", "water", "bandage", "potion", "jumps" }
Share.statKeys = {
  { key = "kills", patterns = { "creatures killed" } },
  { key = "quests", patterns = { "quests completed" } },
  { key = "deaths", patterns = { "total deaths", "deaths" } },
  { key = "dungeons", patterns = { "total 5-player dungeons entered", "dungeons entered" } },
  { key = "flights", patterns = { "flight paths taken", "flight paths" } },
}

Share.explanation = "Moms Against Magic Chronicles can share a small summary with the guild hub: your character's level, class, race, title, "
  .. "medal count, Mom Money and a few activity counts (for example jumps or drinks). It is sent as hidden addon messages, never as chat or whispers. "
  .. "It never includes chat, gold, item names, BattleTag, account details or exact stats beyond those counts. Change your mind any time in Settings or with /mam share off."

local function now() return Addon:Now() end
local function settings() return Addon.db and Addon.db.settings or {} end
local function safe(fn, ...) return Addon:SafeCall(fn, ...) end
function Share.randomDelay() return math.random(5, 300) end

function Share:Initialise()
  if self.initialised then return end
  self.initialised = true
  self:Schedule()
end

function Share:Schedule()
  if self.scheduled or not (C_Timer and C_Timer.After) then return end
  self.scheduled = true
  C_Timer.After(self.TICK, function()
    Share.scheduled = false
    Addon:Guard("Share", Share.Tick, Share)
    Share:Schedule()
  end)
end

-- ---------------------------------------------------------------- consent
function Share:RegisterPopup()
  if not StaticPopupDialogs then return false end
  StaticPopupDialogs[self.POPUP] = {
    text = self.explanation,
    button1 = "Share", button2 = "Don't share",
    OnAccept = function() Share:SetConsent(true) end,
    OnCancel = function(_, reason) if reason == nil or reason == "clicked" then Share:SetConsent(false) end end,
    timeout = 0, whileDead = true, hideOnEscape = true, preferredIndex = 3,
  }
  return true
end

function Share:AskConsent()
  if self.asked or settings().shareStats ~= nil then return false end
  if not (StaticPopup_Show and self:RegisterPopup()) then return false end
  self.asked = true
  Addon:AfterCombat(function() pcall(StaticPopup_Show, Share.POPUP) end)
  return true
end

function Share:SetConsent(value)
  local config = settings()
  if type(config) ~= "table" then return false end
  config.shareStats = value == true
  if value == true then self.nextAt = now() + self.randomDelay() else self.lastDigest = nil end
  if Addon.db and Addon.db.meta then Addon.db.meta.updatedAt = now() end
  return true
end

-- Asks the gateway to delete everything it holds about this player. Persisted until a gateway has been reached.
function Share:Forget()
  local config = settings()
  if type(config) ~= "table" then return false end
  config.shareStats = false
  config.shareForgetPending = true
  self.lastDigest = nil
  return true
end

-- ---------------------------------------------------------------- beacon
function Share:GatewayOnline()
  return self.lastBeacon ~= nil and now() - self.lastBeacon < self.BEACON_FRESH
end

-- G1|<ver>|<name>  Only a roster rank 0 or 1 sender on the guild channel counts as a gateway.
function Share:OnBeacon(sender, channel, text)
  if channel ~= "GUILD" then self.status.ignored = self.status.ignored + 1; return end
  local version = text:match("^G1|(%d+)|[^%s%c|]+$")
  if tonumber(version) ~= self.version then self.status.ignored = self.status.ignored + 1; return end
  if not (Addon.Comms and Addon.Comms:IsAwarder(sender)) then self.status.ignored = self.status.ignored + 1; return end
  local first = not self:GatewayOnline()
  self.lastBeacon = now()
  self.status.beacons = self.status.beacons + 1
  if first then self.nextAt = math.max(self.nextAt, now() + self.randomDelay()) end
  if settings().shareStats == nil then self:AskConsent() end
end

-- ---------------------------------------------------------------- building messages
local function cleanTitle(title)
  return (tostring(title or ""):gsub("[^%w '%-]", ""):sub(1, 30))
end

function Share:BuildRoster()
  local level = tonumber(safe(UnitLevel, "player")) or 0
  local _, _, classID = safe(UnitClass, "player")
  local _, _, raceID = safe(UnitRace, "player")
  local medals, money, title = 0, 0, ""
  if Addon.Medals then
    medals = tonumber(Addon.Medals:GetSummary().count) or 0
    money = tonumber(Addon.Medals:GetEarnedMoney()) or 0
    title = cleanTitle(Addon.Medals:GetTitle())
  end
  local function whole(value, high) return math.max(0, math.min(high, math.floor(tonumber(value) or 0))) end
  return string.format("C1|%d|%d|%d|%d|%s|%d|%d", self.version, whole(level, 130), whole(classID, 20), whole(raceID, 200), title, whole(medals, 100000), whole(money, 100000000))
end

function Share:CollectStats()
  local pairsList = {}
  local row = Addon.db and Addon.db.counters and Addon.db.counters[Addon.characterKey]
  if type(row) == "table" then
    for _, key in ipairs(self.counterKeys) do
      local value = tonumber(row[key])
      if value and value > 0 then pairsList[#pairsList + 1] = key .. "=" .. string.format("%d", math.min(1000000000, math.floor(value))) end
    end
  end
  if Addon.AchievementStats then
    for _, stat in ipairs(self.statKeys) do
      local _, value = Addon.AchievementStats:FindValue(stat.patterns, Addon.characterKey)
      value = tonumber(value)
      if value and value > 0 then pairsList[#pairsList + 1] = stat.key .. "=" .. string.format("%d", math.min(1000000000, math.floor(value))) end
    end
  end
  return pairsList
end

-- Splits the pairs into at most MAX_PARTS messages. Returns the message texts (without sequence numbers filled in twice).
function Share:BuildStatMessages(pairsList, seq)
  local chunks, current = {}, {}
  local length = 0
  for _, item in ipairs(pairsList) do
    if length + #item + 1 > self.PART_CHARS and #current > 0 then chunks[#chunks + 1] = current; current = {}; length = 0 end
    current[#current + 1] = item; length = length + #item + 1
  end
  if #current > 0 then chunks[#chunks + 1] = current end
  while #chunks > self.MAX_PARTS do table.remove(chunks) end
  local messages = {}
  for index, chunk in ipairs(chunks) do
    messages[#messages + 1] = string.format("S1|%d|%d|%d/%d|%s", self.version, seq, index, #chunks, table.concat(chunk, ","))
  end
  return messages
end

-- ---------------------------------------------------------------- sending
local function queueRoom()
  local comms = Addon.Comms
  return comms and comms.queue and #comms.queue < 6
end

function Share:Enqueue(messages)
  local comms = Addon.Comms
  if not (comms and comms.queue) then return false end
  for _, text in ipairs(messages) do table.insert(comms.queue, text) end
  comms:Pump()
  return true
end

-- Returns a short reason when nothing was sent.
function Share:Tick()
  local config = settings()
  local comms = Addon.Comms
  if not comms then return "unavailable" end
  if IsInGuild and not IsInGuild() then return "not in guild" end
  if not self:GatewayOnline() then return "no gateway" end
  if IsInInstance and safe(IsInInstance) then return "in an instance" end
  if not queueRoom() then return "busy" end
  local unavailable = comms:Availability()
  if unavailable then return unavailable end
  if config.shareForgetPending == true then
    if self:Enqueue({ "F1|" .. self.version }) then config.shareForgetPending = nil; self.status.sent = self.status.sent + 1 end
    return "forget sent"
  end
  if config.shareStats ~= true then return "off" end
  local t = now()
  if t < self.nextAt then return "too soon" end
  local roster = self:BuildRoster()
  local pairsList = self:CollectStats()
  local digest = roster .. "\n" .. table.concat(pairsList, ",")
  if digest == self.lastDigest and self.lastSentAt and t - self.lastSentAt < self.KEEPALIVE then return "unchanged" end
  self.seq = (self.seq % 99999) + 1
  local messages = { roster }
  for _, text in ipairs(self:BuildStatMessages(pairsList, self.seq)) do messages[#messages + 1] = text end
  self:Enqueue(messages)
  self.lastDigest, self.lastSentAt = digest, t
  self.nextAt = t + self.INTERVAL + self.randomDelay()
  self.status.sent = self.status.sent + #messages
  return "sent"
end

function Share:Describe()
  local value = settings().shareStats
  return "Stats sharing: " .. (value == true and "on" or value == false and "off" or "not asked yet")
    .. ", gateway " .. (self:GatewayOnline() and "online" or "not heard") .. ", sent " .. tostring(self.status.sent)
end
