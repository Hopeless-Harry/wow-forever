local Addon = MAMChronicles
local Orders = {}
Addon.Orders = Orders

-- Guild orders: announcements, weekly quest overrides and a guild message, sent by the guild's gateway as hidden
-- GUILD addon messages and accepted only from rank 0 or 1 (the same roster check as awards). On the gateway they come
-- from the command inbox the companion app writes (MAMChroniclesInbox.commands). Nothing is whispered or posted in chat.
-- N1|<ver>|<id>|<part>/<parts>|<text>      announcement, up to three parts
-- Q1|<ver>|<id>|<week>|<t1>,<t2>,<t3>      quest template ids per slot, "-" keeps the default
-- K1|<ver>|<id>|motd|<text>                guild message
Orders.version = 1
Orders.TEXT_PART = 190
Orders.MAX_ANNOUNCE = 570
Orders.MAX_MOTD = 100
Orders.MAX_KEEP = 20
Orders.MAX_PER_PASS = 20
Orders.MAX_ACKS = 50
Orders.FLOOD_LIMIT, Orders.FLOOD_WINDOW = 6, 60
Orders.status = { applied = 0, dropped = 0, unverified = 0 }
Orders.floods = {}
Orders.pending = {}

local function now() return Addon:Now() end
local function drop(self) self.status.dropped = self.status.dropped + 1 end
local function shortName(sender) return (tostring(sender):match("^[^-]+")) or tostring(sender) end

local function split(text)
  local parts = {}
  for piece in (text .. "|"):gmatch("([^|]*)|") do parts[#parts + 1] = piece end
  return parts
end

-- Printable ASCII without the pipe character, which is the message separator.
local function cleanText(text, limit)
  if type(text) ~= "string" then return nil end
  if #text > limit or text:find("[^\32-\126]") or text:find("|", 1, true) then return nil end
  return text
end

-- ---------------------------------------------------------------- receiving (every client)
function Orders:Flooded(name)
  local current = now()
  local kept = {}
  for _, stamp in ipairs(self.floods[name] or {}) do if current - stamp < self.FLOOD_WINDOW then kept[#kept + 1] = stamp end end
  if #kept >= self.FLOOD_LIMIT then self.floods[name] = kept; return true end
  kept[#kept + 1] = current
  self.floods[name] = kept
  return false
end

local function remember(list, entry, limit)
  table.insert(list, 1, entry)
  while #list > limit do table.remove(list) end
end

function Orders:ApplyAnnouncement(id, text)
  local database = Addon.db
  if not database then return false end
  database.announcements = type(database.announcements) == "table" and database.announcements or {}
  for _, entry in ipairs(database.announcements) do if entry.id == id then return false end end
  remember(database.announcements, { id = id, text = text, at = now() }, self.MAX_KEEP)
  if Addon.Toast then Addon.Toast:Show({ kind = "guild", title = "Guild announcement", text = text, action = "Home" }) end
  self.status.applied = self.status.applied + 1
  return true
end

function Orders:ApplyQuests(id, week, slots)
  local database = Addon.db
  if not database then return false end
  local medals = Addon.Medals
  if not medals then return false end
  local forever = medals:Client() == "forever"
  local chosen = {}
  for slot = 1, 3 do
    local wanted = slots[slot]
    if wanted ~= "-" then
      local found
      for _, template in ipairs(medals:GetQuestTemplates()) do
        if template.id == wanted and template.slot == slot and (not template.forever or forever) then found = template.id end
      end
      if not found then return false end
      chosen[slot] = found
    else chosen[slot] = "-" end
  end
  database.questOverride = { id = id, week = week, slots = chosen, at = now() }
  self.status.applied = self.status.applied + 1
  return true
end

function Orders:ApplyMotd(id, text)
  local database = Addon.db
  if not database then return false end
  database.guildConfig = type(database.guildConfig) == "table" and database.guildConfig or {}
  database.guildConfig.motd = text
  database.guildConfig.motdId = id
  self.status.applied = self.status.applied + 1
  return true
end

local function wholeNumber(text, low, high)
  if type(text) ~= "string" or not text:match("^%d+$") or #text > 10 then return nil end
  local value = tonumber(text)
  if value < low or value > high then return nil end
  return value
end

-- Called by Comms for N1, Q1 and K1 on the guild channel.
function Orders:OnMessage(sender, text)
  local comms = Addon.Comms
  if not (comms and comms:IsAwarder(sender)) then
    self.status.unverified = self.status.unverified + 1
    if comms then comms:RequestRoster() end
    return
  end
  local name = shortName(sender)
  if self:Flooded(name) then drop(self); return end
  local parts = split(text)
  local head = parts[1]
  local ok = false
  if tonumber(parts[2]) ~= self.version then drop(self); return end
  local id = wholeNumber(parts[3], 0, 2147483647)
  if not id then drop(self); return end
  if head == "N1" and #parts == 5 then
    local partNumber, partCount = parts[4]:match("^(%d)/(%d)$")
    partNumber, partCount = tonumber(partNumber), tonumber(partCount)
    local piece = cleanText(parts[5], self.TEXT_PART)
    if piece and partNumber and partCount and partCount >= 1 and partCount <= 3 and partNumber >= 1 and partNumber <= partCount then
      local pending = self.pending[name]
      if not pending or pending.id ~= id or pending.count ~= partCount or now() - pending.at > 60 then
        pending = { id = id, count = partCount, at = now(), got = {} }
        self.pending[name] = pending
      end
      pending.got[partNumber] = piece
      local complete = true
      for index = 1, partCount do if pending.got[index] == nil then complete = false end end
      if complete then
        self.pending[name] = nil
        ok = true
        self:ApplyAnnouncement(id, table.concat(pending.got))
      else ok = true end
    end
  elseif head == "Q1" and #parts == 5 then
    local week = wholeNumber(parts[4], 1, 100000)
    local slots = {}
    for item in (parts[5] .. ","):gmatch("([^,]*),") do slots[#slots + 1] = item end
    local valid = week ~= nil and #slots == 3
    if valid then for _, item in ipairs(slots) do if item ~= "-" and not (item:match("^[%a_]+$") and #item <= 20) then valid = false end end end
    ok = valid and self:ApplyQuests(id, week, slots)
  elseif head == "K1" and #parts == 5 and parts[4] == "motd" then
    local motd = cleanText(parts[5], self.MAX_MOTD)
    ok = motd ~= nil and motd ~= "" and self:ApplyMotd(id, motd)
  end
  if not ok then drop(self) end
end

-- ---------------------------------------------------------------- relaying from the inbox (gateway only)
local function queueRoom()
  local comms = Addon.Comms
  return comms and comms.queue and #comms.queue <= 4
end

function Orders:Validate(command)
  if type(command) ~= "table" then return nil, "not a command" end
  local id = command.id
  if type(id) ~= "number" or id ~= math.floor(id) or id < 1 or id > 2147483647 then return nil, "bad id" end
  local kind = command.kind
  if kind == "announce" then
    local text = type(command.text) == "string" and command.text:gsub("|", "/") or nil
    if not text or #text < 1 or #text > self.MAX_ANNOUNCE or text:find("[^\32-\126]") then return nil, "bad text" end
    return { id = id, kind = kind, text = text }
  elseif kind == "award" or kind == "revoke" then
    local target, medal = command.target, command.medal
    if not (type(target) == "string" and #target <= 24 and target:match("^[^%s%c|]+$")) then return nil, "bad target" end
    if not (type(medal) == "string" and #medal <= 40 and medal:match("^[%w_]+$")) then return nil, "bad medal" end
    return { id = id, kind = kind, target = target, medal = medal }
  elseif kind == "quests" then
    local week, slots = command.week, command.slots
    if not (type(week) == "number" and week == math.floor(week) and week >= 1 and week <= 100000 and type(slots) == "table") then return nil, "bad quests" end
    local list = {}
    for slot = 1, 3 do
      local item = slots[slot]
      if not (type(item) == "string" and (item == "-" or (item:match("^[%a_]+$") and #item <= 20))) then return nil, "bad quests" end
      list[slot] = item
    end
    return { id = id, kind = kind, week = week, slots = list }
  elseif kind == "config" then
    local text = command.key == "motd" and type(command.text) == "string" and command.text:gsub("|", "/") or nil
    if not text or #text < 1 or #text > self.MAX_MOTD or text:find("[^\32-\126]") then return nil, "bad config" end
    return { id = id, kind = kind, key = "motd", text = text }
  end
  return nil, "unknown kind"
end

-- Returns the messages to queue (already length checked) or nil, reason.
function Orders:BuildMessages(command)
  local v = self.version
  if command.kind == "announce" then
    local messages, chunks = {}, {}
    for index = 1, #command.text, self.TEXT_PART do chunks[#chunks + 1] = command.text:sub(index, index + self.TEXT_PART - 1) end
    for index, chunk in ipairs(chunks) do messages[#messages + 1] = string.format("N1|%d|%d|%d/%d|%s", v, command.id, index, #chunks, chunk) end
    return messages
  elseif command.kind == "quests" then
    return { string.format("Q1|%d|%d|%d|%s", v, command.id, command.week, table.concat(command.slots, ",")) }
  elseif command.kind == "config" then
    return { string.format("K1|%d|%d|motd|%s", v, command.id, command.text) }
  end
  return nil, "no messages"
end

local function ack(command, state, reason)
  local data = Addon.Gateway and Addon.Gateway:Data()
  if not data then return end
  data.ack.results = type(data.ack.results) == "table" and data.ack.results or {}
  table.insert(data.ack.results, { id = command.id or 0, state = state, reason = reason, at = now() })
  while #data.ack.results > Orders.MAX_ACKS do table.remove(data.ack.results, 1) end
  if type(command.id) == "number" and command.id > (tonumber(data.ack.lastCommandId) or 0) then data.ack.lastCommandId = command.id end
end

-- Handles new inbox commands in id order. Returns the number handled.
function Orders:ProcessInbox()
  local gateway = Addon.Gateway
  if not (gateway and gateway:IsReady()) then return 0 end
  local box = _G and _G.MAMChroniclesInbox
  if type(box) ~= "table" or type(box.commands) ~= "table" then return 0 end
  local data = gateway:Data()
  if not data then return 0 end
  local last = tonumber(data.ack.lastCommandId) or 0
  local fresh = {}
  for _, command in ipairs(box.commands) do
    if type(command) == "table" and type(command.id) == "number" and command.id > last then fresh[#fresh + 1] = command end
  end
  table.sort(fresh, function(a, b) return a.id < b.id end)
  local handled = 0
  local comms = Addon.Comms
  for _, raw in ipairs(fresh) do
    if handled >= self.MAX_PER_PASS then break end
    local command, reason = self:Validate(raw)
    if not command then
      ack(raw, "rejected", reason)
    elseif command.kind == "award" or command.kind == "revoke" then
      local ok, why = comms:SendAward(command.kind == "award" and "A1" or "R1", command.target, command.medal)
      if ok then ack(command, "relayed")
      elseif why == "throttled" or why == "locked" then break
      else ack(command, "rejected", tostring(why)) end
    else
      if not queueRoom() or comms:Availability() then break end
      local messages = self:BuildMessages(command)
      for _, text in ipairs(messages or {}) do table.insert(comms.queue, text) end
      comms:Pump()
      -- The gateway does not hear its own messages, so apply the order here too.
      if command.kind == "announce" then self:ApplyAnnouncement(command.id, command.text)
      elseif command.kind == "quests" then self:ApplyQuests(command.id, command.week, command.slots)
      elseif command.kind == "config" then self:ApplyMotd(command.id, command.text) end
      ack(command, "relayed")
    end
    handled = handled + 1
  end
  return handled
end
