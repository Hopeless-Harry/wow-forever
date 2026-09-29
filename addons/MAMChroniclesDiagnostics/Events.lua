local addon = MAMChroniclesDiagnostics

local eventNames = {
    "ADDON_LOADED",
    "PLAYER_LOGIN",
    "PLAYER_LOGOUT",
    "PLAYER_LEVEL_UP",
    "PLAYER_DEAD",
    "PLAYER_ALIVE",
    "PLAYER_UNGHOST",
    "QUEST_ACCEPTED",
    "QUEST_TURNED_IN",
    "ZONE_CHANGED",
    "ZONE_CHANGED_INDOORS",
    "ZONE_CHANGED_NEW_AREA",
    "PLAYER_ENTERING_WORLD",
    "GUILD_ROSTER_UPDATE",
    "SKILL_LINES_CHANGED",
    "TRADE_SKILL_SHOW",
    "CHAT_MSG_ADDON",
}

local allowedEvents = {}
for _, eventName in ipairs(eventNames) do
    allowedEvents[eventName] = true
end

function addon.PrepareEventStorage(database)
    local cleanEvents = {}
    if type(database.events) == "table" then
        for eventName, record in pairs(database.events) do
            if allowedEvents[eventName] and type(record) == "table" then
                cleanEvents[eventName] = {
                    count = tonumber(record.count) or 0,
                    lastSeenAt = tonumber(record.lastSeenAt) or 0,
                }
                if type(record.lastNumber) == "number" then
                    cleanEvents[eventName].lastNumber = record.lastNumber
                end
            end
        end
    end
    database.events = cleanEvents
    if type(database.eventRegistration) ~= "table" then
        database.eventRegistration = {}
    end
end

function addon.SafeRegisterEvents(frame, names)
    if type(MAMChroniclesDiagnosticsDB) ~= "table" then
        addon.Initialize()
    end
    if type(MAMChroniclesDiagnosticsDB.eventRegistration) ~= "table" then
        MAMChroniclesDiagnosticsDB.eventRegistration = {}
    end
    local results = MAMChroniclesDiagnosticsDB.eventRegistration
    for _, eventName in ipairs(names) do
        local ok = pcall(frame.RegisterEvent, frame, eventName)
        if ok then
            results[eventName] = { available = true }
        else
            results[eventName] = { available = false, reason = "registration-error" }
        end
    end
    return results
end

local numericArgumentByEvent = {
    PLAYER_LEVEL_UP = 1,
    QUEST_ACCEPTED = 2,
    QUEST_TURNED_IN = 1,
}

function addon.RecordEvent(eventName, ...)
    if not allowedEvents[eventName] then
        return false
    end
    if type(MAMChroniclesDiagnosticsDB) ~= "table" then
        addon.Initialize()
    end

    local events = MAMChroniclesDiagnosticsDB.events
    local record = events[eventName]
    if type(record) ~= "table" then
        record = { count = 0 }
        events[eventName] = record
    end
    record.count = (tonumber(record.count) or 0) + 1
    record.lastSeenAt = addon.Now()

    local numericIndex = numericArgumentByEvent[eventName]
    if numericIndex then
        local value = select(numericIndex, ...)
        if type(value) == "number" then
            record.lastNumber = value
        end
    end

    if eventName == "ZONE_CHANGED"
        or eventName == "ZONE_CHANGED_INDOORS"
        or eventName == "ZONE_CHANGED_NEW_AREA"
        or eventName == "PLAYER_ENTERING_WORLD" then
        MAMChroniclesDiagnosticsDB.capabilities.map = addon.ProbeMap()
    elseif eventName == "GUILD_ROSTER_UPDATE" then
        MAMChroniclesDiagnosticsDB.capabilities.guild = addon.ProbeGuild()
    elseif eventName == "SKILL_LINES_CHANGED" or eventName == "TRADE_SKILL_SHOW" then
        MAMChroniclesDiagnosticsDB.capabilities.professions = addon.ProbeProfessions()
    end

    return true
end

local eventFrame = CreateFrame("Frame")
addon.eventFrame = eventFrame
addon.SafeRegisterEvents(eventFrame, eventNames)

eventFrame:SetScript("OnEvent", function(_, eventName, ...)
    if eventName == "ADDON_LOADED" then
        local loadedAddon = ...
        if loadedAddon ~= addon.ADDON_NAME then
            return
        end
        addon.Initialize()
        addon.RunCapabilities()
    else
        if type(MAMChroniclesDiagnosticsDB) ~= "table" then
            addon.Initialize()
        end
        addon.RecordEvent(eventName, ...)
        if eventName == "PLAYER_LOGIN" then
            addon.RunCapabilities()
        elseif eventName == "PLAYER_LOGOUT" then
            MAMChroniclesDiagnosticsDB.lastSeenAt = addon.Now()
            addon.RecordRuntime()
        elseif eventName == "CHAT_MSG_ADDON" and type(addon.HandleAddonMessage) == "function" then
            addon.HandleAddonMessage(...)
        end
    end
end)
