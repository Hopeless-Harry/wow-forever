local Addon = MAMChronicles
local Dashboard = {}
Addon.Dashboard = Dashboard

local SIDE, FOOTER, GAP = 16, 46, 8
local DASH = "\226\128\148"

-- Headline tiles. Names are matched against the statistic names the client reports, so a
-- missing or renamed statistic simply shows a dash instead of breaking anything.
local tileDefinitions = {
  { label = "Creatures killed", patterns = { "creatures killed" } },
  { label = "Quests completed", patterns = { "quests completed" } },
  { label = "Deaths", patterns = { "total deaths", "deaths" } },
  { label = "Dungeons entered", patterns = { "dungeons entered" } },
  { label = "Flight paths", patterns = { "flight paths" } },
  { label = "Delves completed", patterns = { "delves completed" } },
}

local function safeMethod(object, method, ...)
  if object and type(object[method]) == "function" then return pcall(object[method], object, ...) end
end
local function safe(fn, ...) return Addon:SafeCall(fn, ...) end
local function escapeText(text) return (tostring(text or ""):gsub("|", "||")) end

function Dashboard:FindStatistic(patterns)
  local database = Addon.db
  local row = database and database.statistics and database.statistics[Addon.characterKey]
  if not (row and row.latest and row.latest.values) then return nil end
  local catalog = database.statisticCatalog or {}
  for _, pattern in ipairs(patterns) do
    local bestId, bestValue
    for id, value in pairs(row.latest.values) do
      local entry = catalog[id]
      if entry then
        local name = tostring(entry.name):lower()
        if name == pattern or name:find(pattern, 1, true) then
          if not bestValue or value > bestValue then bestId, bestValue = id, value end
        end
      end
    end
    if bestId then return bestId, bestValue end
  end
  return nil
end

function Dashboard:Build()
  local AS, UI, Theme = Addon.AchievementStats, Addon.UI, Addon.Theme
  local model = { tiles = {}, month = {}, recent = {}, awards = {}, status = {}, character = {} }

  local changes = {}
  if AS then
    for _, change in ipairs(AS:GetTopChanges(Addon.characterKey, 1000)) do changes[change.id] = change.delta end
  end
  local catalog = Addon.db.statisticCatalog or {}
  for _, definition in ipairs(tileDefinitions) do
    local id, value = self:FindStatistic(definition.patterns)
    local kind = id and catalog[id] and catalog[id].kind
    local text = DASH
    if value then text = AS and AS.FormatStat and AS.FormatStat(value, kind) or tostring(value) end
    table.insert(model.tiles, { label = definition.label, value = text, delta = id and changes[id] or nil })
  end

  local fromTime, toTime = UI:GetCurrentMonthRange()
  local stats = Addon.Statistics:Build(fromTime, toTime)
  model.month = {
    events = stats.eventCount, sessions = stats.sessionCount, deaths = stats.totals.deaths, quests = stats.totals.questsCompleted,
    discoveries = stats.totals.discoveries, loot = stats.totals.notableLoot,
  }
  model.awards = stats.awards

  local events = UI:BuildTimeline({ filter = "All", search = "", fromTime = 0, toTime = Addon:Now() + 86400 })
  for index = 1, math.min(8, #events) do
    local event = events[index]
    local kind, color = Theme:DescribeType(event.type)
    local stamp = date and date("%d %b %H:%M", event.occurredAt) or tostring(event.occurredAt)
    table.insert(model.recent, { kind = kind, color = color, text = UI.EventLabel(event), time = stamp, event = event })
  end

  local status = AS and AS.status
  model.status = {
    statistics = status and status.state or "not scanned", statCount = status and status.statCount or 0,
    events = #Addon.db.events,
  }
  local character = Addon.character or {}
  model.character = { name = character.name or "adventurer", realm = character.realm, level = safe(UnitLevel, "player"), zone = safe(GetZoneText) }
  return model
end

local function createCard(parent, title)
  local T = Addon.Theme; local C = T.colors
  local card = CreateFrame("Frame", nil, parent, "BackdropTemplate")
  T:Panel(card, C.panel, C.border)
  card.title = card:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  safeMethod(card.title, "SetPoint", "TOPLEFT", card, "TOPLEFT", 12, -10); safeMethod(card.title, "SetText", title); safeMethod(card.title, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
  return card
end

function Dashboard:Create(parent, ui)
  local T = Addon.Theme; local C = T.colors
  local frame = CreateFrame("Frame", nil, parent)
  safeMethod(frame, "SetPoint", "TOPLEFT", parent, "TOPLEFT", SIDE, -84)
  safeMethod(frame, "SetPoint", "BOTTOMRIGHT", parent, "BOTTOMRIGHT", -SIDE, FOOTER + 4)
  safeMethod(frame, "Hide")
  self.frame, self.ui = frame, ui

  self.greeting = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
  safeMethod(self.greeting, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 2, -2); safeMethod(self.greeting, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
  self.subtitle = frame:CreateFontString(nil, "OVERLAY", "GameFontDisable")
  safeMethod(self.subtitle, "SetPoint", "TOPLEFT", self.greeting, "BOTTOMLEFT", 0, -4)

  self.tileFrames = {}
  for index in ipairs(tileDefinitions) do
    local tile = CreateFrame("Frame", nil, frame, "BackdropTemplate")
    T:Panel(tile, C.panel, C.border)
    tile.value = tile:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    safeMethod(tile.value, "SetPoint", "TOPLEFT", tile, "TOPLEFT", 10, -8); safeMethod(tile.value, "SetTextColor", C.text[1], C.text[2], C.text[3], 1); safeMethod(tile.value, "SetTextHeight", 22)
    tile.label = tile:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
    safeMethod(tile.label, "SetPoint", "BOTTOMLEFT", tile, "BOTTOMLEFT", 10, 8)
    tile.delta = tile:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    safeMethod(tile.delta, "SetPoint", "BOTTOMRIGHT", tile, "BOTTOMRIGHT", -10, 8); safeMethod(tile.delta, "SetTextColor", T.kindColors.world[1], T.kindColors.world[2], T.kindColors.world[3], 1)
    self.tileFrames[index] = tile
  end

  self.monthCard = createCard(frame, "This month")
  self.monthBody = self.monthCard:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  safeMethod(self.monthBody, "SetPoint", "TOPLEFT", self.monthCard, "TOPLEFT", 12, -34); safeMethod(self.monthBody, "SetJustifyH", "LEFT"); safeMethod(self.monthBody, "SetJustifyV", "TOP"); safeMethod(self.monthBody, "SetSpacing", 4)

  self.recentCard = createCard(frame, "Recent activity")
  local viewAll = T:Button(self.recentCard, "View all", 70, 20)
  safeMethod(viewAll, "SetPoint", "TOPRIGHT", self.recentCard, "TOPRIGHT", -8, -7)
  safeMethod(viewAll, "SetScript", "OnClick", function() if self.ui then self.ui:SetActiveTab("Chronicle") end end)
  self.viewAllButton = viewAll
  self.recentRows = {}
  for index = 1, 8 do
    local row = self.recentCard:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    safeMethod(row, "SetPoint", "TOPLEFT", self.recentCard, "TOPLEFT", 12, -34 - (index - 1) * 16)
    safeMethod(row, "SetPoint", "RIGHT", self.recentCard, "RIGHT", -12, 0)
    safeMethod(row, "SetJustifyH", "LEFT"); safeMethod(row, "SetWordWrap", false)
    self.recentRows[index] = row
  end
  self.recentEmpty = self.recentCard:CreateFontString(nil, "OVERLAY", "GameFontDisable")
  safeMethod(self.recentEmpty, "SetPoint", "TOPLEFT", self.recentCard, "TOPLEFT", 12, -34); safeMethod(self.recentEmpty, "SetText", "Nothing yet. Explore, quest, or add a memory below.")

  local box = CreateFrame("EditBox", nil, frame, "BackdropTemplate")
  safeMethod(box, "SetHeight", 28); safeMethod(box, "SetAutoFocus", false); safeMethod(box, "SetMaxLetters", 200)
  T:Input(box)
  self.memoryBox = box
  self.memoryHint = box:CreateFontString(nil, "OVERLAY", "GameFontDisable")
  safeMethod(self.memoryHint, "SetPoint", "LEFT", box, "LEFT", 9, 0); safeMethod(self.memoryHint, "SetText", "Remember this moment... (pinned to your Chronicle)")
  safeMethod(box, "SetScript", "OnTextChanged", function(edit) safeMethod(self.memoryHint, (edit.GetText and edit:GetText() or "") == "" and "Show" or "Hide") end)
  local remember = T:Button(frame, "Remember", 100, 28)
  self.memoryButton = remember
  local function submit()
    local text = (box.GetText and box:GetText() or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if text == "" then Addon:Print("Type something to remember first."); return end
    Addon.UI:HandleSlash("remember " .. text)
    safeMethod(box, "SetText", ""); safeMethod(box, "ClearFocus")
    self:Refresh()
  end
  safeMethod(remember, "SetScript", "OnClick", submit)
  safeMethod(box, "SetScript", "OnEnterPressed", submit)
  return self
end

function Dashboard:Layout(width, height)
  if not self.frame then return 1 end
  width = math.max(300, tonumber(width) or 700); height = math.max(200, tonumber(height) or 400)
  local columns = width >= 700 and 2 or 1
  local perRow = width >= 700 and 3 or 2
  local tileWidth = (width - GAP * (perRow - 1)) / perRow
  local tileHeight = 58
  for index, tile in ipairs(self.tileFrames) do
    local row, column = math.floor((index - 1) / perRow), (index - 1) % perRow
    safeMethod(tile, "SetSize", tileWidth, tileHeight); safeMethod(tile, "ClearAllPoints")
    safeMethod(tile, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", column * (tileWidth + GAP), -(48 + row * (tileHeight + GAP)))
  end
  local tilesBottom = 48 + math.ceil(#self.tileFrames / perRow) * (tileHeight + GAP)
  local memoryHeight = 28
  safeMethod(self.memoryBox, "ClearAllPoints"); safeMethod(self.memoryBox, "SetPoint", "BOTTOMLEFT", self.frame, "BOTTOMLEFT", 0, 0); safeMethod(self.memoryBox, "SetWidth", math.max(120, width - 100 - GAP))
  safeMethod(self.memoryButton, "ClearAllPoints"); safeMethod(self.memoryButton, "SetPoint", "BOTTOMRIGHT", self.frame, "BOTTOMRIGHT", 0, 0)
  local cardsHeight = math.max(120, height - tilesBottom - memoryHeight - GAP)
  local monthWidth, recentWidth, monthHeight, recentHeight
  safeMethod(self.monthCard, "ClearAllPoints"); safeMethod(self.recentCard, "ClearAllPoints")
  if columns == 2 then
    monthWidth = (width - GAP) / 2; recentWidth = monthWidth; monthHeight, recentHeight = cardsHeight, cardsHeight
    safeMethod(self.monthCard, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", 0, -tilesBottom)
    safeMethod(self.recentCard, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", monthWidth + GAP, -tilesBottom)
  else
    monthWidth, recentWidth = width, width
    monthHeight = math.max(70, math.floor(cardsHeight * 0.4)); recentHeight = math.max(70, cardsHeight - monthHeight - GAP)
    safeMethod(self.monthCard, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", 0, -tilesBottom)
    safeMethod(self.recentCard, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", 0, -(tilesBottom + monthHeight + GAP))
  end
  safeMethod(self.monthCard, "SetSize", monthWidth, monthHeight); safeMethod(self.recentCard, "SetSize", recentWidth, recentHeight)
  safeMethod(self.monthBody, "SetWidth", monthWidth - 24)
  self.recentSlots = math.max(1, math.min(#self.recentRows, math.floor((recentHeight - 40) / 16)))
  self.columns = columns
  return columns
end

function Dashboard:Refresh()
  if not self.frame then return end
  local T = Addon.Theme; local C = T.colors
  local model = self:Build()
  safeMethod(self.greeting, "SetText", "Welcome back, " .. tostring(model.character.name))
  local parts = {}
  if model.character.realm then table.insert(parts, tostring(model.character.realm)) end
  if model.character.level then table.insert(parts, "Level " .. tostring(model.character.level)) end
  if model.character.zone and model.character.zone ~= "" then table.insert(parts, tostring(model.character.zone)) end
  safeMethod(self.subtitle, "SetText", table.concat(parts, "  \194\183  "))
  for index, tile in ipairs(self.tileFrames) do
    local data = model.tiles[index]
    safeMethod(tile.value, "SetText", data.value); safeMethod(tile.label, "SetText", data.label)
    safeMethod(tile.delta, "SetText", data.delta and ("+" .. tostring(data.delta) .. " this month") or "")
  end
  local month = model.month
  local lines = {
    tostring(month.events) .. " events in " .. tostring(month.sessions) .. " sessions",
    "Deaths " .. tostring(month.deaths) .. "   Quests " .. tostring(month.quests) .. "   Discoveries " .. tostring(month.discoveries) .. "   Loot " .. tostring(month.loot),
  }
  for _, award in ipairs(model.awards) do table.insert(lines, T:Colorize(award.name, C.gold) .. " " .. tostring(award.count)) end
  local statistics = model.status.statistics == "ok" and (tostring(model.status.statCount) .. " lifetime statistics tracked") or ("Statistics: " .. tostring(model.status.statistics))
  table.insert(lines, T:Colorize(statistics, C.muted))
  table.insert(lines, T:Colorize("Guild sharing: not available yet", C.muted))
  safeMethod(self.monthBody, "SetText", table.concat(lines, "\n"))
  local slots = self.recentSlots or 6
  for index, row in ipairs(self.recentRows) do
    local entry = model.recent[index]
    if entry and index <= slots then
      safeMethod(row, "SetText", T:Colorize(entry.time, C.muted) .. "  " .. T:Colorize(entry.kind, entry.color) .. "  " .. escapeText(entry.text)); safeMethod(row, "Show")
    else safeMethod(row, "SetText", ""); safeMethod(row, "Hide") end
  end
  safeMethod(self.recentEmpty, #model.recent == 0 and "Show" or "Hide")
end

function Dashboard:Show() safeMethod(self.frame, "Show") end
function Dashboard:Hide() safeMethod(self.frame, "Hide") end
