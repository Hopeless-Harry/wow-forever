local Addon = MAMChronicles
Addon.Database = Addon.Database or {}
local Database = Addon.Database

local SESSIONS_MAX = 500
local function now() return Addon:Now() end
local function tableOr(value) return type(value) == "table" and value or {} end
local function copyTable(value)
  local result = {}
  for key, item in pairs(value or {}) do result[key] = type(item) == "table" and copyTable(item) or item end
  return result
end
local function finite(value) return type(value) == "number" and value == value and value ~= math.huge and value ~= -math.huge end
local function clamp(value, minimum, maximum) return math.max(minimum, math.min(maximum, value)) end
local uiDefaults = { point="CENTER", x=0, y=0, width=920, height=640, activeTab="Home", minimapAngle=225 }
local validPoints = { CENTER=true, TOP=true, BOTTOM=true, LEFT=true, RIGHT=true, TOPLEFT=true, TOPRIGHT=true, BOTTOMLEFT=true, BOTTOMRIGHT=true }
local validThemes = { modern=true, midnight=true, parchment=true, crimson=true, slate=true }
local booleanDefaults = { toastsEnabled=true, toastSound=false, announceMedals=true, announceGuildChat=false, receiveGuildAlerts=true, gettingStartedDismissed=false, quietInstances=true, animations=true, shareLocation=true, showGuildMap=true, gatewayMode=false, trackerEnabled=true, trackerQuests=true, trackerLocked=false, tutorialSeen=false, simpleView=false }
-- Settings migrations run once each, in order. Add a new function and raise SETTINGS_VERSION instead of adding another one-off flag.
local SETTINGS_VERSION = 3
local settingsMigrations = {
  -- 1: the old default theme (Midnight) moves to the Modern art theme; choosing Midnight again afterwards sticks.
  [1] = function(settings) if settings.theme == "midnight" then settings.theme = "modern" end end,
  -- 2: the short tab bar is the default for everyone; the other pages stay one click away under "More".
  [2] = function(settings) settings.simpleView = true end,
  -- 3: the window was small on big monitors. Anyone still on the old default size gets the new default, and the whole window
  -- is scaled up a little on very high resolution screens. Sizes a player chose themselves are left alone.
  [3] = function(settings)
    local ui = type(settings.ui) == "table" and settings.ui or {}
    if (tonumber(ui.width) or 780) <= 780 and (tonumber(ui.height) or 560) <= 560 then ui.width, ui.height = 920, 640 end
    settings.ui = ui
    if tonumber(settings.windowScale) == nil or settings.windowScale == 1 then
      local height = 0
      if type(GetPhysicalScreenSize) == "function" then
        local ok, _, physicalHeight = pcall(GetPhysicalScreenSize)
        height = ok and tonumber(physicalHeight) or 0
      end
      if height >= 2000 then settings.windowScale = 1.25 elseif height >= 1400 then settings.windowScale = 1.1 end
    end
  end,
}
local validTabs = { Home=true, Chronicle=true, Medals=true, Statistics=true, Characters=true, Map=true, Guild=true, Settings=true, Diagnostics=true }
local function freshSettings()
  return { enabled=true, recordCoordinates=true, recordQuestAccepts=true, notableQuality=4, maxEvents=10000, showMinimapButton=true, recordStatistics=true, recordGoldStatistics=false,
    windowAlpha=1, theme="modern", toastsEnabled=true, toastSound=false, announceMedals=true, announceGuildChat=false, receiveGuildAlerts=true, pinnedMedals={}, toastSoundChoice="chime", ui=copyTable(uiDefaults) }
end
local function monthKey(timestamp)
  local dateFn=date or (os and os.date); return dateFn and dateFn("%Y-%m",timestamp) or "unknown"
end

function Database:Fresh(reason)
  local timestamp = now()
  local db = {
    schemaVersion = 1,
    meta = { createdAt = timestamp, updatedAt = timestamp, loadCount = 0, addonVersion = Addon.version, clientBuild = select(2, Addon:SafeCall(GetBuildInfo)) },
    settings = freshSettings(),
    characters = {}, sessions = {}, events = {}, eventIds = {}, questCompletion = {}, professionSnapshots = {}, aggregates = {}, diagnostics = {}, statistics = {}, statisticCatalog = {}, medals = {}, guildFeed = {}, guildRoster = {}, discoveries = {}, counters = {}, medalTallies = {}, challenges = {}, emoteTargets = {},
  }
  if reason then db.diagnostics.recovery = { recoveredAt = timestamp, reason = reason } end
  db.settings.simpleView = true
  return db
end

-- Places a character has already been to. A "discovery" is the first visit to a zone/subzone, never a return.
local MAX_DISCOVERIES = 5000
local function discoveryKey(payload)
  payload = type(payload) == "table" and payload or {}
  local map = tonumber(payload.mapID)
  return (map and string.format("%d", map) or "") .. "|" .. string.lower(tostring(payload.zone or "")) .. "|" .. string.lower(tostring(payload.subzone or ""))
end
Database.DiscoveryKey = discoveryKey

-- True when this place was not known yet (and is now remembered).
function Database:MarkDiscovered(characterKey, key)
  local database = self.db
  if not (database and characterKey and key) then return false end
  database.discoveries = tableOr(database.discoveries)
  local known = database.discoveries[characterKey]
  if type(known) ~= "table" then known = { count = 0 }; database.discoveries[characterKey] = known end
  if known[key] then return false end
  if (tonumber(known.count) or 0) >= MAX_DISCOVERIES then return false end
  known[key] = true
  known.count = (tonumber(known.count) or 0) + 1
  return true
end

-- One-time clean-up of builds that logged every zone-change as a discovery: keeps the first visit per character and place,
-- remembers those places, and takes the repeats off the Explorer tally.
function Database:DedupeDiscoveries(db)
  db.meta = tableOr(db.meta)
  if db.meta.discoveriesDeduped == true then return 0 end
  local seen, kept, removed = {}, {}, {}
  local total = 0
  db.discoveries = tableOr(db.discoveries)
  for _, event in ipairs(db.events or {}) do
    if event.type == "world.zone_discovered" then
      local character = tostring(event.characterKey or "unknown")
      local key = character .. "#" .. discoveryKey(event.payload)
      if seen[key] then
        removed[character] = (removed[character] or 0) + 1; total = total + 1
      else
        seen[key] = true
        local known = db.discoveries[character]
        if type(known) ~= "table" then known = { count = 0 }; db.discoveries[character] = known end
        local place = discoveryKey(event.payload)
        if not known[place] then known[place] = true; known.count = (tonumber(known.count) or 0) + 1 end
        kept[#kept + 1] = event
      end
    else
      kept[#kept + 1] = event
    end
  end
  if total > 0 then
    db.events = kept
    for character, count in pairs(removed) do
      local tally = db.medalTallies and db.medalTallies[character]
      if type(tally) == "table" then
        tally["world.zone_discovered"] = math.max(0, (tonumber(tally["world.zone_discovered"]) or 0) - count)
        tally.total = math.max(0, (tonumber(tally.total) or 0) - count)
      end
    end
    db.diagnostics = tableOr(db.diagnostics)
    db.diagnostics.discoveryCleanup = { removed = total, at = now() }
  end
  db.meta.discoveriesDeduped = true
  return total
end

-- One-time clean-up of builds that counted every /reload as a logout and a login. A logout followed by a login within
-- RELOAD_GAP seconds is far quicker than a real log out and back in (character select alone takes longer), so both are
-- removed and the two sessions are joined into one.
local RELOAD_GAP = 45
function Database:DedupeSessions(db)
  db.meta = tableOr(db.meta)
  if db.meta.sessionsDeduped == true then return 0 end
  local events, drop, removed = db.events or {}, {}, {}
  local total = 0
  local lastLogout = {}
  for index, event in ipairs(events) do
    local character = tostring(event.characterKey or "unknown")
    if event.type == "session.logout" then
      lastLogout[character] = index
    elseif event.type == "session.login" and lastLogout[character] then
      local out = events[lastLogout[character]]
      if tonumber(event.occurredAt) and tonumber(out.occurredAt) and event.occurredAt - out.occurredAt >= 0 and event.occurredAt - out.occurredAt <= RELOAD_GAP then
        drop[lastLogout[character]] = true; drop[index] = true
        removed[character] = (removed[character] or 0) + 1; total = total + 1
      end
      lastLogout[character] = nil
    end
  end
  if total > 0 then
    local kept = {}
    for index, event in ipairs(events) do if not drop[index] then kept[#kept + 1] = event end end
    db.events = kept
    for character, count in pairs(removed) do
      local tally = db.medalTallies and db.medalTallies[character]
      if type(tally) == "table" then
        tally["session.login"] = math.max(0, (tonumber(tally["session.login"]) or 0) - count)
        tally["session.logout"] = math.max(0, (tonumber(tally["session.logout"]) or 0) - count)
        tally.total = math.max(0, (tonumber(tally.total) or 0) - 2 * count)
      end
    end
    -- join the matching sessions
    local joined, lastByCharacter = {}, {}
    for _, session in ipairs(db.sessions or {}) do
      local previous = lastByCharacter[session.characterKey]
      if previous and tonumber(previous.endedAt) and tonumber(session.startedAt) and session.startedAt - previous.endedAt >= 0 and session.startedAt - previous.endedAt <= RELOAD_GAP then
        previous.endedAt = session.endedAt
      else
        joined[#joined + 1] = session; lastByCharacter[session.characterKey] = session
      end
    end
    db.sessions = joined
    db.diagnostics = tableOr(db.diagnostics)
    db.diagnostics.reloadCleanup = { removed = total, at = now() }
  end
  db.meta.sessionsDeduped = true
  return total
end

function Database:Open(saved)
  local reason
  local droppedEvents=0
  if type(saved) ~= "table" then if saved~=nil then reason="corrupt root" end
  elseif saved.schemaVersion ~= 1 then reason = "unsupported schema" end
  if not reason and type(saved)=="table" then
    for _,key in ipairs({"meta","settings","characters","sessions","events","eventIds","questCompletion","professionSnapshots","aggregates","diagnostics","statistics","statisticCatalog","medals","guildFeed","guildRoster","discoveries","counters","medalTallies","challenges","emoteTargets"}) do
      if saved[key]~=nil and type(saved[key])~="table" then reason="corrupt root"; break end
    end
    if not reason and type(saved.events)=="table" then
      -- Keep every valid event and drop only the broken ones, so one bad record cannot erase the history.
      local seen,kept={},{}
      for _,event in ipairs(saved.events) do
        local valid=type(event)=="table" and event.schemaVersion==1 and type(event.id)=="string" and #event.id>0 and not seen[event.id] and type(event.type)=="string" and type(event.occurredAt)=="number" and event.occurredAt==event.occurredAt and type(event.observedAt)=="number" and event.observedAt==event.observedAt and type(event.payload)=="table"
        if valid then seen[event.id]=true; table.insert(kept,event) else droppedEvents=droppedEvents+1 end
      end
      if droppedEvents>0 then saved.events=kept end
    end
  end
  local db = reason and self:Fresh(reason) or (type(saved) == "table" and saved or self:Fresh())
  db.meta = tableOr(db.meta); db.settings = tableOr(db.settings)
  for _, key in ipairs({"characters","sessions","events","eventIds","questCompletion","professionSnapshots","aggregates","diagnostics","statistics","statisticCatalog","medals","guildFeed","guildRoster","discoveries","counters","medalTallies","challenges","emoteTargets"}) do db[key] = tableOr(db[key]) end
  self:DedupeDiscoveries(db)
  self:DedupeSessions(db)
  db.eventIds={}; for _,event in ipairs(db.events) do db.eventIds[event.id]=true end
  if droppedEvents>0 and not reason then db.diagnostics.recovery={recoveredAt=now(),reason="dropped "..droppedEvents.." invalid event"..(droppedEvents==1 and "" or "s")} end
  db.schemaVersion = 1; self.db = db; self:NormaliseSettings()
  db.meta.createdAt = db.meta.createdAt or now(); db.meta.updatedAt = now(); db.meta.loadCount = (tonumber(db.meta.loadCount) or 0) + 1
  local previousVersion = db.meta.addonVersion
  if type(previousVersion) == "string" and previousVersion ~= Addon.version then db.settings.whatsNewVersion = Addon.version end
  db.meta.addonVersion = Addon.version; db.meta.clientBuild = select(2, Addon:SafeCall(GetBuildInfo))
  return db
end


function Database:NormaliseSettings()
  local settings = tableOr(self.db and self.db.settings)
  local defaults = freshSettings()
  for key, value in pairs(defaults) do if key ~= "ui" and settings[key] == nil then settings[key] = value end end
  if type(settings.showMinimapButton) ~= "boolean" then settings.showMinimapButton = true end
  if type(settings.recordStatistics) ~= "boolean" then settings.recordStatistics = true end
  if type(settings.recordGoldStatistics) ~= "boolean" then settings.recordGoldStatistics = false end
  for key, default in pairs(booleanDefaults) do if type(settings[key]) ~= "boolean" then settings[key] = default end end
  if not finite(settings.windowAlpha) then settings.windowAlpha = 1 else settings.windowAlpha = clamp(settings.windowAlpha, 0.3, 1) end
  if type(settings.shareStats) ~= "boolean" then settings.shareStats = nil end
  if type(settings.shareForgetPending) ~= "boolean" then settings.shareForgetPending = nil end
  if not finite(settings.windowScale) then settings.windowScale = 1 else settings.windowScale = clamp(math.floor(settings.windowScale * 20 + 0.5) / 20, 0.7, 1.3) end
  if not validThemes[settings.theme] then settings.theme = "modern" end
  local version = tonumber(settings.settingsVersion) or (settings.themeMigrated and 1 or 0)
  for step = version + 1, SETTINGS_VERSION do
    if settingsMigrations[step] then settingsMigrations[step](settings) end
  end
  -- Never lower the stored version: a downgrade followed by an upgrade must not run migrations a second time.
  settings.settingsVersion = math.max(version, SETTINGS_VERSION)
  settings.themeMigrated = true
  if settings.welcomeVersion ~= nil and type(settings.welcomeVersion) ~= "string" then settings.welcomeVersion = nil end
  -- Cosmetics bought with Mom Money (account wide), and the chosen title.
  local known = Addon.Medals and Addon.Medals.cosmeticsById
  local cosmetics = type(settings.cosmetics) == "table" and settings.cosmetics or {}
  local unlocked = {}
  if type(cosmetics.unlocked) == "table" then
    for id, value in pairs(cosmetics.unlocked) do if value == true and type(id) == "string" and (not known or (known[id] and known[id].cost > 0)) then unlocked[id] = true end end
  end
  local function ownedKind(id, kind) return type(id) == "string" and known and known[id] and known[id].kind == kind and (known[id].cost == 0 or unlocked[id]) end
  settings.cosmetics = {
    unlocked = unlocked,
    toastStyle = ownedKind(cosmetics.toastStyle, "toastStyle") and cosmetics.toastStyle or "style_gold",
    flourish = ownedKind(cosmetics.flourish, "flourish") and cosmetics.flourish or "",
  }
  local titles = Addon.Medals and Addon.Medals.titles
  if type(settings.titleChoice) ~= "string" or (settings.titleChoice ~= "auto" and titles and not titles[settings.titleChoice]) then settings.titleChoice = "auto" end
  local players = {}
  if type(settings.pinnedPlayers) == "table" then
    local seenNames = {}
    for _, name in ipairs(settings.pinnedPlayers) do
      if type(name) == "string" and #name <= 24 and name:match("^[^%s%c|]+$") and not seenNames[name] and #players < 5 then seenNames[name] = true; table.insert(players, name) end
    end
  end
  settings.pinnedPlayers = players
  local seen, seenCount = {}, 0
  if type(settings.seasonsSeen) == "table" then
    for key, value in pairs(settings.seasonsSeen) do
      if type(key) == "string" and #key <= 30 and value == true and seenCount < 20 then seen[key] = true; seenCount = seenCount + 1 end
    end
  end
  settings.seasonsSeen = seen
  local soundKeys = Addon.Toast and Addon.Toast.soundKeys
  if type(settings.toastSoundChoice) ~= "string" or (soundKeys and not soundKeys[settings.toastSoundChoice]) then settings.toastSoundChoice = "chime" end
  -- Up to three pinned medal ids; anything else is discarded.
  local pins, seenPins = {}, {}
  if type(settings.pinnedMedals) == "table" then
    for _, id in ipairs(settings.pinnedMedals) do
      if type(id) == "string" and #id > 0 and #id <= 40 and not seenPins[id] and #pins < 6 then seenPins[id] = true; table.insert(pins, id) end
    end
  end
  settings.pinnedMedals = pins
  if type(settings.whatsNewVersion) ~= "string" then settings.whatsNewVersion = nil end
  if type(settings.whatsNewSeen) ~= "string" then settings.whatsNewSeen = nil end
  local saved = tableOr(settings.ui); local ui = copyTable(uiDefaults)
  if validPoints[saved.point] then ui.point = saved.point end
  if finite(saved.x) then ui.x = clamp(saved.x, -10000, 10000) end
  if finite(saved.y) then ui.y = clamp(saved.y, -10000, 10000) end
  if finite(saved.width) then ui.width = clamp(saved.width, 620, 1600) end
  if finite(saved.height) then ui.height = clamp(saved.height, 440, 1200) end
  if validTabs[saved.activeTab] then ui.activeTab = saved.activeTab end
  if finite(saved.minimapAngle) then ui.minimapAngle = ((saved.minimapAngle % 360) + 360) % 360 end
  local savedTracker = tableOr(settings.tracker)
  local tracker = { point = "TOPRIGHT", x = -220, y = -240 }
  if validPoints[savedTracker.point] then tracker.point = savedTracker.point; tracker.relPoint = validPoints[savedTracker.relPoint] and savedTracker.relPoint or tracker.point end
  if finite(savedTracker.x) then tracker.x = clamp(savedTracker.x, -10000, 10000) end
  if finite(savedTracker.y) then tracker.y = clamp(savedTracker.y, -10000, 10000) end
  settings.tracker = tracker
  settings.ui = ui; self.db.settings = settings
  return settings
end

function Database:ResetUIState()
  self.db.settings.ui = copyTable(uiDefaults)
  return self.db.settings.ui
end

function Database:ClearHistory()
  local character = Addon.character
  self.db.characters, self.db.sessions, self.db.events, self.db.eventIds = {}, {}, {}, {}
  self.db.questCompletion, self.db.professionSnapshots, self.db.aggregates = {}, {}, {}
  self.db.statistics, self.db.statisticCatalog = {}, {}
  self.db.medals, self.db.guildFeed, self.db.counters, self.db.medalTallies = {}, {}, {}, {}
  self.db.guildRoster = {}
  self.db.discoveries = {}
  self.db.challenges = {}
  self.db.emoteTargets = {}
  if Addon.Medals then Addon.Medals:Reset() end
  self.currentSession = nil; Addon.sessionId = nil
  if Addon.characterKey and character then self:RegisterCharacter(Addon.characterKey, character); self:BeginSession() end
  self.db.meta.updatedAt = now()
  if Addon.Medals then Addon:SafeCall(Addon.Medals.Evaluate, Addon.Medals, "erase") end
  return true
end

function Database:RegisterCharacter(key, character)
  local current = self.db.characters[key] or { firstSeenAt = now() }
  current.guid, current.name, current.realm, current.classID = character.guid, character.name, character.realm, character.classID
  if character.className then current.className = character.className end
  if character.level then current.level = character.level end
  current.lastSeenAt = now(); self.db.characters[key] = current
end

function Database:BeginSession()
  if self.currentSession then return self.currentSession end
  local session = { id = Addon.characterKey .. ":" .. tostring(now()) .. ":" .. tostring(#self.db.sessions + 1), characterKey = Addon.characterKey, startedAt = now() }
  table.insert(self.db.sessions, session); while #self.db.sessions > SESSIONS_MAX do table.remove(self.db.sessions, 1) end
  self.currentSession = session; Addon.sessionId = session.id; return session
end

-- A /reload (or any UI reload) is not a logout: the session carries on instead of a new one starting.
function Database:ResumeSession(sessionId)
  if not (self.db and sessionId) then return false end
  for index = #self.db.sessions, 1, -1 do
    local session = self.db.sessions[index]
    if session.id == sessionId and session.characterKey == Addon.characterKey then
      session.endedAt = nil
      self.currentSession = session; Addon.sessionId = session.id
      return true
    end
  end
  return false
end

function Database:EndSession()
  if self.currentSession then self.currentSession.endedAt = now(); self.currentSession = nil; Addon.sessionId = nil end
end

local function accumulateBucket(bucket,event)
  bucket.eventCount=(bucket.eventCount or 0)+1; bucket.byType=tableOr(bucket.byType); bucket.byZone=tableOr(bucket.byZone); bucket.signals=tableOr(bucket.signals)
  bucket.byType[event.type]=(bucket.byType[event.type] or 0)+1; bucket.firstAt=math.min(bucket.firstAt or event.occurredAt,event.occurredAt); bucket.lastAt=math.max(bucket.lastAt or event.occurredAt,event.occurredAt)
  local zone=event.payload and event.payload.zone; if zone then bucket.byZone[zone]=(bucket.byZone[zone] or 0)+1 end
  if event.type=="character.death" then local kind=string.lower(tostring(event.payload.deathKind or "")); if string.find(kind,"fall",1,true) then bucket.signals.falling=(bucket.signals.falling or 0)+1 end; local context=string.lower(tostring(event.payload.lastHostileTarget or "").." "..tostring(zone or "")); if string.find(context,"murloc",1,true) then bucket.signals.murloc=(bucket.signals.murloc or 0)+1 end end
  return bucket
end

function Database:Accumulate(event)
  local aggregates=self.db.aggregates; aggregates.byType=tableOr(aggregates.byType); aggregates.byZone=tableOr(aggregates.byZone); aggregates.monthly=tableOr(aggregates.monthly)
  aggregates.eventCount=(aggregates.eventCount or 0)+1; aggregates.byType[event.type]=(aggregates.byType[event.type] or 0)+1
  local zone=event.payload and event.payload.zone; if zone then aggregates.byZone[zone]=(aggregates.byZone[zone] or 0)+1 end
  local key=monthKey(event.occurredAt); local bucket=aggregates.monthly[key] or {eventCount=0,byType={},byZone={},signals={},byCharacter={}}
  accumulateBucket(bucket,event); bucket.byCharacter=tableOr(bucket.byCharacter); local characterKey=event.characterKey or "unknown"; bucket.byCharacter[characterKey]=accumulateBucket(bucket.byCharacter[characterKey] or {},event)
  aggregates.monthly[key]=bucket
end

function Database:Compact()
  local maxEvents = math.max(100, math.floor(tonumber(self.db.settings.maxEvents) or 10000))
  if tonumber(self.db.settings.maxEvents) and self.db.settings.maxEvents < 100 then maxEvents = math.floor(self.db.settings.maxEvents) end
  local pinned, ordinary = {}, {}
  for _, event in ipairs(self.db.events) do
    if event.pinned and event.type == "memory.manual" then table.insert(pinned, event) else table.insert(ordinary, event) end
  end
  local keepFrom = math.max(1, #ordinary - maxEvents + 1); local kept = {}
  for index=1,keepFrom-1 do self:Accumulate(ordinary[index]) end
  for _, event in ipairs(pinned) do table.insert(kept, event) end
  for index = keepFrom, #ordinary do table.insert(kept, ordinary[index]) end
  self.db.events, self.db.eventIds = kept, {}
  for _, event in ipairs(kept) do if event.id then self.db.eventIds[event.id] = true end end
  self.db.meta.updatedAt = now()
end
