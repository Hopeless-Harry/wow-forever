local Addon = MAMChronicles
local Medals = {}
Addon.Medals = Medals

-- Mom Medals: the guild's own achievements. Each medal is worth Mom Money by tier.
-- Definitions are data and versioned so guildmates running the same version agree on names and points.
Medals.version = 1
Medals.tierPoints = { bronze = 10, silver = 25, gold = 50, platinum = 100 }
Medals.tierColours = { bronze = { 0.80, 0.52, 0.30, 1 }, silver = { 0.75, 0.78, 0.85, 1 }, gold = { 0.95, 0.76, 0.25, 1 }, platinum = { 0.55, 0.85, 0.95, 1 } }
Medals.foreverLaunch = { year = 2026, month = 11, day = 4 }

local listeners = {}
local roman = { "I", "II", "III", "IV", "V", "VI" }
local definitions = {}
local definitionsById = {}

local dateFn = date or (os and os.date)
local timeFn = time or (os and os.time)
local function tableOr(value) return type(value) == "table" and value or {} end
local function safe(fn, ...) return Addon:SafeCall(fn, ...) end

Medals.newIds = {}

-- How each value function is tracked, for the medal tooltip. Factories below tag the functions they return.
local sources = setmetatable({}, { __mode = "k" })
local trackingText = {
  counter = "Counted by the addon as you play. Only a number is kept, never item names.",
  statistic = "Read from the game's own Statistics.",
  tally = "Tracked from your Chronicle and kept even after old entries are compacted.",
  default = "Worked out from your Chronicle entries and your character.",
}
local function tagged(kind, fn) sources[fn] = kind; return fn end

local function describeTracking(def)
  local text = trackingText[sources[def.value] or "default"]
  if def.needsStat then text = text .. " Only offered when this client reports that statistic." end
  if def.client == "forever" then text = text .. " WoW Forever only." elseif def.client == "retail" then text = text .. " Retail only." end
  return text
end

local function register(def)
  def.points = Medals.tierPoints[def.tier]
  def.tracking = describeTracking(def)
  table.insert(definitions, def)
  definitionsById[def.id] = def
end

-- A series is one medal family with rising targets (I, II, III ...).
-- options: client ("retail" or "forever" only), capFromTarget (needs a level cap of at least the target), format (target -> shown number).
local function series(id, name, description, targets, tiers, value, options)
  options = options or {}
  for index, target in ipairs(targets) do
    local shown = options.format and options.format(target) or target
    register({
      id = id .. "_" .. index, name = name .. " " .. roman[index], tier = tiers[index], target = target,
      description = (description:gsub("{n}", tostring(shown))), value = value,
      client = options.client, minCap = options.capFromTarget and target or nil, needsStat = options.needsStat,
    })
  end
end

local function single(id, name, tier, target, description, value, options)
  options = options or {}
  register({ id = id, name = name, tier = tier, target = target, description = description, value = value, client = options.client, needsStat = options.needsStat })
end

local function stat(ctx, patterns) return ctx.stat(patterns) end
local function counter(name) return tagged("counter", function(ctx) return ctx.counter(name) end) end
local function tally(name) return tagged("tally", function(ctx) return ctx.tally(name) end) end
local function statistic(...) local patterns = { ... }; return tagged("statistic", function(ctx) return stat(ctx, patterns) end) end
local function hours(seconds) return math.floor(seconds / 3600) end
local bts = { "bronze", "silver", "gold" }
local btsp = { "bronze", "silver", "gold", "platinum" }

-- ---------------------------------------------------------------- core progress
single("fresh_start", "Fresh Start", "bronze", 1, "Record your first Chronicle entry.", function(ctx) return ctx.event("total") end)
series("memory_keeper", "Memory Keeper", "Pin {n} manual memories.", { 1, 10, 50 }, bts, function(ctx) return ctx.event("memory.manual") end)
series("explorer", "Explorer", "Discover {n} new zones or areas.", { 10, 50, 200 }, bts, function(ctx) return ctx.event("world.zone_discovered") end)
series("quest_machine", "Quest Machine", "Complete {n} quests.", { 100, 500, 1500, 3000 }, btsp, function(ctx) return math.max(stat(ctx, { "quests completed" }), ctx.event("quest.completed")) end)
series("delver", "Delver", "Complete {n} delves.", { 10, 50, 100 }, bts, statistic("delves completed"), { client = "retail" })
series("dungeon_regular", "Dungeon Regular", "Enter {n} five-player dungeons.", { 25, 100, 250 }, bts, function(ctx) return math.max(stat(ctx, { "dungeons entered" }), ctx.event("instance.entered")) end)
series("slayer", "Slayer", "Kill {n} creatures.", { 1000, 10000, 50000 }, bts, statistic("creatures killed"), { needsStat = { "creatures killed" } })
series("frequent_flyer", "Frequent Flyer", "Take {n} flight paths.", { 50, 200, 500 }, bts, statistic("flight paths"), { needsStat = { "flight paths" } })
series("comeback_kid", "Comeback Kid", "Return from the dead {n} times.", { 1, 10, 50 }, bts, function(ctx) return ctx.event("character.resurrected") end)
series("adventurer", "Adventurer", "Reach level {n}.", { 20, 40, 60, 80, 90 }, { "bronze", "silver", "gold", "platinum", "platinum" }, function(ctx) return ctx.level() end, { capFromTarget = true })
series("shiny_collector", "Shiny Collector", "Loot {n} notable items.", { 1, 25, 100 }, bts, function(ctx) return ctx.event("loot.notable") end)
series("achiever", "Achiever", "Earn {n} achievements.", { 10, 50, 200 }, bts, function(ctx) return ctx.event("achievement.earned") end, { client = "retail" })

-- ---------------------------------------------------------------- Mom-themed: consumables (Counters.lua)
series("wine", "Wine O'Clock", "Drink {n} bottles of wine.", { 1, 10, 50, 200 }, btsp, counter("wine"))
series("ale", "Pint of Courage", "Drink {n} ales, beers or other spirits.", { 1, 10, 50 }, bts, counter("ale"))
series("coffee", "Second Coffee", "Drink {n} coffees, teas or hot drinks.", { 10, 50, 250 }, bts, counter("coffee"))
series("food", "Clean Plate Club", "Eat {n} meals and snacks.", { 25, 100, 500 }, bts, counter("food"))
series("cheese", "Cheese Please", "Eat {n} cheeses.", { 5, 25, 100 }, bts, counter("cheese"))
series("cookie", "Cookie Monster", "Eat {n} cookies and biscuits.", { 5, 25, 100 }, bts, counter("cookie"))
series("pie", "Pie in the Sky", "Eat {n} pies, tarts and pastries.", { 5, 25, 100 }, bts, counter("pie"))
series("soup", "Soup of the Day", "Eat {n} bowls of soup or stew.", { 5, 25, 100 }, bts, counter("soup"))
series("fish", "Fishy Business", "Eat {n} fish dishes.", { 5, 25, 100 }, bts, counter("fish"))
series("juice", "Juice Box", "Drink {n} juices, lemonades or milks.", { 5, 25, 100 }, bts, counter("juice"))
series("water", "Stay Hydrated", "Drink {n} waters.", { 10, 50, 250 }, bts, counter("water"))
series("bandage", "Boo-Boo Fixer", "Apply {n} bandages.", { 5, 25, 100 }, bts, counter("bandage"))
series("potion", "Medicine Cabinet", "Use {n} potions, elixirs or flasks.", { 10, 50, 250 }, bts, counter("potion"))

-- ---------------------------------------------------------------- Mom-themed: habits (Counters.lua)
series("jumps", "Trampoline Mom", "Jump {n} times.", { 100, 1000, 10000 }, bts, counter("jumps"))
series("mounts", "School Run", "Mount up {n} times.", { 100, 500, 2000 }, bts, counter("mounts"))
series("afk", "Mom Needs Five Minutes", "Go AFK {n} times.", { 1, 10, 50 }, bts, counter("afk"))
series("rest", "Weekend Getaway", "Check into an inn or city {n} times.", { 10, 50, 200 }, bts, counter("rest"))
series("shots", "Say Cheese", "Take {n} screenshots.", { 1, 10, 50 }, bts, counter("shots"))
series("outfits", "Outfit Change Number Nine", "Change your equipment {n} times.", { 25, 100, 500 }, bts, counter("outfits"))
series("repairs", "Sewing Circle", "Repair your gear {n} times.", { 5, 25, 100 }, bts, counter("repairs"))
series("sales", "Decluttered", "Make {n} vendor sales.", { 10, 50, 250 }, bts, counter("sales"))
series("purchases", "Bargain Hunter", "Buy from vendors {n} times.", { 10, 50, 250 }, bts, counter("purchases"))
series("groups", "Team Mom", "Join {n} groups.", { 10, 50, 250 }, bts, counter("groups"))
series("left", "Left on Read", "Leave {n} groups.", { 5, 25, 100 }, bts, counter("left"))
series("ready", "Yes, I'm Ready, Mom!", "Confirm {n} ready checks.", { 10, 50, 200 }, bts, counter("ready"))

-- ---------------------------------------------------------------- Mom-themed: emotes (Counters.lua hooks; only the count is kept)
series("sit", "Sit Down, Everyone", "Use /sit {n} times.", { 5, 25, 100 }, bts, counter("emote_sit"))
series("sleep", "Nap Time", "Use /sleep {n} times.", { 3, 15, 50 }, bts, counter("emote_sleep"))
series("stare", "Mom Stare", "Use /stare {n} times.", { 5, 25, 100 }, bts, counter("emote_stare"))
series("facepalm", "Are You Serious?", "Use /facepalm {n} times.", { 5, 25, 100 }, bts, counter("emote_facepalm"))
series("no", "Because I Said So", "Use /no {n} times.", { 5, 25, 100 }, bts, counter("emote_no"))
series("thank", "Thank-You Note", "Use /thank {n} times.", { 5, 25, 100 }, bts, counter("emote_thank"))
series("hugs", "Hugs and Kisses", "Give {n} hugs.", { 10, 50, 250 }, bts, counter("emote_hug"))
series("dances", "Kitchen Dance Party", "Dance {n} times.", { 10, 50, 250 }, bts, counter("emote_dance"))
series("kisses", "Smooches", "Blow {n} kisses.", { 5, 25, 100 }, bts, counter("emote_kiss"))
series("waves", "Friendly Neighbourhood Mom", "Wave hello {n} times.", { 25, 100, 500 }, bts, function(ctx) return math.max(stat(ctx, { "total waves" }), ctx.counter("emote_wave")) end)
series("cheers", "Cheerleader Mom", "Cheer {n} times.", { 10, 50, 250 }, bts, function(ctx) return math.max(stat(ctx, { "total cheers" }), ctx.counter("emote_cheer")) end)

-- ---------------------------------------------------------------- Mom-themed: from the game's own statistics
series("hearth", "Home Is Where the Heart Is", "Use your hearthstone {n} times.", { 25, 100, 500 }, bts, statistic("times hearthed"), { needsStat = { "times hearthed" } })
series("summons", "Carpool Lane", "Accept {n} summons.", { 10, 50, 200 }, bts, statistic("summons accepted"), { needsStat = { "summons accepted" } })
series("abandon", "Commitment Issues", "Abandon {n} quests.", { 25, 100, 300 }, bts, statistic("quests abandoned"), { needsStat = { "quests abandoned" } })
series("daily", "The Daily Grind", "Complete {n} daily quests.", { 50, 250, 1000 }, bts, statistic("daily quests completed"), { needsStat = { "daily quests completed" } })
series("buyer", "Impulse Buyer", "Make {n} auction house purchases.", { 100, 500, 1000 }, bts, statistic("auction purchases"), { needsStat = { "auction purchases" } })
series("healthstone", "Healthy Snack", "Use {n} healthstones.", { 10, 50, 200 }, bts, statistic("healthstones used"), { needsStat = { "healthstones used" } })
series("catmom", "Crazy Cat Mom", "Own {n} vanity pets.", { 10, 50, 100 }, bts, statistic("vanity pets owned"), { needsStat = { "vanity pets owned" } })
series("playdate", "Pet Playdate", "Win {n} pet battles.", { 10, 50, 200 }, bts, statistic("pet battles won"), { client = "retail" })
series("treasure", "Treasure Hunter Mom", "Loot {n} mislaid curiosities.", { 25, 100, 250 }, bts, statistic("curiosities looted"), { client = "retail" })

-- ---------------------------------------------------------------- Chronicle-derived (persisted tallies)
series("late", "Up Past Bedtime", "Log in between midnight and 5am {n} times.", { 3, 15, 50 }, bts, function(ctx) return ctx.event("lateLogin") end)
series("early", "Early Bird Special", "Log in between 5am and 8am {n} times.", { 3, 15, 50 }, bts, function(ctx) return ctx.event("earlyLogin") end)
series("marathon", "Marathon Mom", "Play {n} hours in a single session.", { 14400, 28800, 43200 }, bts, tally("longestSession"), { format = hours })
series("relog", "Just Five More Minutes", "Log back in within a minute of logging out {n} times.", { 3, 10, 25 }, bts, tally("quickRelogs"))
series("streak", "Regular Regular", "Log in on {n} days in a row.", { 3, 7, 30, 100 }, btsp, tally("bestStreak"))
series("weekend", "Weekend Warrior", "Log in on {n} different weekends.", { 5, 15, 40 }, bts, tally("weekends"))
series("learning", "Learning Experience", "Die {n} times in a single dungeon or raid visit.", { 5, 10 }, { "bronze", "silver" }, tally("maxInstanceDeaths"))
series("clean", "Clean Run", "Finish {n} dungeon or raid visits without dying.", { 5, 25, 100 }, bts, tally("cleanRuns"))
series("raid", "Raid Night", "Enter raids {n} times.", { 1, 5, 25 }, bts, tally("raidEntries"))
series("oops", "Oops-a-Daisy", "Be defeated {n} times.", { 1, 10, 50 }, bts, function(ctx) return ctx.event("character.death") end)
series("cooking", "Kitchen Witch", "Reach {n} skill in Cooking.", { 25, 75, 150 }, bts, function(ctx) return ctx.signal("skill_cooking") end)
series("fishing", "Patient Angler", "Reach {n} skill in Fishing.", { 25, 75, 150 }, bts, function(ctx) return ctx.signal("skill_fishing") end)
series("jack", "Jack of All Trades", "Learn {n} different professions.", { 3, 5, 7 }, bts, tally("professionCount"))
series("mom_of_many", "Mom of Many", "Play {n} characters with the addon.", { 2, 5, 10 }, bts, function(ctx) return ctx.characters() end)
series("long_haul", "Long Haul", "Keep a character going for {n} days.", { 30, 100, 365 }, bts, function(ctx) return ctx.characterAgeDays() end)
single("gravity", "Gravity's Favourite", "bronze", 1, "Die from a fall.", function(ctx) return ctx.signal("falling") end)
single("murloc_magnet", "Murloc Magnet", "bronze", 1, "Be defeated while facing a murloc, or in murloc territory.", function(ctx) return ctx.signal("murloc") end)
single("auction_goblin", "Auction House Goblin", "silver", 1000, "Post 1,000 auctions.", statistic("auctions posted"), { needsStat = { "auctions posted" } })
single("battlemaster", "Battlemaster", "bronze", 10, "Play 10 battlegrounds.", statistic("battlegrounds played"), { needsStat = { "battlegrounds played" } })

-- ---------------------------------------------------------------- WoW Forever only
series("journey", "The Journey Matters", "Reach level {n} on WoW Forever.", { 10, 20, 30, 40, 50 }, { "bronze", "bronze", "silver", "silver", "gold" }, function(ctx) return ctx.level() end, { client = "forever" })
single("ready_for_core", "Ready for the Core", "platinum", 60, "Reach level 60 on WoW Forever, the level cap.", function(ctx) return ctx.level() end, { client = "forever" })
series("old_world", "Old World, New Tricks", "Discover {n} zones or areas on WoW Forever.", { 25, 100, 300 }, bts, function(ctx) return ctx.event("world.zone_discovered") end, { client = "forever" })
single("beta_mom", "Beta Testing Mom", "silver", 1, "Play WoW Forever before launch day.", tally("betaLogin"), { client = "forever" })
single("day_one", "Day One Mom", "gold", 1, "Log in on 4 November 2026, the launch day of WoW Forever.", tally("dayOneLogin"), { client = "forever" })
single("one_year", "One Year Later", "gold", 365, "Still adventuring a year after your first WoW Forever session.", function(ctx) return ctx.clientDays() end, { client = "forever" })
single("skyborne", "Skyborne Landing", "silver", 1, "Play a Skyborne character.", function(ctx) return ctx.race():find("sky", 1, true) and 1 or 0 end, { client = "forever" })

-- ---------------------------------------------------------------- WoW Forever camping and new content
-- Names come from Blizzard's announcement and beta guides. Spell and object names are matched by keyword, and
-- /mam diag lists the camp-related spell names the client actually reports so detection can be verified.
single("happy_camper", "Happy Camper", "bronze", 1, "Complete The Great Outdoors, the quest that introduces camping.", tally("greatOutdoors"), { client = "forever" })
series("firestarter", "Firestarter", "Light {n} campfires.", { 1, 10, 50, 200 }, btsp, counter("campfires"), { client = "forever" })
single("journeyman_camper", "Journeyman Camper", "silver", 1, "Light a Journeyman Campfire.", counter("campfire_journeyman"), { client = "forever" })
single("expert_camper", "Expert Camper", "gold", 1, "Light an Expert Campfire.", counter("campfire_expert"), { client = "forever" })
series("camp_decorator", "Camp Decorator", "Place {n} camp objects.", { 5, 25, 100 }, bts, counter("camp_objects"), { client = "forever" })
series("well_stocked", "Well Stocked Camp", "Place {n} different kinds of camp object.", { 3, 6, 12 }, bts, tally("campObjectsCount"), { client = "forever" })
series("campfire_chef", "Campfire Chef", "Reach {n} skill in Cooking.", { 140, 220, 300 }, bts, function(ctx) return ctx.signal("skill_cooking") end, { client = "forever" })
series("unexplored_depths", "Unexplored Depths", "Enter {n} of Forever's nine new dungeons.", { 1, 3, 6, 9 }, btsp, tally("newDungeonsCount"), { client = "forever" })
single("summit_seeker", "Summit Seeker", "gold", 1, "Enter Hyjal Summit.", tally("hyjalSummit"), { client = "forever" })
single("into_the_barrow", "Into the Barrow", "silver", 1, "Enter The Barrow Deeps.", tally("barrowDeeps"), { client = "forever" })
series("islander", "Islander", "Enter the Darkspear Islands battleground {n} times.", { 1, 10, 50 }, bts, tally("darkspearEntries"), { client = "forever" })
series("new_horizons", "New Horizons", "Discover an area in {n} of Forever's four new zones.", { 1, 2, 4 }, bts, tally("newZonesCount"), { client = "forever" })
single("plot_twist", "Plot Twist", "silver", 1, "Play one of Forever's new race and class combinations.", function(ctx) return ctx.newCombo() and 1 or 0 end, { client = "forever" })

Medals.foreverDungeons = {
  thanes = { "hall of thanes" }, lordaeron = { "ruins of lordaeron" }, excavation = { "excavation site", "whelgar" }, dalaran = { "dalaran" },
  drowned = { "drowned city" }, kroldok = { "krol'dok", "kroldok" }, alcaz = { "alcaz prison" }, blackmaw = { "blackmaw hold" }, shaper = { "shaper's terrace" },
}
Medals.foreverZones = {
  hyjal = { "mount hyjal" }, riverglades = { "riverglades" }, shendralas = { "shen'dralas", "shendralas" }, zephras = { "zephras isle" },
}
Medals.newCombos = { human = "HUNTER", gnome = "PRIEST", dwarf = "SHAMAN", orc = "MAGE", troll = "WARLOCK", scourge = "PALADIN", undead = "PALADIN" }
Medals.campObjects = {
  "sharpening wheel", "mana well", "faction banner", "camp tent", "incense candle", "lodestone", "camp chair", "enchanted lute",
  "reagent bot", "first aid kit", "fish bowl", "repair bot", "anarchist's workbench", "tanning rack", "sewing machine", "rock garden", "molten foundry",
}

function Medals:GetDefinitions() return definitions end
function Medals:GetDefinition(id) return definitionsById[id] end
function Medals:AddListener(fn) if type(fn) == "function" then table.insert(listeners, fn) end end

local function notify(def, info)
  for _, listener in ipairs(listeners) do pcall(listener, def, info) end
end

-- ---------------------------------------------------------------- client and availability
function Medals:Client()
  local _, _, _, interface = safe(GetBuildInfo)
  interface = tonumber(interface)
  if interface and interface < 100000 then return "forever" end
  return "retail"
end

function Medals:LevelCap()
  if self:Client() == "forever" then return 60 end
  local cap = tonumber(safe(GetMaxPlayerLevel))
  return cap and cap > 0 and cap or 90
end

function Medals:IsAvailable(def)
  if def.client and def.client ~= self:Client() then return false end
  if def.minCap and self:LevelCap() < def.minCap then return false end
  if def.needsStat then
    -- Only offered when this client actually reports the statistic (Forever may not have every Retail statistic).
    local AS = Addon.AchievementStats
    if not AS or AS:FindValue(def.needsStat, Addon.characterKey) == nil then return false end
  end
  return true
end

-- ---------------------------------------------------------------- persisted tallies
-- Tallies are kept in SavedVariables (not rebuilt from events each time) so old history that
-- gets compacted away still counts.
local function localDay(timestamp)
  if not (dateFn and timeFn) then return nil end
  local parts = dateFn("*t", timestamp)
  if type(parts) ~= "table" then return nil end
  local noon = timeFn({ year = parts.year, month = parts.month, day = parts.day, hour = 12 })
  return math.floor(noon / 86400), parts
end

function Medals:Reset() self.counts = nil; self.newIds = {} end

function Medals:EnsureCounts()
  local database = Addon.db
  if not (database and Addon.characterKey) then return { total = 0, signals = {}, maxLevel = 0, professions = {}, professionCount = 0 }, false end
  if self.counts and self.countsFor == Addon.characterKey and self.countsDb == database.medalTallies then return self.counts, false end
  database.medalTallies = tableOr(database.medalTallies)
  local counts = database.medalTallies[Addon.characterKey]
  if not counts then
    counts = { total = 0, signals = {}, maxLevel = 0, professions = {}, professionCount = 0 }
    database.medalTallies[Addon.characterKey] = counts
  end
  counts.signals = tableOr(counts.signals); counts.professions = tableOr(counts.professions)
  self.counts, self.countsFor, self.countsDb = counts, Addon.characterKey, database.medalTallies
  local builtNow = false
  if not counts.built then
    builtNow = true
    counts.built = true
    local mine = {}
    for _, event in ipairs(database.events or {}) do
      if event.characterKey == Addon.characterKey and event.type ~= "medal.earned" then table.insert(mine, event) end
    end
    table.sort(mine, function(a, b) return (a.occurredAt or 0) < (b.occurredAt or 0) end)
    for _, event in ipairs(mine) do self:Count(event) end
  end
  return counts, builtNow
end

-- Distinct-value sets (for example which camp objects were placed) live in the tallies too.
function Medals:AddToSet(setName, value)
  local counts = self:EnsureCounts()
  counts.sets = tableOr(counts.sets)
  local set = tableOr(counts.sets[setName])
  counts.sets[setName] = set
  if not set[value] then
    set[value] = true
    local total = 0
    for _ in pairs(set) do total = total + 1 end
    counts[setName .. "Count"] = total
  end
end

local function matchesAny(text, patterns)
  for _, pattern in ipairs(patterns) do if text:find(pattern, 1, true) then return true end end
  return false
end

function Medals:CountLogin(counts, timestamp)
  if not dateFn then return end
  local hour = tonumber(dateFn("%H", timestamp))
  if hour and hour < 5 then counts.lateLogin = (counts.lateLogin or 0) + 1
  elseif hour and hour >= 5 and hour < 8 then counts.earlyLogin = (counts.earlyLogin or 0) + 1 end
  if counts.lastLogoutAt and timestamp - counts.lastLogoutAt >= 0 and timestamp - counts.lastLogoutAt <= 60 then counts.quickRelogs = (counts.quickRelogs or 0) + 1 end
  local day, parts = localDay(timestamp)
  if day then
    if counts.lastLoginDay ~= day then
      if counts.lastLoginDay and day == counts.lastLoginDay + 1 then counts.streak = (counts.streak or 1) + 1 else counts.streak = 1 end
      counts.bestStreak = math.max(counts.bestStreak or 0, counts.streak)
      counts.lastLoginDay = day
    end
    if parts.wday == 7 or parts.wday == 1 then
      local weekendId = parts.wday == 1 and day - 1 or day
      if counts.lastWeekend ~= weekendId then counts.weekends = (counts.weekends or 0) + 1; counts.lastWeekend = weekendId end
    end
  end
  if self:Client() == "forever" and timeFn then
    local launch = self.foreverLaunch
    if timestamp < timeFn({ year = launch.year, month = launch.month, day = launch.day, hour = 0 }) then counts.betaLogin = 1 end
    if parts and parts.year == launch.year and parts.month == launch.month and parts.day == launch.day then counts.dayOneLogin = 1 end
  end
end

function Medals:Count(event)
  local counts = self.counts
  counts.total = counts.total + 1
  counts[event.type] = (counts[event.type] or 0) + 1
  local payload = event.payload or {}
  local kind = event.type
  if kind == "character.death" then
    local cause = string.lower(tostring(payload.deathKind or ""))
    if cause:find("fall", 1, true) then counts.signals.falling = (counts.signals.falling or 0) + 1 end
    local context = string.lower(tostring(payload.lastHostileTarget or "") .. " " .. tostring(payload.zone or ""))
    if context:find("murloc", 1, true) then counts.signals.murloc = (counts.signals.murloc or 0) + 1 end
    if counts.inInstance then
      counts.instanceDeaths = (counts.instanceDeaths or 0) + 1
      counts.maxInstanceDeaths = math.max(counts.maxInstanceDeaths or 0, counts.instanceDeaths)
    end
  elseif kind == "character.level_up" and type(payload.level) == "number" then
    counts.maxLevel = math.max(counts.maxLevel, payload.level)
  elseif kind == "session.login" then
    self:CountLogin(counts, event.occurredAt)
  elseif kind == "session.logout" then
    counts.lastLogoutAt = event.occurredAt
    if type(payload.duration) == "number" then counts.longestSession = math.max(counts.longestSession or 0, payload.duration) end
  elseif kind == "instance.entered" then
    counts.inInstance, counts.instanceDeaths = true, 0
    if payload.instanceType == "raid" then counts.raidEntries = (counts.raidEntries or 0) + 1 end
    local place = string.lower(tostring(payload.instanceName or ""))
    for id, patterns in pairs(self.foreverDungeons) do
      if matchesAny(place, patterns) then self:AddToSet("newDungeons", id) end
    end
    if place:find("hyjal summit", 1, true) then counts.hyjalSummit = 1 end
    if place:find("barrow deeps", 1, true) then counts.barrowDeeps = 1 end
    if place:find("darkspear islands", 1, true) then counts.darkspearEntries = (counts.darkspearEntries or 0) + 1 end
  elseif kind == "instance.exited" then
    if counts.inInstance and (counts.instanceDeaths or 0) == 0 and (payload.instanceType == "party" or payload.instanceType == "raid") then
      counts.cleanRuns = (counts.cleanRuns or 0) + 1
    end
    counts.inInstance = false
  elseif kind == "world.zone_discovered" then
    local zone = string.lower(tostring(payload.zone or ""))
    for id, patterns in pairs(self.foreverZones) do
      if matchesAny(zone, patterns) then self:AddToSet("newZones", id) end
    end
  elseif kind == "quest.completed" then
    if string.lower(tostring(payload.questName or "")):find("great outdoors", 1, true) then counts.greatOutdoors = 1 end
  elseif kind == "profession.changed" then
    local name = string.lower(tostring(payload.professionName or ""))
    if name ~= "" and not counts.professions[name] then counts.professions[name] = true; counts.professionCount = counts.professionCount + 1 end
    if type(payload.skillLevel) == "number" then
      for _, skill in ipairs({ "cooking", "fishing" }) do
        if name:find(skill, 1, true) then
          local key = "skill_" .. skill
          counts.signals[key] = math.max(counts.signals[key] or 0, payload.skillLevel)
        end
      end
    end
  end
end

function Medals:BuildContext()
  local counts = self:EnsureCounts()
  local AS = Addon.AchievementStats
  local database = Addon.db
  return {
    stat = function(patterns)
      if not AS then return 0 end
      local _, value = AS:FindValue(patterns, Addon.characterKey)
      return value or 0
    end,
    event = function(name) return counts[name] or 0 end,
    signal = function(name) return counts.signals[name] or 0 end,
    tally = function(name) return counts[name] or 0 end,
    level = function() return math.max(tonumber(safe(UnitLevel, "player")) or 0, counts.maxLevel) end,
    counter = function(name)
      local row = database and database.counters and database.counters[Addon.characterKey]
      return row and row[name] or 0
    end,
    characters = function()
      local total = 0
      for _ in pairs(database and database.characters or {}) do total = total + 1 end
      return total
    end,
    characterAgeDays = function()
      local character = database and database.characters and database.characters[Addon.characterKey]
      if not (character and character.firstSeenAt) then return 0 end
      return math.max(0, math.floor((Addon:Now() - character.firstSeenAt) / 86400))
    end,
    clientDays = function()
      local created = database and database.meta and database.meta.createdAt
      if not created then return 0 end
      return math.max(0, math.floor((Addon:Now() - created) / 86400))
    end,
    race = function() return string.lower(tostring(select(2, safe(UnitRace, "player")) or "")) end,
    newCombo = function()
      local race = string.lower(tostring(select(2, safe(UnitRace, "player")) or ""))
      local class = string.upper(tostring(select(2, safe(UnitClass, "player")) or ""))
      return Medals.newCombos[race] ~= nil and Medals.newCombos[race] == class
    end,
  }
end

-- ---------------------------------------------------------------- evaluation
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
    if not row.earned[def.id] and self:IsAvailable(def) and def.value(ctx) >= def.target then
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
      self.newIds[def.id] = true
      Addon.EventStore:Append("medal.earned", { medalId = def.id, medalName = def.name, points = def.points })
      notify(def, { retro = false, reason = reason })
    end
  end
  if not baseline then self:CheckGoalProgress(row) end
  return awarded
end

-- One "nearly there" toast per pinned medal, once it is at 90 percent or more of its target.
function Medals:CheckGoalProgress(row)
  local pins = Addon.db and Addon.db.settings and Addon.db.settings.pinnedMedals
  if type(pins) ~= "table" or #pins == 0 or not Addon.Toast then return end
  row.goalNotified = tableOr(row.goalNotified)
  for _, goal in ipairs(self:GetGoals()) do
    local id = goal.def.id
    if not row.goalNotified[id] and goal.target >= 5 and goal.current >= goal.target * 0.9 and goal.current < goal.target then
      row.goalNotified[id] = true
      Addon:Guard("Goals", Addon.Toast.Show, Addon.Toast, { kind = "info", title = "Nearly there: " .. goal.def.name,
        text = tostring(math.floor(goal.current)) .. " / " .. tostring(goal.target) .. " - keep going!", action = "Medals" })
    end
  end
end

function Medals:OnEvent(event)
  if not event or event.type == "medal.earned" or event.characterKey ~= Addon.characterKey then return end
  local _, builtNow = self:EnsureCounts()
  if not builtNow then self:Count(event) end
  self:Evaluate("event")
end

-- Goals: up to three unearned medals the player pins to follow on Home.
Medals.maxPinned = 3

function Medals:IsPinned(id)
  local list = Addon.db and Addon.db.settings and Addon.db.settings.pinnedMedals
  if type(list) ~= "table" then return false end
  for _, pinned in ipairs(list) do if pinned == id then return true end end
  return false
end

function Medals:SetPinned(id, pinned)
  local settings = Addon.db and Addon.db.settings
  if not settings then return false end
  if type(settings.pinnedMedals) ~= "table" then settings.pinnedMedals = {} end
  local list = settings.pinnedMedals
  local index
  for position, value in ipairs(list) do if value == id then index = position end end
  if not pinned then
    if index then table.remove(list, index) end
    return true
  end
  local def = definitionsById[id]
  if not def or not self:IsAvailable(def) then return false end
  local row = Addon.db.medals and Addon.db.medals[Addon.characterKey]
  if row and row.earned[id] then return false end
  if index then return true end
  if #list >= self.maxPinned then return false end
  table.insert(list, id)
  return true
end

-- Progress entries for the pinned medals, in pin order. Earned or unavailable ones drop off the list.
function Medals:GetGoals()
  local settings = Addon.db and Addon.db.settings
  local list = settings and settings.pinnedMedals
  if type(list) ~= "table" then return {} end
  local byId = {}
  for _, entry in ipairs(self:GetProgress(Addon.characterKey)) do if not entry.earned then byId[entry.def.id] = entry end end
  local goals, kept = {}, {}
  for _, id in ipairs(list) do
    if byId[id] then table.insert(goals, byId[id]); table.insert(kept, id) end
  end
  settings.pinnedMedals = kept
  return goals
end

function Medals:GetSummary(key)
  local row = Addon.db and Addon.db.medals and Addon.db.medals[key or Addon.characterKey]
  local count, possible, total = 0, 0, 0
  for _, def in ipairs(definitions) do
    local earned = row and row.earned[def.id]
    if earned then count = count + 1; total = total + (tonumber(earned.points) or def.points) end
    if earned or self:IsAvailable(def) then possible = possible + 1 end
  end
  return { total = total, count = count, possible = possible }
end

-- Medals that cannot be earned on this client (wrong client or level cap) are left out unless already earned.
function Medals:GetProgress(key)
  local row = Addon.db and Addon.db.medals and Addon.db.medals[key or Addon.characterKey]
  local ctx = self:BuildContext()
  local list = {}
  for _, def in ipairs(definitions) do
    local earned = row and row.earned[def.id] or nil
    if earned or self:IsAvailable(def) then
      local current = def.value(ctx)
      table.insert(list, { def = def, current = current, target = def.target, earned = earned, fraction = math.min(1, current / def.target) })
    end
  end
  return list
end
