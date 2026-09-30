local Addon = MAMChronicles
Addon.Database = Addon.Database or {}
local Database = Addon.Database

local function now() return Addon:Now() end
local function tableOr(value) return type(value) == "table" and value or {} end
local function copyTable(value)
  local result = {}
  for key, item in pairs(value or {}) do result[key] = type(item) == "table" and copyTable(item) or item end
  return result
end
local function finite(value) return type(value) == "number" and value == value and value ~= math.huge and value ~= -math.huge end
local function clamp(value, minimum, maximum) return math.max(minimum, math.min(maximum, value)) end
local uiDefaults = { point="CENTER", x=0, y=0, width=780, height=560, activeTab="Home", minimapAngle=225 }
local validPoints = { CENTER=true, TOP=true, BOTTOM=true, LEFT=true, RIGHT=true, TOPLEFT=true, TOPRIGHT=true, BOTTOMLEFT=true, BOTTOMRIGHT=true }
local validThemes = { midnight=true, parchment=true, crimson=true, slate=true }
local booleanDefaults = { toastsEnabled=true, toastSound=false, announceMedals=true, announceGuildChat=false, receiveGuildAlerts=true }
local validTabs = { Home=true, Chronicle=true, Medals=true, Statistics=true, Settings=true, Diagnostics=true }
local function freshSettings()
  return { enabled=true, recordCoordinates=true, recordQuestAccepts=true, notableQuality=4, maxEvents=10000, showMinimapButton=true, recordStatistics=true, recordGoldStatistics=false,
    windowAlpha=1, theme="midnight", toastsEnabled=true, toastSound=false, announceMedals=true, announceGuildChat=false, receiveGuildAlerts=true, ui=copyTable(uiDefaults) }
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
    characters = {}, sessions = {}, events = {}, eventIds = {}, questCompletion = {}, professionSnapshots = {}, aggregates = {}, diagnostics = {}, statistics = {}, statisticCatalog = {}, medals = {}, guildFeed = {}, counters = {}, medalTallies = {},
  }
  if reason then db.diagnostics.recovery = { recoveredAt = timestamp, reason = reason } end
  return db
end

function Database:Open(saved)
  local reason
  if type(saved) ~= "table" then if saved~=nil then reason="corrupt root" end
  elseif saved.schemaVersion ~= 1 then reason = "unsupported schema" end
  if not reason and type(saved)=="table" then
    for _,key in ipairs({"meta","settings","characters","sessions","events","eventIds","questCompletion","professionSnapshots","aggregates","diagnostics","statistics","statisticCatalog","medals","guildFeed","counters","medalTallies"}) do
      if saved[key]~=nil and type(saved[key])~="table" then reason="corrupt root"; break end
    end
    if not reason and type(saved.events)=="table" then
      local seen={}
      for _,event in ipairs(saved.events) do
        local valid=type(event)=="table" and event.schemaVersion==1 and type(event.id)=="string" and #event.id>0 and not seen[event.id] and type(event.type)=="string" and type(event.occurredAt)=="number" and event.occurredAt==event.occurredAt and type(event.observedAt)=="number" and event.observedAt==event.observedAt and type(event.payload)=="table"
        if not valid then reason="corrupt root"; break end
        seen[event.id]=true
      end
    end
  end
  local db = reason and self:Fresh(reason) or (type(saved) == "table" and saved or self:Fresh())
  db.meta = tableOr(db.meta); db.settings = tableOr(db.settings)
  for _, key in ipairs({"characters","sessions","events","eventIds","questCompletion","professionSnapshots","aggregates","diagnostics","statistics","statisticCatalog","medals","guildFeed","counters","medalTallies"}) do db[key] = tableOr(db[key]) end
  db.eventIds={}; for _,event in ipairs(db.events) do db.eventIds[event.id]=true end
  db.schemaVersion = 1; self.db = db; self:NormaliseSettings()
  db.meta.createdAt = db.meta.createdAt or now(); db.meta.updatedAt = now(); db.meta.loadCount = (tonumber(db.meta.loadCount) or 0) + 1
  db.meta.addonVersion = Addon.version; db.meta.clientBuild = select(2, Addon:SafeCall(GetBuildInfo))
  return db
end

function Database:GetSettings() return self.db.settings end
function Database:GetCharacter() return self.db.characters[Addon.characterKey] end

function Database:NormaliseSettings()
  local settings = tableOr(self.db and self.db.settings)
  local defaults = freshSettings()
  for key, value in pairs(defaults) do if key ~= "ui" and settings[key] == nil then settings[key] = value end end
  if type(settings.showMinimapButton) ~= "boolean" then settings.showMinimapButton = true end
  if type(settings.recordStatistics) ~= "boolean" then settings.recordStatistics = true end
  if type(settings.recordGoldStatistics) ~= "boolean" then settings.recordGoldStatistics = false end
  for key, default in pairs(booleanDefaults) do if type(settings[key]) ~= "boolean" then settings[key] = default end end
  if not finite(settings.windowAlpha) then settings.windowAlpha = 1 else settings.windowAlpha = clamp(settings.windowAlpha, 0.3, 1) end
  if not validThemes[settings.theme] then settings.theme = "midnight" end
  if settings.welcomeVersion ~= nil and type(settings.welcomeVersion) ~= "string" then settings.welcomeVersion = nil end
  local saved = tableOr(settings.ui); local ui = copyTable(uiDefaults)
  if validPoints[saved.point] then ui.point = saved.point end
  if finite(saved.x) then ui.x = clamp(saved.x, -10000, 10000) end
  if finite(saved.y) then ui.y = clamp(saved.y, -10000, 10000) end
  if finite(saved.width) then ui.width = clamp(saved.width, 620, 1600) end
  if finite(saved.height) then ui.height = clamp(saved.height, 440, 1200) end
  if validTabs[saved.activeTab] then ui.activeTab = saved.activeTab end
  if finite(saved.minimapAngle) then ui.minimapAngle = ((saved.minimapAngle % 360) + 360) % 360 end
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
  current.lastSeenAt = now(); self.db.characters[key] = current
end

function Database:BeginSession()
  if self.currentSession then return self.currentSession end
  local session = { id = Addon.characterKey .. ":" .. tostring(now()) .. ":" .. tostring(#self.db.sessions + 1), characterKey = Addon.characterKey, startedAt = now() }
  table.insert(self.db.sessions, session); self.currentSession = session; Addon.sessionId = session.id; return session
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
