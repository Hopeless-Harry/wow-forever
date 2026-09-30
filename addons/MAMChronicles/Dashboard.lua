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
  { label = "Delves completed", patterns = { "delves completed" }, client = "retail" },
  { label = "Campfires lit", counter = "campfires", client = "forever" },
}

-- Tiles that do not exist on this client (Delves on Forever, campfires on Retail) are left out.
local function visibleTiles()
  local client = Addon.Medals and Addon.Medals:Client() or "retail"
  local list = {}
  for _, definition in ipairs(tileDefinitions) do
    if not definition.client or definition.client == client then list[#list + 1] = definition end
  end
  return list
end

local startText = "Type /mam (or click the minimap button) to open this window.\n"
  .. "Medals tab: Mom Medals you earn, worth Mom Money. Settings tab: themes, alerts and what is recorded.\n"
  .. "Shared with your guild: only a medal's id, its points and the addon version when you earn one. Never chat, gold or locations.\n"
  .. "To opt out: Settings > Alerts > untick \"Announce my Mom Medals to the guild\"."

local function safeMethod(object, method, ...)
  if object and type(object[method]) == "function" then return pcall(object[method], object, ...) end
end
local function safe(fn, ...) return Addon:SafeCall(fn, ...) end
local function escapeText(text) return (tostring(text or ""):gsub("|", "||")) end

function Dashboard:FindStatistic(patterns)
  if not Addon.AchievementStats then return nil end
  return Addon.AchievementStats:FindValue(patterns, Addon.characterKey)
end

function Dashboard:Build()
  local AS, UI, Theme = Addon.AchievementStats, Addon.UI, Addon.Theme
  local model = { tiles = {}, month = {}, recent = {}, awards = {}, status = {}, character = {} }

  local changes = {}
  if AS then
    for _, change in ipairs(AS:GetTopChanges(Addon.characterKey, 1000)) do changes[change.id] = change.delta end
  end
  local catalog = Addon.db.statisticCatalog or {}
  for _, definition in ipairs(visibleTiles()) do
    local id, value
    if definition.counter then
      local row = Addon.db.counters and Addon.db.counters[Addon.characterKey]
      value = type(row) == "table" and tonumber(row[definition.counter]) or 0
    else id, value = self:FindStatistic(definition.patterns) end
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

  model.gettingStarted = not Addon.db.settings.gettingStartedDismissed
  model.whatsNew = Addon:GetWhatsNew()
  model.medals = Addon.Medals and Addon.Medals:GetSummary() or { total = 0, count = 0, possible = 0 }
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
  card.title = Addon.Theme:Text(card, "GameFontNormal")
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

  self.greeting = Addon.Theme:Text(frame, "GameFontNormalLarge")
  safeMethod(self.greeting, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 2, -2); safeMethod(self.greeting, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
  self.subtitle = Addon.Theme:Text(frame, "GameFontDisable")
  safeMethod(self.subtitle, "SetPoint", "TOPLEFT", self.greeting, "BOTTOMLEFT", 0, -4)

  self.startCard = createCard(frame, "Getting started")
  self.startBody = Addon.Theme:Text(self.startCard, "GameFontHighlight")
  safeMethod(self.startBody, "SetPoint", "TOPLEFT", self.startCard, "TOPLEFT", 12, -32); safeMethod(self.startBody, "SetJustifyH", "LEFT"); safeMethod(self.startBody, "SetJustifyV", "TOP"); safeMethod(self.startBody, "SetSpacing", 3)
  safeMethod(self.startBody, "SetText", startText)
  self.startDismiss = T:Button(self.startCard, "Got it", 70, 20)
  safeMethod(self.startDismiss, "SetPoint", "TOPRIGHT", self.startCard, "TOPRIGHT", -8, -7)
  safeMethod(self.startDismiss, "SetScript", "OnClick", function() Addon.db.settings.gettingStartedDismissed = true; self:Refresh() end)
  safeMethod(self.startCard, "Hide")
  self.newsLine = Addon.Theme:Text(frame, "GameFontNormalSmall")
  safeMethod(self.newsLine, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 2, -48); safeMethod(self.newsLine, "SetJustifyH", "LEFT"); safeMethod(self.newsLine, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1); safeMethod(self.newsLine, "Hide")
  self.newsDismiss = T:Button(frame, "x", 20, 18)
  safeMethod(self.newsDismiss, "SetScript", "OnClick", function() Addon:DismissWhatsNew(); self:Refresh() end)
  safeMethod(self.newsDismiss, "Hide")

  self.tileFrames = {}
  for index in ipairs(visibleTiles()) do
    local tile = CreateFrame("Frame", nil, frame, "BackdropTemplate")
    T:Panel(tile, C.panel, C.border)
    tile.value = Addon.Theme:Text(tile, "GameFontNormalHuge")
    safeMethod(tile.value, "SetPoint", "TOPLEFT", tile, "TOPLEFT", 10, -8); safeMethod(tile.value, "SetTextColor", C.text[1], C.text[2], C.text[3], 1)
    tile.label = Addon.Theme:Text(tile, "GameFontDisableSmall")
    safeMethod(tile.label, "SetPoint", "BOTTOMLEFT", tile, "BOTTOMLEFT", 10, 8)
    tile.delta = Addon.Theme:Text(tile, "GameFontNormalSmall")
    safeMethod(tile.delta, "SetPoint", "BOTTOMRIGHT", tile, "BOTTOMRIGHT", -10, 8); safeMethod(tile.delta, "SetTextColor", T.kindColors.world[1], T.kindColors.world[2], T.kindColors.world[3], 1)
    self.tileFrames[index] = tile
  end

  self.monthCard = createCard(frame, "This month")
  self.monthBody = Addon.Theme:Text(self.monthCard, "GameFontHighlight")
  safeMethod(self.monthBody, "SetPoint", "TOPLEFT", self.monthCard, "TOPLEFT", 12, -34); safeMethod(self.monthBody, "SetJustifyH", "LEFT"); safeMethod(self.monthBody, "SetJustifyV", "TOP"); safeMethod(self.monthBody, "SetSpacing", 4)

  self.recapButton = T:Button(self.monthCard, "Copy recap", 90, 20)
  safeMethod(self.recapButton, "SetPoint", "TOPRIGHT", self.monthCard, "TOPRIGHT", -8, -7)
  self.bookButton = T:Button(self.monthCard, "Memory Book", 100, 20)
  safeMethod(self.bookButton, "SetPoint", "RIGHT", self.recapButton, "LEFT", -6, 0)
  safeMethod(self.bookButton, "SetScript", "OnClick", function() if self.ui then self.ui:HandleSlash("book") end end)
  safeMethod(self.recapButton, "SetScript", "OnClick", function() if self.ui then self.ui:HandleSlash("recap") end end)

  self.recentCard = createCard(frame, "Recent activity")
  local viewAll = T:Button(self.recentCard, "View all", 70, 20)
  safeMethod(viewAll, "SetPoint", "TOPRIGHT", self.recentCard, "TOPRIGHT", -8, -7)
  safeMethod(viewAll, "SetScript", "OnClick", function() if self.ui then self.ui:SetActiveTab("Chronicle") end end)
  self.viewAllButton = viewAll
  self.recentRows = {}
  for index = 1, 8 do
    local row = Addon.Theme:Text(self.recentCard, "GameFontHighlightSmall")
    safeMethod(row, "SetPoint", "TOPLEFT", self.recentCard, "TOPLEFT", 12, -34 - (index - 1) * 16)
    safeMethod(row, "SetPoint", "RIGHT", self.recentCard, "RIGHT", -12, 0)
    safeMethod(row, "SetJustifyH", "LEFT"); safeMethod(row, "SetWordWrap", false)
    self.recentRows[index] = row
  end
  self.recentEmpty = Addon.Theme:Text(self.recentCard, "GameFontDisable")
  safeMethod(self.recentEmpty, "SetPoint", "TOPLEFT", self.recentCard, "TOPLEFT", 12, -34); safeMethod(self.recentEmpty, "SetText", "Nothing yet. Explore, quest, or add a memory below.")

  local box = CreateFrame("EditBox", nil, frame, "BackdropTemplate")
  safeMethod(box, "SetHeight", 28); safeMethod(box, "SetAutoFocus", false); safeMethod(box, "SetMaxLetters", 200)
  T:Input(box)
  self.memoryBox = box
  self.memoryHint = Addon.Theme:Text(box, "GameFontDisable")
  safeMethod(self.memoryHint, "SetPoint", "LEFT", box, "LEFT", 9, 0); safeMethod(self.memoryHint, "SetText", "Remember this moment... (pinned to your Chronicle)")
  safeMethod(box, "SetScript", "OnTextChanged", function(edit) safeMethod(self.memoryHint, (edit.GetText and edit:GetText() or "") == "" and "Show" or "Hide") end)
  local remember = T:Button(frame, "Remember", 100, 28, { red = true })
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
  self.lastWidth, self.lastHeight = width, height
  width = math.max(300, tonumber(width) or 700); height = math.max(200, tonumber(height) or 400)
  local columns = width >= 700 and 2 or 1
  local perRow = width >= 700 and 3 or 2
  local tileWidth = (width - GAP * (perRow - 1)) / perRow
  local tileHeight = 58
  for _, tile in ipairs(self.tileFrames) do safeMethod(tile, "SetSize", tileWidth, tileHeight) end
  local top = 48
  local startHeight = columns == 2 and 112 or 150
  safeMethod(self.startCard, "ClearAllPoints")
  if self.showStart then
    safeMethod(self.startCard, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", 0, -top); safeMethod(self.startCard, "SetSize", width, startHeight)
    safeMethod(self.startBody, "SetWidth", width - 24); top = top + startHeight + GAP
  end
  if self.showNews then
    safeMethod(self.newsLine, "ClearAllPoints"); safeMethod(self.newsLine, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", 2, -(top + 2))
    safeMethod(self.newsLine, "SetWidth", width - 34)
    safeMethod(self.newsDismiss, "ClearAllPoints"); safeMethod(self.newsDismiss, "SetPoint", "TOPRIGHT", self.frame, "TOPRIGHT", 0, -top)
    top = top + 24
  end
  for index, tile in ipairs(self.tileFrames) do
    local row, column = math.floor((index - 1) / perRow), (index - 1) % perRow
    safeMethod(tile, "ClearAllPoints")
    safeMethod(tile, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", column * (tileWidth + GAP), -(top + row * (tileHeight + GAP)))
  end
  local tilesBottom = top + math.ceil(#self.tileFrames / perRow) * (tileHeight + GAP)
  local memoryHeight = 28
  safeMethod(self.memoryBox, "ClearAllPoints"); safeMethod(self.memoryBox, "SetPoint", "BOTTOMLEFT", self.frame, "BOTTOMLEFT", 0, 0); safeMethod(self.memoryBox, "SetWidth", math.max(120, width - 100 - GAP))
  safeMethod(self.memoryButton, "ClearAllPoints"); safeMethod(self.memoryButton, "SetPoint", "BOTTOMRIGHT", self.frame, "BOTTOMRIGHT", 0, 0)
  local cardsHeight = math.max(70, height - tilesBottom - memoryHeight - GAP)
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
  local showStart, showNews = model.gettingStarted and true or false, model.whatsNew ~= nil
  safeMethod(self.startCard, showStart and "Show" or "Hide")
  if model.whatsNew then safeMethod(self.newsLine, "SetText", escapeText(model.whatsNew)) end
  safeMethod(self.newsLine, showNews and "Show" or "Hide"); safeMethod(self.newsDismiss, showNews and "Show" or "Hide")
  if showStart ~= self.showStart or showNews ~= self.showNews then
    self.showStart, self.showNews = showStart, showNews
    self:Layout(self.lastWidth, self.lastHeight)
  end
  safeMethod(self.greeting, "SetText", "Welcome back, " .. tostring(model.character.name))
  local parts = {}
  if model.character.realm then table.insert(parts, tostring(model.character.realm)) end
  if model.character.level then table.insert(parts, "Level " .. tostring(model.character.level)) end
  if model.character.zone and model.character.zone ~= "" then table.insert(parts, tostring(model.character.zone)) end
  if Addon.Medals then table.insert(parts, Addon.Medals:GetTitle()) end
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
  table.insert(lines, T:Colorize("Mom Money " .. tostring(model.medals.total), C.gold) .. "  \194\183  " .. tostring(model.medals.count) .. " of " .. tostring(model.medals.possible) .. " medals")
  local since = Addon.Statistics:DescribeSinceLastLogin(Addon.Statistics:BuildSinceLastLogin())
  if since then table.insert(lines, 1, T:Colorize(escapeText(since), C.muted)) end
  if Addon.Medals then
    local week, questLines = Addon.Medals:DescribeQuests()
    if #questLines > 0 then
      table.insert(lines, T:Colorize("Week " .. tostring(week) .. " Mom Quests", C.gold))
      for _, questLine in ipairs(questLines) do table.insert(lines, "  " .. escapeText(questLine)) end
    end
  end
  local goals = Addon.Medals and Addon.Medals:GetGoals() or {}
  if #goals == 0 then
    table.insert(lines, T:Colorize("Pin up to 3 medals as goals on the Medals tab (click a medal).", C.muted))
  else
    for _, goal in ipairs(goals) do
      table.insert(lines, T:Colorize("Goal: " .. escapeText(goal.def.name), C.gold) .. "  " .. tostring(math.floor(math.min(goal.current, goal.target))) .. " / " .. tostring(goal.target))
    end
  end
  for _, award in ipairs(model.awards) do table.insert(lines, T:Colorize(award.name, C.gold) .. " " .. tostring(award.count)) end
  local statistics = model.status.statistics == "ok" and (tostring(model.status.statCount) .. " lifetime statistics tracked")
    or (model.status.statistics == "unavailable" and "Statistics: not reported by this client" or ("Statistics: " .. tostring(model.status.statistics)))
  table.insert(lines, T:Colorize(statistics, C.muted))
  local sharing = Addon.Comms and Addon.Comms.status
  table.insert(lines, T:Colorize("Guild sharing: " .. tostring(sharing and sharing.state or "off"), C.muted))
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
