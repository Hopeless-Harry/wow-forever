local Addon = MAMChronicles
local Gateway = {}
Addon.Gateway = Gateway

-- Gateway mode (owner only). The owner's client announces itself with a G1 beacon, listens for the hidden C1/S1/F1
-- messages members send with their consent, and keeps what it hears in MAMChroniclesDB.gateway. The game writes that
-- table to disk at /reload or logout; the companion app on the owner's PC reads it and uploads to the Pi.
-- Only a character of rank 0 or 1 can be a gateway, because members only trust beacons from those ranks.
Gateway.version = 1
Gateway.BEACON_INTERVAL = 600
Gateway.TICK = 60
Gateway.MAX_MEMBERS = 300
Gateway.MAX_STATS = 40
Gateway.MAX_FORGET = 50
Gateway.MAX_PAIRS = 20
Gateway.PENDING_EXPIRE = 60
Gateway.FLOOD_LIMIT, Gateway.FLOOD_WINDOW = 8, 60
Gateway.READY_CACHE = 30
Gateway.status = { received = 0, dropped = 0, forgotten = 0, beacons = 0 }
Gateway.floods = {}
Gateway.pending = {}

local function now() return Addon:Now() end
local function settings() return Addon.db and Addon.db.settings or {} end
local function safe(fn, ...) return Addon:SafeCall(fn, ...) end
local function shortName(sender) return (tostring(sender):match("^[^-]+")) or tostring(sender) end
local function validName(name) return type(name) == "string" and #name >= 1 and #name <= 24 and name:match("^[^%s%c|]+$") ~= nil end
local function drop(self) self.status.dropped = self.status.dropped + 1 end

local function split(text)
  local parts = {}
  for piece in (text .. "|"):gmatch("([^|]*)|") do parts[#parts + 1] = piece end
  return parts
end

local function wholeNumber(text, low, high)
  if type(text) ~= "string" or not text:match("^%d+$") or #text > 10 then return nil end
  local value = tonumber(text)
  if value < low or value > high then return nil end
  return value
end

function Gateway:Enabled() return settings().gatewayMode == true end

local function playerName() return (safe(UnitName, "player")) end

-- Only rank 0 or 1 may act as the gateway (members accept beacons only from those ranks).
function Gateway:IsReady()
  if not self:Enabled() then return false end
  local t = now()
  if self.readyAt and t - self.readyAt < self.READY_CACHE then return self.readyValue end
  local name = playerName()
  local value = name ~= nil and Addon.Comms ~= nil and Addon.Comms:IsAwarder(name) == true
  self.readyAt, self.readyValue = t, value
  return value
end

function Gateway:Data()
  local database = Addon.db
  if not database then return nil end
  local data = database.gateway
  if type(data) ~= "table" then data = {}; database.gateway = data end
  data.members = type(data.members) == "table" and data.members or {}
  data.locations = type(data.locations) == "table" and data.locations or {}
  data.forget = type(data.forget) == "table" and data.forget or {}
  data.ack = type(data.ack) == "table" and data.ack or {}
  data.meta = type(data.meta) == "table" and data.meta or {}
  return data
end

-- ---------------------------------------------------------------- turning it on, beacon and tick
function Gateway:SetEnabled(on)
  local config = settings()
  if type(config) ~= "table" then return false end
  config.gatewayMode = on == true
  self.readyAt = nil
  if on then self:Schedule() end
  return true
end

function Gateway:Initialise()
  if self.initialised then return end
  self.initialised = true
  if self:Enabled() then self:Schedule() end
end

function Gateway:Schedule()
  if self.scheduled or not (C_Timer and C_Timer.After) then return end
  self.scheduled = true
  C_Timer.After(self.TICK, function()
    Gateway.scheduled = false
    Addon:Guard("Gateway", Gateway.Tick, Gateway)
    if Gateway:Enabled() then Gateway:Schedule() end
  end)
end

function Gateway:SendBeacon()
  local name = playerName()
  local comms = Addon.Comms
  if not (comms and comms.queue and validName(name)) then return false end
  if comms:Availability() then return false end
  if #comms.queue >= 6 then return false end
  table.insert(comms.queue, string.format("G1|%d|%s", self.version, name))
  self.lastBeacon = now()
  self.status.beacons = self.status.beacons + 1
  comms:Pump()
  return true
end

function Gateway:Tick()
  if not self:Enabled() then return "off" end
  if Addon.Comms then Addon.Comms:RequestRoster() end
  if not self:IsReady() then return "needs rank" end
  if not self.lastBeacon or now() - self.lastBeacon >= self.BEACON_INTERVAL then self:SendBeacon() end
  self:Snapshot()
  if Addon.Orders then Addon:Guard("Orders", Addon.Orders.ProcessInbox, Addon.Orders) end
  return "ok"
end

-- ---------------------------------------------------------------- storing member data
function Gateway:ParseRoster(text)
  local parts = split(text)
  if #parts ~= 8 or parts[1] ~= "C1" then return nil end
  if tonumber(parts[2]) ~= self.version then return nil end
  local level, classID, raceID = wholeNumber(parts[3], 0, 130), wholeNumber(parts[4], 0, 20), wholeNumber(parts[5], 0, 200)
  local medals, money = wholeNumber(parts[7], 0, 100000), wholeNumber(parts[8], 0, 100000000)
  if not (level and classID and raceID and medals and money) then return nil end
  if #parts[6] > 30 or not parts[6]:match("^[%w '%-]*$") then return nil end
  return { level = level, classID = classID, raceID = raceID, title = parts[6], medals = medals, momMoney = money }
end

local function ensureMember(self, name)
  local data = self:Data()
  local member = data.members[name]
  if member then return member end
  local count, oldestName, oldestAt = 0, nil, nil
  for memberName, row in pairs(data.members) do
    count = count + 1
    local seen = tonumber(row.lastHeard) or 0
    if not oldestAt or seen < oldestAt then oldestName, oldestAt = memberName, seen end
  end
  if count >= self.MAX_MEMBERS and oldestName then data.members[oldestName] = nil; data.locations[oldestName] = nil end
  member = { lastHeard = now(), stats = {} }
  data.members[name] = member
  return member
end

function Gateway:StoreRoster(name, roster)
  if not validName(name) then return false end
  local member = ensureMember(self, name)
  for _, key in ipairs({ "level", "classID", "raceID", "title", "medals", "momMoney" }) do member[key] = roster[key] end
  member.lastHeard = now()
  return true
end

function Gateway:allowedKey(key)
  if not self.allowed then
    self.allowed = {}
    local share = Addon.Share
    if share then
      for _, counter in ipairs(share.counterKeys) do self.allowed[counter] = true end
      for _, stat in ipairs(share.statKeys) do self.allowed[stat.key] = true end
    end
  end
  return self.allowed[key] == true
end

function Gateway:StoreStats(name, seq, partNumber, partCount, text)
  local pairsList, seen = {}, {}
  local count = 0
  if text ~= "" then
    for item in (text .. ","):gmatch("([^,]*),") do
      local key, value = item:match("^(%a+)=(%d+)$")
      if not key or #value > 10 or not self:allowedKey(key) or seen[key] then return false end
      value = tonumber(value)
      if value > 1000000000 then return false end
      count = count + 1
      if count > self.MAX_PAIRS then return false end
      seen[key] = true; pairsList[key] = value
    end
  end
  if not validName(name) then return false end
  local member = ensureMember(self, name)
  member.lastHeard = now()
  local pending = self.pending[name]
  if not pending or pending.seq ~= seq or pending.count ~= partCount or now() - pending.at > self.PENDING_EXPIRE then
    pending = { seq = seq, count = partCount, at = now(), got = {} }
    self.pending[name] = pending
  end
  pending.got[partNumber] = pairsList
  local have = 0
  for _ in pairs(pending.got) do have = have + 1 end
  if have == partCount then
    local merged, total = {}, 0
    for index = 1, partCount do
      for key, value in pairs(pending.got[index] or {}) do
        if total < self.MAX_STATS then merged[key] = value; total = total + 1 end
      end
    end
    member.stats = merged
    member.seq = seq
    member.statsAt = now()
    self.pending[name] = nil
  end
  return true
end

function Gateway:Forget(name)
  local data = self:Data()
  if not data or not validName(name) then return false end
  data.members[name] = nil
  data.locations[name] = nil
  self.pending[name] = nil
  for index = #data.forget, 1, -1 do if data.forget[index].name == name then table.remove(data.forget, index) end end
  table.insert(data.forget, { name = name, at = now() })
  while #data.forget > self.MAX_FORGET do table.remove(data.forget, 1) end
  self.status.forgotten = self.status.forgotten + 1
  return true
end

function Gateway:Flooded(name)
  local current = now()
  local kept = {}
  for _, stamp in ipairs(self.floods[name] or {}) do if current - stamp < self.FLOOD_WINDOW then kept[#kept + 1] = stamp end end
  if #kept >= self.FLOOD_LIMIT then self.floods[name] = kept; return true end
  kept[#kept + 1] = current
  self.floods[name] = kept
  return false
end

-- Called by Comms for C1, S1 and F1 on the guild channel (G1 goes to Share). Anything unknown is dropped.
function Gateway:OnMessage(sender, text)
  if not self:IsReady() then return end
  local name = shortName(sender)
  if not validName(name) then drop(self); return end
  if self:Flooded(name) then drop(self); return end
  local head = text:sub(1, 2)
  local ok = false
  if head == "C1" then
    local roster = self:ParseRoster(text)
    ok = roster ~= nil and self:StoreRoster(name, roster)
  elseif head == "S1" then
    local parts = split(text)
    if #parts == 5 and tonumber(parts[2]) == self.version then
      local seq = wholeNumber(parts[3], 0, 99999)
      local partNumber, partCount = parts[4]:match("^(%d)/(%d)$")
      partNumber, partCount = tonumber(partNumber), tonumber(partCount)
      if seq and partNumber and partCount and partCount >= 1 and partCount <= 3 and partNumber >= 1 and partNumber <= partCount then
        ok = self:StoreStats(name, seq, partNumber, partCount, parts[5])
      end
    end
  elseif head == "F1" then
    local parts = split(text)
    ok = #parts == 2 and tonumber(parts[2]) == self.version and self:Forget(name)
  end
  if ok then self.status.received = self.status.received + 1 else drop(self) end
end

-- ---------------------------------------------------------------- snapshot for the companion
function Gateway:Snapshot()
  local data = self:Data()
  if not data then return false end
  local t = now()
  -- Own character (only when this player has consented to share stats like everyone else).
  local share = Addon.Share
  local name = playerName()
  if share and settings().shareStats == true and validName(name) then
    local roster = self:ParseRoster(share:BuildRoster())
    if roster then
      self:StoreRoster(name, roster)
      local stats = {}
      for _, item in ipairs(share:CollectStats()) do
        local key, value = item:match("^(%a+)=(%d+)$")
        if key then stats[key] = tonumber(value) end
      end
      data.members[name].stats, data.members[name].statsAt = stats, t
    end
  end
  local locations, count = {}, 0
  local map = Addon.Map
  if map and type(map.members) == "table" then
    local expire = tonumber(map.EXPIRE) or 300
    for memberName, member in pairs(map.members) do
      if not member.fake and validName(memberName) and t - (tonumber(member.at) or 0) <= expire and count < self.MAX_MEMBERS then
        count = count + 1
        local zone = map.ZoneName and safe(map.ZoneName, map, member.mapID)
        locations[memberName] = { mapID = member.mapID, x = member.x, y = member.y, level = member.level, classID = member.classID, at = member.at, zone = type(zone) == "string" and zone:sub(1, 40) or nil }
      end
    end
  end
  -- The gateway's own character is never in Map.members (a client ignores its own messages), so add it here under the same rules
  -- as sending: location sharing on, open world only.
  if map and validName(name) and settings().shareLocation == true and not (IsInInstance and safe(IsInInstance)) and map.GetPosition then
    local mapID, x, y = map:GetPosition()
    if mapID and x and y then
      local _, _, classID = safe(UnitClass, "player")
      local zone = map.ZoneName and safe(map.ZoneName, map, mapID)
      locations[name] = { mapID = mapID, x = x, y = y, level = tonumber(safe(UnitLevel, "player")) or 0, classID = tonumber(classID) or 0, at = t, zone = type(zone) == "string" and zone:sub(1, 40) or nil }
    end
  end
  data.locations = locations
  -- Names for the dashboard's command composer: guild-verified medals and this week's quest templates.
  local catalog = { verified = {}, templates = {} }
  local medals = Addon.Medals
  if medals then
    for _, entry in ipairs(medals.verifiedMedals or {}) do
      if #catalog.verified < 80 and type(entry.id) == "string" then catalog.verified[#catalog.verified + 1] = { id = entry.id, name = tostring(entry.name or entry.id):sub(1, 60) } end
    end
    for _, template in ipairs(medals:GetQuestTemplates() or {}) do
      if #catalog.templates < 80 then catalog.templates[#catalog.templates + 1] = { id = template.id, slot = template.slot, text = tostring(template.text or template.id):sub(1, 80) } end
    end
  end
  data.catalog = catalog
  data.enabled = true
  data.client = Addon.Medals and Addon.Medals:Client() or "retail"
  data.meta = { writtenAt = t, version = self.version }
  return true
end

-- Writes the snapshot, then reloads the interface so the game saves it to disk. Needs a click or key press.
function Gateway:SyncNow()
  self:Snapshot()
  local reload = (C_UI and C_UI.Reload) or ReloadUI
  if type(reload) ~= "function" then return false end
  return pcall(reload) == true
end

function Gateway:Describe()
  if not self:Enabled() then return "Gateway: off" end
  if not self:IsReady() then return "Gateway: on but this character needs guild rank 0 or 1 (roster may still be loading)" end
  local count = 0
  local data = Addon.db and Addon.db.gateway
  if data and data.members then for _ in pairs(data.members) do count = count + 1 end end
  return "Gateway: on, " .. tostring(count) .. " members, beacons " .. tostring(self.status.beacons) .. ", received " .. tostring(self.status.received) .. ", dropped " .. tostring(self.status.dropped)
end
