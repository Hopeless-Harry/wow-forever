local Addon = MAMChronicles
local AchievementStats = {}
Addon.AchievementStats = AchievementStats

local GOLD = "Gold and money"
local SCAN_DELAY, RETRY_DELAY, MONTHS_KEPT = 8, 15, 6
AchievementStats.groupOrder = {
  "Deaths and combat", "Quests", "Exploration and travel", "Dungeons and raids", "Professions and crafting",
  "Social", "Loot and items", "Time played", "Player versus player", "Character", "World events", "Pet battles", "Legacy", GOLD, "Other",
}

local function finite(value) return type(value) == "number" and value == value and value ~= math.huge and value ~= -math.huge end
local function tableOr(value) return type(value) == "table" and value or {} end
local function safe(fn, ...) return Addon:SafeCall(fn, ...) end
local function monthKey(timestamp)
  local dateFn = date or (os and os.date)
  return dateFn and dateFn("%Y-%m", timestamp) or "unknown"
end
local function copyValues(values)
  local result = {}
  for id, value in pairs(values) do result[id] = value end
  return result
end

local function formatNumber(value)
  local text = tostring(math.floor(value + 0.5))
  local formatted = text:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  return (formatted:gsub("^,", ""))
end
local function formatDuration(seconds)
  local days, hours = math.floor(seconds / 86400), math.floor((seconds % 86400) / 3600)
  if days > 0 then return tostring(days) .. "d " .. tostring(hours) .. "h" end
  local minutes = math.floor((seconds % 3600) / 60)
  if hours > 0 then return tostring(hours) .. "h " .. tostring(minutes) .. "m" end
  return tostring(minutes) .. "m"
end
local function formatStat(value, kind)
  if kind == "duration" then return formatDuration(value) end
  return formatNumber(value)
end

local moneyUnits = { gold = 10000, silver = 100, copper = 1 }
local timeUnits = { day = 86400, days = 86400, d = 86400, hr = 3600, hrs = 3600, hour = 3600, hours = 3600, h = 3600,
  min = 60, mins = 60, minute = 60, minutes = 60, m = 60, sec = 1, secs = 1, second = 1, seconds = 1, s = 1 }

-- The game returns statistics as display strings ("1,234", "12 Gold 34 Silver", "2 Days 3 Hr", "--").
function AchievementStats:ParseValue(text)
  if type(text) ~= "string" then return nil end
  text = text:gsub("^%s+", ""):gsub("%s+$", "")
  if text == "" or text == "--" then return nil end
  -- Some statistics read "16025 (Humanoid)" or "9 ()": a count followed by a bracketed label.
  local withLabel = text:match("^([%d,]+)%s*%b()$")
  if withLabel then text = withLabel end
  if text:match("^[%d,%.]+$") then
    local number = tonumber((text:gsub(",", "")))
    if finite(number) then return number, "count" end
    return nil
  end
  local lowered = text:lower():gsub("|t[^|]*goldicon[^|]*|t", " gold "):gsub("|t[^|]*silvericon[^|]*|t", " silver "):gsub("|t[^|]*coppericon[^|]*|t", " copper ")
  local money, duration, seen = 0, 0, false
  local isMoney, isTime = false, false
  for amount, unit in lowered:gmatch("(%d[%d,]*)%s*(%a+)") do
    local number = tonumber((amount:gsub(",", "")))
    if not finite(number) then return nil end
    if moneyUnits[unit] then money = money + number * moneyUnits[unit]; isMoney = true
    elseif timeUnits[unit] then duration = duration + number * timeUnits[unit]; isTime = true
    else return nil end
    seen = true
  end
  if not seen or (isMoney and isTime) then return nil end
  if isMoney then return money, "money" end
  return duration, "duration"
end

local rootRules = {
  { "death", "Deaths and combat" }, { "combat", "Deaths and combat" }, { "kill", "Deaths and combat" },
  { "quest", "Quests" }, { "travel", "Exploration and travel" }, { "explor", "Exploration and travel" },
  { "dungeon", "Dungeons and raids" }, { "raid", "Dungeons and raids" }, { "delve", "Dungeons and raids" },
  { "skill", "Professions and crafting" }, { "profession", "Professions and crafting" }, { "craft", "Professions and crafting" },
  { "social", "Social" }, { "player vs", "Player versus player" }, { "pvp", "Player versus player" },
  { "battleground", "Player versus player" }, { "arena", "Player versus player" },
  { "loot", "Loot and items" }, { "item", "Loot and items" }, { "consum", "Loot and items" },
  { "world event", "World events" }, { "pet battle", "Pet battles" }, { "legacy", "Legacy" }, { "character", "Character" },
}

function AchievementStats:Classify(rootTitle, name, kind)
  local lowerName = tostring(name or ""):lower()
  if kind == "money" or lowerName:find("gold", 1, true) or lowerName:find("money", 1, true) or lowerName:find("copper", 1, true) then return GOLD end
  if kind == "duration" or lowerName:find("time played", 1, true) then return "Time played" end
  if lowerName:find("death", 1, true) then return "Deaths and combat" end
  local lowerRoot = tostring(rootTitle or ""):lower()
  for _, rule in ipairs(rootRules) do if lowerRoot:find(rule[1], 1, true) then return rule[2] end end
  return "Other"
end

local function db() return Addon.db end
local function characterKey() return Addon.characterKey end

function AchievementStats:SetStatus(state, reason, count, unparsed)
  self.status = { state = state, reason = reason, statCount = count, unparsed = unparsed, takenAt = state == "ok" and Addon:Now() or nil }
end

local function apisAvailable()
  return type(GetStatisticsCategoryList) == "function" and type(GetCategoryInfo) == "function"
    and type(GetCategoryNumAchievements) == "function" and type(GetAchievementInfo) == "function" and type(GetStatistic) == "function"
end

function AchievementStats:ScheduleRetry()
  if self.retryPending or not (C_Timer and C_Timer.After) then return end
  self.retryPending = true
  C_Timer.After(RETRY_DELAY, function() AchievementStats.retryPending = false; AchievementStats:Scan() end)
end

function AchievementStats:Schedule()
  if self.scheduled then return end
  self.scheduled = true
  if C_Timer and C_Timer.After then C_Timer.After(SCAN_DELAY, function() AchievementStats:Scan() end)
  else self:Scan() end
end

local function rootTitleFor(map, id)
  local title, depth = nil, 0
  local current = id
  while current and map[current] and depth < 6 do
    title = map[current].title
    local parent = map[current].parent
    if not parent or parent == current or not map[parent] then break end
    current = parent; depth = depth + 1
  end
  return title
end

function AchievementStats:Scan()
  local database = db()
  if not (database and database.settings) then return false end
  database.statistics = tableOr(database.statistics); database.statisticCatalog = tableOr(database.statisticCatalog)
  if database.settings.recordStatistics == false then self:SetStatus("disabled"); return false end
  if not apisAvailable() then self:SetStatus("unavailable", "statistics APIs missing on this client"); return false end
  if InCombatLockdown and InCombatLockdown() then self:SetStatus("pending", "in combat"); self:ScheduleRetry(); return false end
  local categories = safe(GetStatisticsCategoryList)
  if type(categories) ~= "table" then self:SetStatus("unavailable", "no statistic categories"); return false end
  local key = characterKey(); if not key then self:SetStatus("unavailable", "unknown character"); return false end

  local map = {}
  for _, id in ipairs(categories) do
    local title, parent = safe(GetCategoryInfo, id)
    map[id] = { title = title, parent = parent }
  end
  local includeGold = database.settings.recordGoldStatistics == true
  local values, catalog, count, unparsed = {}, database.statisticCatalog, 0, 0
  local samples, otherRoots = {}, {}
  for _, id in ipairs(categories) do
    local total = safe(GetCategoryNumAchievements, id, true)
    local root = rootTitleFor(map, id)
    for index = 1, (finite(total) and total or 0) do
      local statId, name = safe(GetAchievementInfo, id, index)
      if statId then
        local text = safe(GetStatistic, statId)
        local number, kind = self:ParseValue(text)
        if not number and type(text) == "string" and text:match("%S") and text ~= "--" then
          unparsed = unparsed + 1
          if #samples < 8 then table.insert(samples, { name = tostring(name or statId), raw = text:sub(1, 40) }) end
        end
        if number then
          local group = self:Classify(root, name, kind)
          if group == "Other" then otherRoots[root or "unknown"] = (otherRoots[root or "unknown"] or 0) + 1 end
          if group ~= GOLD or includeGold then
            values[statId] = number; count = count + 1
            catalog[statId] = { name = tostring(name or statId), group = group, kind = kind }
          end
        end
      end
    end
  end

  local now = Addon:Now()
  local row = tableOr(database.statistics[key]); row.months = tableOr(row.months)
  row.baseline = row.baseline or { takenAt = now, values = copyValues(values) }
  row.latest = { takenAt = now, values = values }
  local month = monthKey(now)
  if not row.months[month] then row.months[month] = { takenAt = now, values = copyValues(values) } end
  local keys = {}
  for name in pairs(row.months) do table.insert(keys, name) end
  table.sort(keys, function(a, b) return a > b end)
  for index = MONTHS_KEPT + 1, #keys do row.months[keys[index]] = nil end
  database.statistics[key] = row
  self:SetStatus("ok", nil, count, unparsed)
  self.status.unparsedSamples, self.status.otherRoots = samples, otherRoots
  return true
end

function AchievementStats:PurgeGold()
  local database = db(); if not database then return end
  local catalog = tableOr(database.statisticCatalog)
  local goldIds = {}
  for id, entry in pairs(catalog) do if type(entry) == "table" and entry.group == GOLD then goldIds[id] = true end end
  for id in pairs(goldIds) do catalog[id] = nil end
  for _, row in pairs(tableOr(database.statistics)) do
    local snapshots = { row.baseline, row.latest }
    for _, snapshot in pairs(tableOr(row.months)) do table.insert(snapshots, snapshot) end
    for _, snapshot in ipairs(snapshots) do
      if type(snapshot) == "table" and type(snapshot.values) == "table" then for id in pairs(goldIds) do snapshot.values[id] = nil end end
    end
  end
end

function AchievementStats:GetTopChanges(key, limit)
  local database = db(); local row = database and database.statistics and database.statistics[key]
  local result = {}
  if not (row and row.latest) then return result end
  local start = row.months and row.months[monthKey(row.latest.takenAt or Addon:Now())] or row.baseline
  local catalog = tableOr(database.statisticCatalog)
  for id, value in pairs(row.latest.values or {}) do
    local before = start and start.values and start.values[id] or value
    local delta = value - before
    local entry = catalog[id]
    if delta > 0 and entry then table.insert(result, { id = id, name = entry.name, group = entry.group, value = value, delta = delta }) end
  end
  table.sort(result, function(a, b) if a.delta ~= b.delta then return a.delta > b.delta end return a.name < b.name end)
  while #result > (limit or 10) do table.remove(result) end
  return result, start and start.takenAt
end

function AchievementStats:BuildText(key)
  local database = db(); local row = database and database.statistics and database.statistics[key]
  if not (row and row.latest) then
    local status = self.status or {}
    local why = status.state == "unavailable" and "This client does not expose statistics." or status.state == "disabled" and "Statistic recording is switched off in Settings." or "Statistics are collected shortly after login."
    return "Lifetime statistics: nothing collected yet. " .. why
  end
  local dateFn = date or (os and os.date)
  local lines = { "Lifetime statistics (snapshot " .. (dateFn and dateFn("%d %b %Y %H:%M", row.latest.takenAt) or tostring(row.latest.takenAt)) .. ")" }
  local catalog = tableOr(database.statisticCatalog)
  local perGroup, changes = {}, {}
  for id in pairs(row.latest.values or {}) do
    local entry = catalog[id]
    if entry then perGroup[entry.group] = (perGroup[entry.group] or 0) + 1 end
  end
  local topChanges, since = self:GetTopChanges(key, 200)
  for _, change in ipairs(topChanges) do
    changes[change.group] = changes[change.group] or {}
    if #changes[change.group] < 3 then table.insert(changes[change.group], change) end
  end
  local headlines = {}
  for id, value in pairs(row.latest.values or {}) do
    local entry = catalog[id]
    if entry and entry.kind ~= "money" then
      headlines[entry.group] = headlines[entry.group] or {}
      table.insert(headlines[entry.group], { name = entry.name, value = value, kind = entry.kind })
    end
  end
  for _, group in ipairs(self.groupOrder) do
    if perGroup[group] then
      table.insert(lines, group)
      local list = headlines[group] or {}
      table.sort(list, function(a, b) if a.value ~= b.value then return a.value > b.value end return a.name < b.name end)
      local parts = {}
      for index = 1, math.min(3, #list) do parts[index] = list[index].name .. " " .. formatStat(list[index].value, list[index].kind) end
      if #parts > 0 then table.insert(lines, "  " .. table.concat(parts, "  \194\183  ")) end
      for _, change in ipairs(changes[group] or {}) do
        table.insert(lines, "  +" .. tostring(change.delta) .. " " .. change.name .. " (now " .. tostring(change.value) .. ")")
      end
    end
  end
  if since and #topChanges > 0 then table.insert(lines, "Changes shown are since " .. (dateFn and dateFn("%d %b", since) or tostring(since)) .. ", the first scan this month.") end
  if #lines == 1 then table.insert(lines, "No statistics were readable on this client.") end
  return table.concat(lines, "\n")
end
