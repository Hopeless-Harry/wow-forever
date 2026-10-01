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
  targets = "Counted by the addon when you emote at guildmates. Only their first names and counts stay on this computer, never shared.",
  verified = "Confirmed by the Guild Lead. The addon cannot track this one, so it is awarded by hand.",
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
      id = id .. "_" .. index, family = id, name = name .. " " .. roman[index], tier = tiers[index], target = target,
      description = (description:gsub("{n}", tostring(shown))), value = value,
      client = options.client, minCap = options.capFromTarget and target or nil, needsStat = options.needsStat,
    })
  end
end

local function single(id, name, tier, target, description, value, options)
  options = options or {}
  register({ id = id, family = id, name = name, tier = tier, target = target, description = description, value = value, client = options.client, needsStat = options.needsStat })
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
series("mail", "Postmaster Mom", "Send {n} pieces of mail.", { 5, 25, 100 }, bts, counter("mail"))
series("bank", "Savings Account", "Open your bank {n} times.", { 10, 50, 200 }, bts, counter("bank"))
series("squad", "Mom Squad", "Enter {n} dungeons with a guildmate.", { 1, 5, 25 }, bts, counter("dungeon_guild"))
series("full_party", "Full Mom Party", "Enter {n} dungeons with a full group of guildmates.", { 1, 5, 15 }, bts, counter("dungeon_guild_full"))
series("raid_crew", "Raid Crew", "Enter {n} raids with five or more guildmates.", { 1, 3, 10 }, bts, counter("raid_guild"))

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

-- ---------------------------------------------------------------- holidays
-- Holiday dates are approximate (a fixed window each year) and may differ on WoW Forever. Two medal series per holiday:
-- logging in on different days during it, and a themed activity counted only while it runs (Counters.lua adds the
-- counts). Nothing here needs the network or the game calendar.
Medals.seasons = {
  { key = "brewfest", label = "Brewfest", from = { 9, 20 }, to = { 10, 6 }, counters = { wine = true, ale = true }, fun = "Toast", funText = "Drink {n} ales or wines during Brewfest." },
  { key = "hallows", label = "Hallow's End", from = { 10, 18 }, to = { 11, 1 }, counters = { food = true, cookie = true, pie = true }, fun = "Treats", funText = "Eat {n} treats during Hallow's End." },
  { key = "winter", label = "Winter Veil", from = { 12, 15 }, to = { 1, 2 }, counters = { food = true, coffee = true, juice = true }, fun = "Feast", funText = "Eat or drink {n} festive things during Winter Veil." },
  { key = "lunar", label = "Lunar Festival", from = { 1, 21 }, to = { 2, 4 }, counters = { emote_cheer = true, emote_wave = true }, fun = "Cheers", funText = "Cheer or wave {n} times during the Lunar Festival." },
  { key = "love", label = "Love Is in the Air", from = { 2, 5 }, to = { 2, 19 }, counters = { emote_hug = true, emote_kiss = true }, fun = "Cuddles", funText = "Give {n} hugs or kisses during Love Is in the Air." },
  { key = "midsummer", label = "Midsummer", from = { 6, 21 }, to = { 7, 5 }, counters = { emote_dance = true }, fun = "Dance", funText = "Dance {n} times during Midsummer." },
}
for _, season in ipairs(Medals.seasons) do
  series("season_" .. season.key .. "_days", season.label .. " Regular", "Log in on {n} days during " .. season.label .. ".", { 1, 3, 7 }, bts, tally("season_" .. season.key .. "_daysCount"))
  series("season_" .. season.key .. "_fun", season.label .. " " .. season.fun, season.funText, { 5, 25, 100 }, bts, counter("season_" .. season.key))
end

-- The season running at a timestamp (default now), and the year it started in (Winter Veil spans New Year).
function Medals:ActiveSeason(timestamp)
  if not dateFn then return nil end
  local parts = dateFn("*t", tonumber(timestamp) or Addon:Now())
  if type(parts) ~= "table" or not parts.month then return nil end
  local stamp = parts.month * 100 + parts.day
  for _, season in ipairs(self.seasons) do
    local from, to = season.from[1] * 100 + season.from[2], season.to[1] * 100 + season.to[2]
    if (from <= to and stamp >= from and stamp <= to) or (from > to and (stamp >= from or stamp <= to)) then
      local year = parts.year
      if from > to and stamp <= to then year = year - 1 end
      return season, year
    end
  end
  return nil
end

-- One toast when a holiday starts (once per holiday per year).
function Medals:AnnounceSeason()
  local season, year = self:ActiveSeason()
  local settings = Addon.db and Addon.db.settings
  if not (season and settings and Addon.Toast) then return end
  settings.seasonsSeen = tableOr(settings.seasonsSeen)
  local key = season.key .. tostring(year)
  if settings.seasonsSeen[key] then return end
  local known = 0
  for _ in pairs(settings.seasonsSeen) do known = known + 1 end
  if known >= 20 then settings.seasonsSeen = {} end
  settings.seasonsSeen[key] = true
  Addon:Guard("Seasons", Addon.Toast.Show, Addon.Toast, { kind = "info", title = season.label .. " is on!", text = "Seasonal medals are earning (holiday dates are approximate).", action = "Medals" })
end

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

-- Days in a row you have logged in. A streak is still alive if you last logged in today or yesterday.
function Medals:GetStreak()
  local counts = self:EnsureCounts()
  local today = localDay(Addon:Now())
  if not (today and counts.lastLoginDay) then return 0, tonumber(counts.bestStreak) or 0 end
  local alive = today - counts.lastLoginDay <= 1
  return alive and (tonumber(counts.streak) or 0) or 0, tonumber(counts.bestStreak) or 0
end

function Medals:CountLogin(counts, timestamp)
  if not dateFn then return end
  local hour = tonumber(dateFn("%H", timestamp))
  if hour and hour < 5 then counts.lateLogin = (counts.lateLogin or 0) + 1
  elseif hour and hour >= 5 and hour < 8 then counts.earlyLogin = (counts.earlyLogin or 0) + 1 end
  if counts.lastLogoutAt and timestamp - counts.lastLogoutAt >= 0 and timestamp - counts.lastLogoutAt <= 60 then counts.quickRelogs = (counts.quickRelogs or 0) + 1 end
  local day, parts = localDay(timestamp)
  if day then
    local season = self:ActiveSeason(timestamp)
    if season then self:AddToSet("season_" .. season.key .. "_days", day) end
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

function Medals:EmoteRow(token)
  local all = Addon.db and Addon.db.emoteTargets
  local character = all and all[Addon.characterKey]
  local row = character and character[token]
  if type(row) == "table" and type(row.names) == "table" then return row end
  return nil
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
    distinctTargets = function(token) local row = Medals:EmoteRow(token); return row and tonumber(row.distinct) or 0 end,
    targetCount = function(token, name) local row = Medals:EmoteRow(token); return row and tonumber(row.names[string.lower(name)]) or 0 end,
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
  local hadFamily = {}
  for _, known in ipairs(definitions) do if row.earned[known.id] then hadFamily[known.family] = true end end
  for _, def in ipairs(definitions) do
    if not def.verified and not row.earned[def.id] and self:IsAvailable(def) and def.value(ctx) >= def.target then
      row.earned[def.id] = { at = Addon:Now(), points = def.points, retro = baseline or nil }
      row.total = row.total + def.points; points = points + def.points
      table.insert(awarded, def)
    end
  end
  row.evaluatedAt = Addon:Now()
  self.evaluating = false
  if baseline then
    if #awarded > 0 then notify(nil, { summary = true, retro = true, count = #awarded, points = points, reason = reason }) end
    if Addon.Tracker then Addon:Guard("Tracker", Addon.Tracker.Refresh, Addon.Tracker) end
  else
    for _, def in ipairs(awarded) do
      self.newIds[def.id] = true
      Addon.EventStore:Append("medal.earned", { medalId = def.id, medalName = def.name, points = def.points })
      notify(def, { retro = false, reason = reason })
    end
    -- The first medal of a family also unlocks its title.
    local announced = {}
    for _, def in ipairs(awarded) do
      local title = self.titles and self.titles[def.family]
      if title and not hadFamily[def.family] and not announced[def.family] and Addon.Toast then
        announced[def.family] = true
        Addon:Guard("Titles", Addon.Toast.Show, Addon.Toast, { kind = "info", title = "New title: " .. title, text = "Unlocked by " .. def.name .. ". Pick it in Settings.", action = "Medals" })
      end
    end
  end
  if not baseline then self:CheckGoalProgress(row); self:CheckQuests(row) end
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

-- ---------------------------------------------------------------- categories
Medals.categories = {
  { key = "progress", label = "Progress" },
  { key = "kitchen", label = "Kitchen & Bar" },
  { key = "habits", label = "Mom Habits" },
  { key = "emotes", label = "Emotes" },
  { key = "pattern", label = "Play Pattern" },
  { key = "guild", label = "Guild" },
  { key = "seasonal", label = "Holidays" },
  { key = "forever", label = "WoW Forever" },
}
Medals.categoriesByKey = {}
for _, category in ipairs(Medals.categories) do Medals.categoriesByKey[category.key] = category end

local function assignCategory(key, families)
  for family in families:gmatch("%S+") do Medals.familyCategory[family] = key end
end
Medals.familyCategory = {}
assignCategory("progress", "fresh_start memory_keeper explorer quest_machine delver dungeon_regular slayer frequent_flyer comeback_kid adventurer shiny_collector achiever")
assignCategory("kitchen", "wine ale coffee food cheese cookie pie soup fish juice water bandage potion")
assignCategory("habits", "jumps mounts afk rest shots outfits repairs sales purchases groups left ready mail bank hearth summons abandon daily buyer healthstone catmom playdate treasure auction_goblin battlemaster")
assignCategory("emotes", "sit sleep stare facepalm no thank hugs dances kisses waves cheers")
assignCategory("pattern", "late early marathon relog streak weekend learning clean raid oops cooking fishing jack mom_of_many long_haul gravity murloc_magnet squad full_party raid_crew")
-- ---------------------------------------------------------------- guild medals (variety, named, verified)
-- Edit these two tables to add named-target and guild-verified medals, then release a new build.
-- Named: an emote aimed at one guild character. `targets` are the tier counts (up to 4); `title` is optional.
Medals.namedMedals = {
  { id = "hopeless_spit", name = "Hopeless Case", emote = "SPIT", target = "Hopeless", verb = "Spit at", targets = { 1, 10, 50 }, title = "Hopeless Mom" },
}
-- Verified: things the addon cannot observe (for example Discord posts). The Guild Master awards them by hand.
Medals.verifiedMedals = {
  { id = "selfie_squad", name = "Selfie Squad", tier = "silver", description = "Post 10 selfies in the Moms Discord.", title = "Selfie Mom" },
}
do
  local function distinct(token) return tagged("targets", function(ctx) return ctx.distinctTargets(token) end) end
  local function named(token, name) return tagged("targets", function(ctx) return ctx.targetCount(token, name) end) end
  series("wave_people", "Hello, Neighbours", "Wave at {n} different guildies.", { 5, 15, 40 }, bts, distinct("WAVE"))
  series("hug_people", "Group Hug", "Hug {n} different guildies.", { 5, 15, 40 }, bts, distinct("HUG"))
  series("kiss_people", "Smooch Squad", "Blow kisses at {n} different guildies.", { 5, 15, 40 }, bts, distinct("KISS"))
  series("cheer_people", "Pep Rally", "Cheer for {n} different guildies.", { 5, 15, 40 }, bts, distinct("CHEER"))
  for _, entry in ipairs(Medals.namedMedals) do
    series(entry.id, entry.name, entry.verb .. " " .. entry.target .. " {n} times.", entry.targets, #entry.targets > 3 and btsp or bts, named(entry.emote, entry.target))
  end
  for _, entry in ipairs(Medals.verifiedMedals) do
    register({ id = entry.id, family = entry.id, name = entry.name, tier = entry.tier, target = 1, description = entry.description,
      value = tagged("verified", function() return 0 end), verified = true })
  end
end
assignCategory("guild", "wave_people hug_people kiss_people cheer_people")
for _, entry in ipairs(Medals.namedMedals) do Medals.familyCategory[entry.id] = "guild" end
for _, entry in ipairs(Medals.verifiedMedals) do Medals.familyCategory[entry.id] = "guild" end

for _, def in ipairs(definitions) do
  def.category = def.client == "forever" and "forever" or (def.family:find("^season_") and "seasonal") or Medals.familyCategory[def.family] or "progress"
end

-- Categories that have at least one medal this client can show (or that the player already earned), with progress.
function Medals:GetCategories()
  local totals, earned = {}, {}
  for _, entry in ipairs(self:GetProgress(Addon.characterKey)) do
    local key = entry.def.category
    totals[key] = (totals[key] or 0) + 1
    if entry.earned then earned[key] = (earned[key] or 0) + 1 end
  end
  local list = {}
  for _, category in ipairs(self.categories) do
    if totals[category.key] then list[#list + 1] = { key = category.key, label = category.label, total = totals[category.key], earned = earned[category.key] or 0 } end
  end
  return list
end

-- ---------------------------------------------------------------- Mom titles and the Mom Money shop
-- The title comes from the medal family that has earned the most Mom Money. Everything here is cosmetic and local:
-- nothing in it is ever sent to the guild.
Medals.titles = {
  wine = "Wine Mom", ale = "Pint Mom", coffee = "Coffee Mom", food = "Clean Plate Mom", cheese = "Cheese Mom", cookie = "Cookie Mom",
  pie = "Pie Mom", soup = "Soup Mom", fish = "Fishy Mom", juice = "Juice Box Mom", water = "Hydration Mom", bandage = "Nurse Mom",
  potion = "Medicine Mom", jumps = "Trampoline Mom", mounts = "School Run Mom", afk = "Five Minutes Mom", rest = "Weekend Away Mom",
  shots = "Paparazzi Mom", outfits = "Wardrobe Mom", repairs = "Seamstress Mom", sales = "Declutter Mom", purchases = "Bargain Mom",
  groups = "Team Mom", left = "Left-on-Read Mom", ready = "Ready Mom", mail = "Postmaster Mom", bank = "Banker Mom", sit = "Sit-Down Mom", sleep = "Nap Mom", stare = "Stare Mom",
  facepalm = "Facepalm Mom", no = "Because-I-Said-So Mom", thank = "Thank-You Mom", hugs = "Hug Mom", dances = "Dance Party Mom",
  kisses = "Smooch Mom", waves = "Neighbourhood Mom", cheers = "Cheer Mom", late = "Night Owl Mom", early = "Early Bird Mom",
  marathon = "Marathon Mom", streak = "Regular Mom", weekend = "Weekend Warrior Mom", raid = "Raid Night Mom", clean = "Clean Run Mom",
  quest_machine = "Quest Mom", explorer = "Explorer Mom", dungeon_regular = "Dungeon Mom", slayer = "Slayer Mom", oops = "Oops Mom",
  gravity = "Gravity Mom", jack = "Jack-of-All-Trades Mom", firestarter = "Campfire Mom", campfire_chef = "Camp Chef Mom",
  hearth = "Homebody Mom", summons = "Carpool Mom", catmom = "Cat Mom", buyer = "Impulse Mom",
  squad = "Squad Mom", full_party = "Full Party Mom", raid_crew = "Raid Crew Mom",
}

-- Titles for every remaining family, so each family has exactly one.
for family, title in pairs({
  abandon = "Commitment Mom", daily = "Daily Grind Mom", healthstone = "Healthy Snack Mom",
  fresh_start = "Fresh Start Mom", memory_keeper = "Memory Keeper Mom", delver = "Delver Mom", frequent_flyer = "Frequent Flyer Mom",
  comeback_kid = "Comeback Mom", adventurer = "Adventurer Mom", shiny_collector = "Shiny Mom", achiever = "Achiever Mom",
  playdate = "Playdate Mom", treasure = "Treasure Mom", auction_goblin = "Goblin Mom", battlemaster = "Battle Mom",
  cooking = "Kitchen Witch Mom", fishing = "Angler Mom", long_haul = "Long Haul Mom", mom_of_many = "Mother of Many",
  relog = "Five More Minutes Mom", learning = "Learning Mom", murloc_magnet = "Murloc Mom",
  journey = "Journey Mom", ready_for_core = "Core Mom", old_world = "Old World Mom", beta_mom = "Beta Mom", day_one = "Day One Mom",
  one_year = "Anniversary Mom", skyborne = "Skyborne Mom", happy_camper = "Happy Camper Mom", journeyman_camper = "Journeyman Camper Mom",
  expert_camper = "Expert Camper Mom", camp_decorator = "Camp Decorator Mom", well_stocked = "Well Stocked Mom", unexplored_depths = "Depths Mom",
  summit_seeker = "Summit Mom", into_the_barrow = "Barrow Mom", islander = "Islander Mom", new_horizons = "Horizons Mom", plot_twist = "Plot Twist Mom",
}) do Medals.titles[family] = title end
for family, title in pairs({ wave_people = "Welcome Wagon Mom", hug_people = "Group Hug Mom", kiss_people = "Smooch Squad Mom", cheer_people = "Pep Rally Mom" }) do Medals.titles[family] = title end
for _, entry in ipairs(Medals.namedMedals) do Medals.titles[entry.id] = entry.title or (entry.name .. " Mom") end
for _, entry in ipairs(Medals.verifiedMedals) do Medals.titles[entry.id] = entry.title or (entry.name .. " Mom") end

Medals.cosmetics = {
  { id = "style_gold", kind = "toastStyle", name = "Default toast colours", cost = 0 },
  { id = "style_rose", kind = "toastStyle", name = "Rose toasts", cost = 50, color = { 0.95, 0.45, 0.60, 1 } },
  { id = "style_teal", kind = "toastStyle", name = "Teal toasts", cost = 75, color = { 0.25, 0.80, 0.75, 1 } },
  { id = "style_violet", kind = "toastStyle", name = "Violet toasts", cost = 100, color = { 0.65, 0.45, 0.95, 1 } },
  { id = "style_sunset", kind = "toastStyle", name = "Sunset toasts", cost = 150, color = { 1.00, 0.55, 0.20, 1 } },
  { id = "flourish_great", kind = "flourish", name = "Title: the Great", cost = 100, suffix = "the Great" },
  { id = "flourish_supreme", kind = "flourish", name = "Title: Supreme", cost = 250, suffix = "Supreme" },
  { id = "flourish_legend", kind = "flourish", name = "Title: of Legend", cost = 500, suffix = "of Legend" },
}
Medals.cosmeticsById = {}
for _, item in ipairs(Medals.cosmetics) do Medals.cosmeticsById[item.id] = item end

local function characterRow(key) return Addon.db and Addon.db.medals and Addon.db.medals[key or Addon.characterKey] end
local function cosmeticSettings()
  local settings = Addon.db and Addon.db.settings
  if not settings then return nil end
  if type(settings.cosmetics) ~= "table" then settings.cosmetics = { unlocked = {}, toastStyle = "style_gold", flourish = "" } end
  settings.cosmetics.unlocked = tableOr(settings.cosmetics.unlocked)
  return settings.cosmetics
end

local function earnedPointsByFamily(key)
  local row = characterRow(key)
  local points, order = {}, {}
  if not row then return points, order end
  for _, def in ipairs(definitions) do
    local earned = row.earned[def.id]
    if earned and Medals.titles[def.family] then
      if not points[def.family] then order[#order + 1] = def.family end
      points[def.family] = (points[def.family] or 0) + (tonumber(earned.points) or def.points)
    end
  end
  return points, order
end

function Medals:GetEarnedTitles()
  local _, order = earnedPointsByFamily()
  local list = {}
  for _, family in ipairs(order) do list[#list + 1] = { family = family, title = self.titles[family] } end
  return list
end

function Medals:SetTitleChoice(family)
  local settings = Addon.db and Addon.db.settings
  if not settings then return false end
  if family == "auto" then settings.titleChoice = "auto"; return true end
  local points = earnedPointsByFamily()
  if not (self.titles[family] and points[family]) then return false end
  settings.titleChoice = family
  return true
end

function Medals:GetTitle(key)
  local settings = Addon.db and Addon.db.settings
  local points, order = earnedPointsByFamily(key)
  local family
  local choice = (not key or key == Addon.characterKey) and settings and settings.titleChoice
  if choice and choice ~= "auto" and points[choice] then family = choice
  else
    for _, candidate in ipairs(order) do
      if not family or points[candidate] > points[family] then family = candidate end
    end
  end
  local title = family and self.titles[family] or "Rookie Mom"
  local cosmetics = cosmeticSettings()
  local flourish = cosmetics and self.cosmeticsById[cosmetics.flourish]
  if flourish and flourish.suffix then title = title .. " " .. flourish.suffix end
  return title
end

function Medals:GetTitleCounts()
  local families, total = {}, 0
  for _, def in ipairs(definitions) do
    if self.titles[def.family] and not families[def.family] and (self:IsAvailable(def) or (characterRow() and characterRow().earned[def.id])) then
      families[def.family] = true; total = total + 1
    end
  end
  local _, order = earnedPointsByFamily()
  return { earned = #order, total = total }
end

-- Mom Money earned from medals plus the bonus from weekly Mom Quests.
function Medals:GetEarnedMoney()
  local row = characterRow()
  return self:GetSummary(Addon.characterKey).total + (row and tonumber(row.bonus) or 0)
end

-- Mom Money left for any character (used by the Characters tab).
function Medals:GetMoneyFor(key)
  local row = characterRow(key)
  return math.max(0, self:GetSummary(key).total + (row and tonumber(row.bonus) or 0) - (row and tonumber(row.spent) or 0))
end

function Medals:GetMomMoney()
  local row = characterRow()
  return math.max(0, self:GetEarnedMoney() - (row and tonumber(row.spent) or 0))
end

function Medals:IsOwned(id)
  local item = self.cosmeticsById[id]
  if not item then return false end
  if item.cost == 0 then return true end
  local cosmetics = cosmeticSettings()
  return cosmetics ~= nil and cosmetics.unlocked[id] == true
end

function Medals:Equip(id)
  local item = self.cosmeticsById[id]
  local cosmetics = cosmeticSettings()
  if not item or not cosmetics then return false end
  if not self:IsOwned(id) then return false end
  if item.kind == "toastStyle" then cosmetics.toastStyle = id else cosmetics.flourish = id end
  return true
end

function Medals:Unequip(kind)
  local cosmetics = cosmeticSettings()
  if not cosmetics then return false end
  if kind == "flourish" then cosmetics.flourish = "" else cosmetics.toastStyle = "style_gold" end
  return true
end

function Medals:IsEquipped(id)
  local item, cosmetics = self.cosmeticsById[id], cosmeticSettings()
  if not item or not cosmetics then return false end
  if item.kind == "toastStyle" then return cosmetics.toastStyle == id end
  return cosmetics.flourish == id
end

function Medals:Buy(id)
  local item = self.cosmeticsById[id]
  if not item or item.cost <= 0 then return false, "That item is not for sale." end
  local row, cosmetics = characterRow(), cosmeticSettings()
  if not (row and cosmetics) then return false, "No medal record yet." end
  if self:IsOwned(id) then return false, "You already own that." end
  if self:GetMomMoney() < item.cost then return false, "Not enough Mom Money (" .. tostring(item.cost) .. " needed)." end
  row.spent = (tonumber(row.spent) or 0) + item.cost
  cosmetics.unlocked[id] = true
  self:Equip(id)
  return true
end

function Medals:GetToastColour()
  local cosmetics = cosmeticSettings()
  local item = cosmetics and self.cosmeticsById[cosmetics.toastStyle]
  return item and item.color or nil
end

-- ---------------------------------------------------------------- weekly Mom Quests
-- Three small tasks a week that pay extra Mom Money. The week number counts from the WoW Forever launch
-- (4 November 2026, 00:00 UTC) and the choice is worked out from that number alone, so every guildmate on the same
-- build sees the same quests without any messages. Difficulty ramps from week one (a few quests, a few meals)
-- up to band six around week twelve. Retail players use the same calendar.
Medals.launchEpoch = 1793750400
local WEEK_SECONDS = 604800
local levelTargets = { 10, 15, 20, 25, 30, 36, 42, 48, 54, 60 }

-- Returns the week number (never below one), when that calendar week started, and the raw week index. Before launch the
-- week number stays at one (the preview week), but the start and index keep moving so progress still resets every week.
function Medals:GetWeek(now)
  now = tonumber(now) or Addon:Now()
  local index = math.floor((now - self.launchEpoch) / WEEK_SECONDS)
  return math.max(1, index + 1), self.launchEpoch + index * WEEK_SECONDS, index
end

function Medals:GetBand(week) return math.max(1, math.min(6, math.floor(((tonumber(week) or 1) - 1) / 2) + 1)) end
function Medals:GetLevelTarget(week) return levelTargets[math.min(math.max(1, tonumber(week) or 1), #levelTargets)] end

-- slot 1 adventure, slot 2 Mom life, slot 3 stretch. targets are per difficulty band (1 to 6).
local questTemplates = {
  { id = "quests", slot = 1, event = "quest.completed", text = "Complete {n} quests", targets = { 5, 10, 18, 28, 40, 55 }, minBand = 1 },
  { id = "discover", slot = 1, event = "world.zone_discovered", text = "Discover {n} new areas", targets = { 3, 5, 8, 12, 16, 20 }, minBand = 1 },
  { id = "level", slot = 1, level = true, forever = true, text = "Reach level {n}", targets = { 10, 15, 20, 25, 30, 36 }, minBand = 1 },
  { id = "dungeon", slot = 1, event = "instance.entered", text = "Enter {n} dungeons", targets = { 1, 2, 3, 4, 6, 8 }, minBand = 2 },
  { id = "loot", slot = 1, event = "loot.notable", text = "Loot {n} notable items", targets = { 1, 1, 2, 2, 3, 4 }, minBand = 4 },
  { id = "food", slot = 2, counter = "food", text = "Eat {n} meals", targets = { 3, 6, 10, 15, 20, 30 }, minBand = 1 },
  { id = "coffee", slot = 2, counter = "coffee", text = "Drink {n} coffees or hot drinks", targets = { 2, 3, 5, 8, 10, 14 }, minBand = 1 },
  { id = "wine", slot = 2, counter = "wine", text = "Enjoy {n} glasses of wine", targets = { 1, 2, 3, 4, 6, 8 }, minBand = 1 },
  { id = "jumps", slot = 2, counter = "jumps", text = "Jump {n} times", targets = { 30, 60, 120, 200, 350, 500 }, minBand = 1 },
  { id = "hugs", slot = 2, counter = "emote_hug", text = "Give {n} hugs", targets = { 2, 3, 5, 8, 10, 15 }, minBand = 1 },
  { id = "shots", slot = 2, counter = "shots", text = "Take {n} screenshots", targets = { 1, 2, 3, 4, 5, 6 }, minBand = 1 },
  { id = "sales", slot = 2, counter = "sales", text = "Make {n} vendor sales", targets = { 3, 5, 8, 12, 16, 20 }, minBand = 1 },
  { id = "repairs", slot = 2, counter = "repairs", text = "Repair your gear {n} times", targets = { 1, 1, 2, 3, 4, 5 }, minBand = 2 },
  { id = "potion", slot = 2, counter = "potion", text = "Use {n} potions", targets = { 1, 2, 3, 5, 8, 10 }, minBand = 3 },
  { id = "mounts", slot = 2, counter = "mounts", text = "Mount up {n} times", targets = { 5, 8, 12, 18, 25, 35 }, minBand = 4 },
  { id = "campfire", slot = 3, counter = "campfires", forever = true, text = "Light {n} campfires", targets = { 1, 2, 3, 4, 6, 8 }, minBand = 1 },
  { id = "days", slot = 3, days = true, text = "Log in on {n} different days", targets = { 2, 3, 4, 4, 5, 5 }, minBand = 1 },
  { id = "dances", slot = 3, counter = "emote_dance", text = "Dance {n} times", targets = { 2, 3, 5, 8, 10, 15 }, minBand = 1 },
  { id = "groups", slot = 3, counter = "groups", text = "Join {n} groups", targets = { 1, 2, 3, 4, 5, 6 }, minBand = 2 },
  { id = "squadrun", slot = 3, counter = "dungeon_guild", text = "Run {n} dungeons with a guildmate", targets = { 1, 1, 2, 2, 3, 3 }, minBand = 2 },
  { id = "ready", slot = 3, counter = "ready", text = "Confirm {n} ready checks", targets = { 1, 2, 3, 4, 5, 6 }, minBand = 3 },
}

function Medals:GetQuestTemplates() return questTemplates end

local function questReward(band, slot) return (band <= 2 and 10 or (band <= 4 and 15 or 20)) + (slot == 3 and 5 or 0) end
Medals.questAllBonus = 10

-- The three quests for a week (no saved state involved).
function Medals:SelectQuests(week, levelNow)
  local band = self:GetBand(week)
  local forever = self:Client() == "forever"
  local picks = {}
  for slot = 1, 3 do
    local eligible = {}
    for _, template in ipairs(questTemplates) do
      if template.slot == slot and template.minBand <= band and (not template.forever or forever) then eligible[#eligible + 1] = template end
    end
    local n = #eligible
    if n > 0 then
      local start = ((week - 1) + slot * 2) % n
      local chosen
      for step = 0, n - 1 do
        local template = eligible[(start + step) % n + 1]
        -- a level goal the character has already passed is skipped
        if not (template.level and levelNow and levelNow >= self:GetLevelTarget(week)) then chosen = template; break end
      end
      picks[slot] = chosen or eligible[start + 1]
    end
  end
  -- A guild order (Q1 from rank 0 or 1) can replace the picks for one week.
  local override = Addon.db and Addon.db.questOverride
  if type(override) == "table" and override.week == week and type(override.slots) == "table" then
    for slot = 1, 3 do
      for _, template in ipairs(questTemplates) do
        if template.id == override.slots[slot] and template.slot == slot and (not template.forever or forever) then picks[slot] = template end
      end
    end
  end
  return picks, band
end

local function questState(week, index)
  local database = Addon.db
  if not (database and Addon.characterKey) then return nil end
  database.challenges = tableOr(database.challenges)
  local state = database.challenges[Addon.characterKey]
  if type(state) ~= "table" or state.index ~= index then
    state = { week = week, index = index, baselines = {}, done = {} }
    database.challenges[Addon.characterKey] = state
  end
  state.baselines, state.done = tableOr(state.baselines), tableOr(state.done)
  return state
end

local function loginDaysThisWeek(weekStart)
  if not (Addon.EventStore and dateFn) then return 0 end
  local days, total = {}, 0
  for _, event in ipairs(Addon.EventStore:Query({ type = "session.login", characterKey = Addon.characterKey, fromTime = weekStart })) do
    local key = dateFn("%Y%m%d", event.occurredAt)
    if not days[key] then days[key] = true; total = total + 1 end
  end
  return total
end

-- The quests for a week with progress. Progress and baselines exist only for the current week.
function Medals:GetWeeklyQuests(week)
  local current, weekStart, index = self:GetWeek()
  week = tonumber(week) or current
  local isCurrent = week == current
  local levelNow = tonumber(safe(UnitLevel, "player"))
  local picks, band = self:SelectQuests(week, levelNow)
  local state = isCurrent and questState(week, index) or nil
  local ctx = isCurrent and self:BuildContext() or nil
  local list = {}
  for slot = 1, 3 do
    local template = picks[slot]
    if template then
      local target = template.level and self:GetLevelTarget(week) or template.targets[band]
      local quest = {
        id = "w" .. week .. "_" .. template.id, key = template.id, slot = slot, band = band, target = target, reward = questReward(band, slot),
        text = (template.text:gsub("{n}", tostring(target))), forever = template.forever, counter = template.counter, metric = template.event,
        kind = template.level and "level" or (template.days and "days" or (template.counter and "counter" or "event")), current = 0, done = false,
      }
      if isCurrent and state and ctx then
        local value
        if template.level then value = ctx.level(); quest.current = value
        elseif template.days then quest.current = loginDaysThisWeek(weekStart)
        else
          value = template.counter and ctx.counter(template.counter) or ctx.event(template.event)
          if state.baselines[template.id] == nil then state.baselines[template.id] = value end
          quest.current = math.max(0, value - state.baselines[template.id])
        end
        quest.done = state.done[template.id] == true
      end
      list[#list + 1] = quest
    end
  end
  return list
end

function Medals:CheckQuests(row)
  local week, _, index = self:GetWeek()
  local state = questState(week, index)
  if not state then return end
  local quests = self:GetWeeklyQuests()
  local finished = 0
  for _, quest in ipairs(quests) do
    if not quest.done and quest.current >= quest.target then
      state.done[quest.key] = true; quest.done = true
      row.bonus = (tonumber(row.bonus) or 0) + quest.reward
      row.questsDone = (tonumber(row.questsDone) or 0) + 1
      if Addon.Toast then
        Addon:Guard("Quests", Addon.Toast.Show, Addon.Toast, { kind = "info", title = "Mom Quest done: " .. quest.text, text = "+" .. tostring(quest.reward) .. " Mom Money", action = "Medals" })
      end
    end
    if quest.done then finished = finished + 1 end
  end
  if #quests > 0 and finished == #quests and not state.allDone then
    state.allDone = true
    row.bonus = (tonumber(row.bonus) or 0) + self.questAllBonus
    if Addon.Toast then
      Addon:Guard("Quests", Addon.Toast.Show, Addon.Toast, { kind = "medal", title = "All Mom Quests done this week!", text = "Bonus +" .. tostring(self.questAllBonus) .. " Mom Money", action = "Medals" })
    end
  end
end

function Medals:DescribeQuests()
  local week = self:GetWeek()
  local lines = {}
  for _, quest in ipairs(self:GetWeeklyQuests()) do
    local progress = math.floor(math.min(quest.current, quest.target))
    lines[#lines + 1] = (quest.done and "[x] " or "[ ] ") .. quest.text .. "  " .. tostring(progress) .. " / " .. tostring(quest.target) .. "  +" .. tostring(quest.reward)
  end
  return week, lines
end


-- Titles and category for the holiday medal families.
for _, season in ipairs(Medals.seasons) do
  Medals.titles["season_" .. season.key .. "_days"] = season.label .. " Regular Mom"
  Medals.titles["season_" .. season.key .. "_fun"] = season.label .. " " .. season.fun .. " Mom"
end

-- Goals: up to three unearned medals the player pins to follow on Home.
Medals.maxPinned = 6

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
    if index then table.remove(list, index); if Addon.Tracker then Addon.Tracker:Request() end end
    return true
  end
  local def = definitionsById[id]
  if not def or def.verified or not self:IsAvailable(def) then return false end
  local row = Addon.db.medals and Addon.db.medals[Addon.characterKey]
  if row and row.earned[id] then return false end
  if index then return true end
  if #list >= self.maxPinned then return false end
  table.insert(list, id)
  if Addon.Tracker then Addon.Tracker:Request() end
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

-- ---------------------------------------------------------------- guild-verified awards
-- Granted by the Guild Master's award message (or a local test grant), never by tracking.
function Medals:GrantVerified(id, opts)
  local def = definitionsById[id]
  local database, key = Addon.db, Addon.characterKey
  if not (def and def.verified and database and key) then return false, "unknown" end
  local row = database.medals and database.medals[key]
  if not row then return false, "not ready" end
  local test = opts and opts.test == true
  local existing = row.earned[id]
  -- A test grant must not block a later real one; a real grant is never replaced.
  if existing and not (existing.test and not test) then return false, "already" end
  row.earned[id] = { at = Addon:Now(), points = test and 0 or def.points, verified = true, test = test or nil }
  self.newIds[id] = true
  if test then
    if Addon.Toast then Addon:Guard("Verified", Addon.Toast.Show, Addon.Toast, { kind = "medal", title = "[TEST] " .. def.name, text = def.description, points = 0, action = "Medals" }) end
    return true
  end
  row.total = (tonumber(row.total) or 0) + def.points
  if Addon.EventStore then Addon.EventStore:Append("medal.earned", { medalId = def.id, medalName = def.name, points = def.points }) end
  notify(def, { retro = false, reason = "award" })
  return true
end

function Medals:RevokeVerified(id, opts)
  local def = definitionsById[id]
  local row = Addon.db and Addon.db.medals and Addon.db.medals[Addon.characterKey]
  if not (def and def.verified and row) then return false, "unknown" end
  local earned = row.earned[id]
  if not earned then return false, "not earned" end
  if opts and opts.testOnly == true and not earned.test then return false, "not a test grant" end
  if not earned.test then row.total = math.max(0, (tonumber(row.total) or 0) - (tonumber(earned.points) or def.points)) end
  row.earned[id] = nil
  return true
end

function Medals:ClearTestGrants()
  local row = Addon.db and Addon.db.medals and Addon.db.medals[Addon.characterKey]
  local removed = 0
  if not row then return 0 end
  for _, def in ipairs(definitions) do
    local earned = row.earned[def.id]
    if def.verified and earned and earned.test then row.earned[def.id] = nil; removed = removed + 1 end
  end
  return removed
end
