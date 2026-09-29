local addon = MAMChroniclesDiagnostics or {}
MAMChroniclesDiagnostics = addon
local unpackValues = unpack or table.unpack

addon.VERSION = "0.1.0-phase0"
addon.MESSAGE_PREFIX = "MAMChronDiag"
addon.ADDON_NAME = "MAMChroniclesDiagnostics"

local function now()
    if type(GetServerTime) == "function" then
        local ok, value = pcall(GetServerTime)
        if ok and type(value) == "number" then
            return value
        end
    end
    if type(time) == "function" then
        local ok, value = pcall(time)
        if ok and type(value) == "number" then
            return value
        end
    end
    return 0
end

local function safeCall(callable, ...)
    if type(callable) ~= "function" then
        return false, "missing"
    end
    local results = { pcall(callable, ...) }
    if not results[1] then
        return false, "error"
    end
    table.remove(results, 1)
    return true, unpackValues(results)
end

addon.Now = now
addon.SafeCall = safeCall

local function ensureTable(parent, key)
    if type(parent[key]) ~= "table" then
        parent[key] = {}
    end
    return parent[key]
end

function addon.RecordRuntime()
    local database = MAMChroniclesDiagnosticsDB
    local runtime = ensureTable(database, "runtime")
    local ok, version, build, buildDate, interfaceVersion = safeCall(GetBuildInfo)
    if ok then
        runtime.version = type(version) == "string" and version or "unknown"
        runtime.build = type(build) == "string" and build or tostring(build or "unknown")
        runtime.buildDate = type(buildDate) == "string" and buildDate or "unknown"
        runtime.interface = type(interfaceVersion) == "number" and interfaceVersion or 0
    else
        runtime.version = "unknown"
        runtime.build = "unknown"
        runtime.buildDate = "unknown"
        runtime.interface = 0
    end

    local localeOk, locale = safeCall(GetLocale)
    runtime.locale = localeOk and type(locale) == "string" and locale or "unknown"

    local modeOk, gameMode = safeCall(GetCVar, "currentGameMode")
    if modeOk then
        runtime.gameMode = tonumber(gameMode) or 0
    else
        runtime.gameMode = 0
    end
end

function addon.Initialize()
    if type(MAMChroniclesDiagnosticsDB) ~= "table" then
        MAMChroniclesDiagnosticsDB = {}
    end

    local database = MAMChroniclesDiagnosticsDB
    database.schemaVersion = 1
    database.loadCount = (tonumber(database.loadCount) or 0) + 1
    database.firstSeenAt = tonumber(database.firstSeenAt) or now()
    database.lastSeenAt = now()

    ensureTable(database, "events")
    ensureTable(database, "capabilities")
    ensureTable(database, "messages")
    local persistence = ensureTable(database, "persistence")
    persistence.markerCount = tonumber(persistence.markerCount) or 0
    if addon.persistenceCaptured ~= true then
        addon.loadedPersistenceMarker = type(persistence.marker) == "string" and persistence.marker or nil
        addon.persistenceCaptured = true
    end
    persistence.loadedMarker = addon.loadedPersistenceMarker
    persistence.previousMarker = addon.loadedPersistenceMarker

    addon.RecordRuntime()
    if type(addon.PrepareEventStorage) == "function" then
        addon.PrepareEventStorage(database)
    end
    addon.database = database
    return database
end

function addon.MarkPersistence()
    if type(MAMChroniclesDiagnosticsDB) ~= "table" then
        addon.Initialize()
    end
    local persistence = ensureTable(MAMChroniclesDiagnosticsDB, "persistence")
    persistence.markerCount = (tonumber(persistence.markerCount) or 0) + 1
    persistence.markedAt = now()
    persistence.marker = string.format("%d-%d", persistence.markedAt, persistence.markerCount)
    return persistence.marker
end
