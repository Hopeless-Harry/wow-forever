local Addon = MAMChronicles
local Medals = {}
Addon.Medals = Medals

-- Mom Medals: the guild's own achievements. Each medal is worth Mom Money by tier.
-- Definitions are data and versioned so guildmates running the same version agree on names and points.
Medals.version = 1
Medals.tierPoints = { bronze = 10, silver = 25, gold = 50, platinum = 100 }
Medals.tierColours = { bronze = { 0.80, 0.52, 0.30, 1 }, silver = { 0.75, 0.78, 0.85, 1 }, gold = { 0.95, 0.76, 0.25, 1 }, platinum = { 0.55, 0.85, 0.95, 1 } }

local listeners = {}
local roman = { "I", "II", "III", "IV", "V" }
local definitions = {}
local definitionsById = {}

local dateFn = date or (os and os.date)
local function tableOr(value) return type(value) == "table" and value or {} end
local function safe(fn, ...) return Addon:SafeCall(fn, ...) end

local function register(def)
  def.points = Medals.tierPoints[def.tier]
  table.insert(definitions, def)
  definitionsById[def.id] = def
end

-- A series is one medal family with rising targets (I, II, III ...).
local function series(id, name, description, targets, tiers, value)
  for index, target in ipairs(targets) do
    register({
      id = id .. "_" .. index, name = name .. " " .. roman[index], tier = tiers[index], target = target,
      description = description:gsub("{n}", tostring(target)), value = value,
    })
  end
end

local function stat(ctx, patterns) return ctx.stat(patterns) end
local bts = { "bronze", "silver", "gold" }
local btsp = { "bronze", "silver", "gold", "platinum" }

register({ id = "fresh_start", name = "Fresh Start", tier = "bronze", target = 1, description = "Record your first Chronicle entry.", value = function(ctx) return ctx.event("total") end })
series("memory_keeper", "Memory Keeper", "Pin {n} manual memories.", { 1, 10, 50 }, bts, function(ctx) return ctx.event("memory.manual") end)
series("explorer", "Explorer", "Discover {n} new zones or areas.", { 10, 50, 200 }, bts, function(ctx) return ctx.event("world.zone_discovered") end)
series("quest_machine", "Quest Machine", "Complete {n} quests.", { 100, 500, 1500, 3000 }, btsp, function(ctx) return math.max(stat(ctx, { "quests completed" }), ctx.event("quest.completed")) end)
series("delver", "Delver", "Complete {n} delves.", { 10, 50, 100 }, bts, function(ctx) return stat(ctx, { "delves completed" }) end)
series("dungeon_regular", "Dungeon Regular", "Enter {n} five-player dungeons.", { 25, 100, 250 }, bts, function(ctx) return math.max(stat(ctx, { "dungeons entered" }), ctx.event("instance.entered")) end)
series("slayer", "Slayer", "Kill {n} creatures.", { 1000, 10000, 50000 }, bts, function(ctx) return stat(ctx, { "creatures killed" }) end)
series("frequent_flyer", "Frequent Flyer", "Take {n} flight paths.", { 50, 200, 500 }, bts, function(ctx) return stat(ctx, { "flight paths" }) end)
series("comeback_kid", "Comeback Kid", "Return from the dead {n} times.", { 1, 10, 50 }, bts, function(ctx) return ctx.event("character.resurrected") end)
series("adventurer", "Adventurer", "Reach level {n}.", { 20, 40, 60, 80 }, btsp, function(ctx) return ctx.level() end)
series("shiny_collector", "Shiny Collector", "Loot {n} notable items.", { 1, 25, 100 }, bts, function(ctx) return ctx.event("loot.notable") end)
series("achiever", "Achiever", "Earn {n} achievements.", { 10, 50, 200 }, bts, function(ctx) return ctx.event("achievement.earned") end)
-- Mom-themed and silly medals. Counters come from Counters.lua (consumables, jumps, mounting, AFK, resting,
-- screenshots); the rest use the game's own statistics or Chronicle events. Absent statistics simply never trigger.
local function counter(name) return function(ctx) return ctx.counter(name) end end
local function statistic(...) local patterns = { ... }; return function(ctx) return stat(ctx, patterns) end end
series("wine", "Wine O'Clock", "Drink {n} bottles of wine.", { 1, 10, 50, 200 }, btsp, counter("wine"))
series("ale", "Pint of Courage", "Drink {n} ales, beers or other spirits.", { 1, 10, 50 }, bts, counter("ale"))
series("coffee", "Second Coffee", "Drink {n} coffees, teas or hot drinks.", { 10, 50, 250 }, bts, counter("coffee"))
series("food", "Clean Plate Club", "Eat {n} meals and snacks.", { 25, 100, 500 }, bts, counter("food"))
series("bandage", "Boo-Boo Fixer", "Apply {n} bandages.", { 5, 25, 100 }, bts, counter("bandage"))
series("potion", "Medicine Cabinet", "Use {n} potions, elixirs or flasks.", { 10, 50, 250 }, bts, counter("potion"))
series("jumps", "Trampoline Mom", "Jump {n} times.", { 100, 1000, 10000 }, bts, counter("jumps"))
series("mounts", "School Run", "Mount up {n} times.", { 100, 500, 2000 }, bts, counter("mounts"))
series("afk", "Mom Needs Five Minutes", "Go AFK {n} times.", { 1, 10, 50 }, bts, counter("afk"))
series("rest", "Weekend Getaway", "Check into an inn or city {n} times.", { 10, 50, 200 }, bts, counter("rest"))
series("shots", "Say Cheese", "Take {n} screenshots.", { 1, 10, 50 }, bts, counter("shots"))
series("late", "Up Past Bedtime", "Log in between midnight and 5am {n} times.", { 3, 15, 50 }, bts, function(ctx) return ctx.event("lateLogin") end)
series("early", "Early Bird Special", "Log in between 5am and 8am {n} times.", { 3, 15, 50 }, bts, function(ctx) return ctx.event("earlyLogin") end)
series("hugs", "Hugs and Kisses", "Give {n} hugs.", { 10, 50, 250 }, bts, statistic("total hugs", "hugs"))
series("waves", "Friendly Neighbourhood Mom", "Wave hello {n} times.", { 25, 100, 500 }, bts, statistic("total waves", "waves"))
series("cheers", "Cheerleader Mom", "Cheer {n} times.", { 10, 50, 250 }, bts, statistic("total cheers", "cheers"))
series("dances", "Kitchen Dance Party", "Dance {n} times.", { 10, 50, 250 }, bts, statistic("total dances", "dances"))
series("kisses", "Smooches", "Blow {n} kisses.", { 5, 25, 100 }, bts, statistic("total kisses", "kisses"))
series("hearth", "Home Is Where the Heart Is", "Use your hearthstone {n} times.", { 25, 100, 500 }, bts, statistic("times hearthed"))
series("summons", "Carpool Lane", "Accept {n} summons.", { 10, 50, 200 }, bts, statistic("summons accepted"))
series("abandon", "Commitment Issues", "Abandon {n} quests.", { 25, 100, 300 }, bts, statistic("quests abandoned"))
series("daily", "The Daily Grind", "Complete {n} daily quests.", { 50, 250, 1000 }, bts, statistic("daily quests completed"))
series("buyer", "Impulse Buyer", "Make {n} auction house purchases.", { 100, 500, 1000 }, bts, statistic("auction purchases"))
series("healthstone", "Healthy Snack", "Use {n} healthstones.", { 10, 50, 200 }, bts, statistic("healthstones used"))
series("catmom", "Crazy Cat Mom", "Own {n} vanity pets.", { 10, 50, 100 }, bts, statistic("vanity pets owned"))
series("playdate", "Pet Playdate", "Win {n} pet battles.", { 10, 50, 200 }, bts, statistic("pet battles won"))
series("treasure", "Treasure Hunter Mom", "Loot {n} mislaid curiosities.", { 25, 100, 250 }, bts, statistic("curiosities looted"))
series("oops", "Oops-a-Daisy", "Be defeated {n} times.", { 1, 10, 50 }, bts, function(ctx) return ctx.event("character.death") end)
series("cooking", "Kitchen Witch", "Reach {n} skill in Cooking.", { 25, 75, 150 }, bts, function(ctx) return ctx.signal("skill_cooking") end)
series("fishing", "Patient Angler", "Reach {n} skill in Fishing.", { 25, 75, 150 }, bts, function(ctx) return ctx.signal("skill_fishing") end)

register({ id = "gravity", name = "Gravity's Favourite", tier = "bronze", target = 1, description = "Die from a fall.", value = function(ctx) return ctx.signal("falling") end })
register({ id = "murloc_magnet", name = "Murloc Magnet", tier = "bronze", target = 1, description = "Be defeated by a murloc.", value = function(ctx) return ctx.signal("murloc") end })
register({ id = "auction_goblin", name = "Auction House Goblin", tier = "silver", target = 1000, description = "Post 1,000 auctions.", value = function(ctx) return stat(ctx, { "auctions posted" }) end })
register({ id = "battlemaster", name = "Battlemaster", tier = "bronze", target = 10, description = "Play 10 battlegrounds.", value = function(ctx) return stat(ctx, { "battlegrounds played" }) end })

function Medals:GetDefinitions() return definitions end
function Medals:GetDefinition(id) return definitionsById[id] end
function Medals:AddListener(fn) if type(fn) == "function" then table.insert(listeners, fn) end end

local function notify(def, info)
  for _, listener in ipairs(listeners) do pcall(listener, def, info) end
end

-- Cheap incremental counters so evaluating after every event does not rescan the whole history.
function Medals:Reset() self.counts = nil end

function Medals:EnsureCounts()
  if self.counts and self.countsFor == Addon.characterKey then return self.counts end
  local counts = { total = 0, signals = {}, maxLevel = 0 }
  self.counts, self.countsFor = counts, Addon.characterKey
  for _, event in ipairs(Addon.db and Addon.db.events or {}) do
    if event.characterKey == Addon.characterKey and event.type ~= "medal.earned" then self:Count(event) end
  end
  return counts
end

function Medals:Count(event)
  local counts = self.counts
  counts.total = counts.total + 1
  counts[event.type] = (counts[event.type] or 0) + 1
  local payload = event.payload or {}
  if event.type == "character.death" then
    local kind = string.lower(tostring(payload.deathKind or ""))
    if kind:find("fall", 1, true) then counts.signals.falling = (counts.signals.falling or 0) + 1 end
    local context = string.lower(tostring(payload.lastHostileTarget or "") .. " " .. tostring(payload.zone or ""))
    if context:find("murloc", 1, true) then counts.signals.murloc = (counts.signals.murloc or 0) + 1 end
  elseif event.type == "character.level_up" and type(payload.level) == "number" then
    counts.maxLevel = math.max(counts.maxLevel, payload.level)
  elseif event.type == "session.login" and dateFn then
    local hour = tonumber(dateFn("%H", event.occurredAt))
    if hour and hour < 5 then counts.lateLogin = (counts.lateLogin or 0) + 1
    elseif hour and hour >= 5 and hour < 8 then counts.earlyLogin = (counts.earlyLogin or 0) + 1 end
  elseif event.type == "profession.changed" and type(payload.skillLevel) == "number" then
    local name = string.lower(tostring(payload.professionName or ""))
    for _, skill in ipairs({ "cooking", "fishing" }) do
      if name:find(skill, 1, true) then
        local key = "skill_" .. skill
        counts.signals[key] = math.max(counts.signals[key] or 0, payload.skillLevel)
      end
    end
  end
end

function Medals:BuildContext()
  local counts = self:EnsureCounts()
  local AS = Addon.AchievementStats
  return {
    stat = function(patterns)
      if not AS then return 0 end
      local _, value = AS:FindValue(patterns, Addon.characterKey)
      return value or 0
    end,
    event = function(name) return counts[name] or 0 end,
    signal = function(name) return counts.signals[name] or 0 end,
    counter = function(name)
      local row = Addon.db and Addon.db.counters and Addon.db.counters[Addon.characterKey]
      return row and row[name] or 0
    end,
    level = function() return math.max(tonumber(safe(UnitLevel, "player")) or 0, counts.maxLevel) end,
  }
end

-- Awards wait until statistics have been read (or ruled out) so existing history is a silent baseline.
function Medals:StatisticsSettled()
  local AS = Addon.AchievementStats
  if not AS then return true end
  local status = AS.status
  return status ~= nil and status.state ~= "pending"
end

function Medals:Evaluate(reason)
  local database, key = Addon.db, Addon.characterKey
  if not (database and key) or self.evaluating then return {} end
  database.medals = tableOr(database.medals)
  local row = database.medals[key]
  if not row and not self:StatisticsSettled() then return {} end
  local baseline = row == nil
  if baseline then row = { earned = {}, total = 0, version = Medals.version }; database.medals[key] = row end
  self.evaluating = true
  local ctx = self:BuildContext()
  local awarded, points = {}, 0
  for _, def in ipairs(definitions) do
    if not row.earned[def.id] and def.value(ctx) >= def.target then
      row.earned[def.id] = { at = Addon:Now(), points = def.points, retro = baseline or nil }
      row.total = row.total + def.points; points = points + def.points
      table.insert(awarded, def)
    end
  end
  row.evaluatedAt = Addon:Now()
  self.evaluating = false
  if baseline then
    if #awarded > 0 then notify(nil, { summary = true, retro = true, count = #awarded, points = points, reason = reason }) end
  else
    for _, def in ipairs(awarded) do
      Addon.EventStore:Append("medal.earned", { medalId = def.id, medalName = def.name, points = def.points })
      notify(def, { retro = false, reason = reason })
    end
  end
  return awarded
end

function Medals:OnEvent(event)
  if not event or event.type == "medal.earned" or event.characterKey ~= Addon.characterKey then return end
  self:EnsureCounts()
  self:Count(event)
  self:Evaluate("event")
end

function Medals:GetSummary(key)
  local row = Addon.db and Addon.db.medals and Addon.db.medals[key or Addon.characterKey]
  local count = 0
  if row then for _ in pairs(row.earned) do count = count + 1 end end
  return { total = row and row.total or 0, count = count, possible = #definitions }
end

function Medals:GetProgress(key)
  local row = Addon.db and Addon.db.medals and Addon.db.medals[key or Addon.characterKey]
  local ctx = self:BuildContext()
  local list = {}
  for _, def in ipairs(definitions) do
    local current = math.min(def.value(ctx), math.huge)
    table.insert(list, { def = def, current = current, target = def.target, earned = row and row.earned[def.id] or nil, fraction = math.min(1, current / def.target) })
  end
  return list
end
