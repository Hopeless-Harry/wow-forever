local addon = MAMChroniclesDiagnostics

local reportEventOrder = {
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

local function integer(value)
    return math.floor(tonumber(value) or 0)
end

local function yesNo(value)
    return value == true and "yes" or "no"
end

local function capabilityStatus(capability)
    if type(capability) ~= "table" then
        return "not checked"
    end
    if capability.available then
        return "available"
    end
    return "unavailable (" .. tostring(capability.reason or "unknown") .. ")"
end

local function markerValue(value)
    if type(value) == "string" and string.match(value, "^[0-9]+%-[0-9]+$") then
        return value
    end
    return "none"
end

function addon.GetReportLines()
    if type(MAMChroniclesDiagnosticsDB) ~= "table" then
        addon.Initialize()
    end
    local database = MAMChroniclesDiagnosticsDB
    local runtime = type(database.runtime) == "table" and database.runtime or {}
    local persistence = type(database.persistence) == "table" and database.persistence or {}
    local events = type(database.events) == "table" and database.events or {}
    local eventRegistration = type(database.eventRegistration) == "table" and database.eventRegistration or {}
    local capabilities = type(database.capabilities) == "table" and database.capabilities or {}
    local messages = type(database.messages) == "table" and database.messages or {}
    local map = type(capabilities.map) == "table" and capabilities.map or nil
    local guild = type(capabilities.guild) == "table" and capabilities.guild or nil
    local professions = type(capabilities.professions) == "table" and capabilities.professions or nil
    local messaging = type(capabilities.messaging) == "table" and capabilities.messaging or nil

    local lines = {
        "Moms Against Magic Chronicles Diagnostics",
        "",
        "Runtime",
        "Addon version: " .. tostring(addon.VERSION),
        "Build: " .. tostring(runtime.build or "unknown"),
        "Client version: " .. tostring(runtime.version or "unknown"),
        "Interface: " .. tostring(runtime.interface or "unknown"),
        "Locale: " .. tostring(runtime.locale or "unknown"),
        "",
        "Persistence",
        "Load count: " .. string.format("%d", integer(database.loadCount)),
        "Current marker: " .. markerValue(persistence.marker),
        "Loaded marker: " .. markerValue(persistence.loadedMarker),
        "",
        "Event registration",
    }

    for _, eventName in ipairs(addon.EVENT_NAMES or reportEventOrder) do
        local status = eventRegistration[eventName]
        local observed = type(events[eventName]) == "table" and integer(events[eventName].count) or 0
        if type(status) == "table" and status.available == true then
            table.insert(lines, eventName .. ": available; observed " .. tostring(observed))
        elseif type(status) == "table" then
            table.insert(lines, eventName .. ": unavailable (" .. tostring(status.reason or "unknown") .. "); observed " .. tostring(observed))
        else
            table.insert(lines, eventName .. ": not checked; observed " .. tostring(observed))
        end
    end

    table.insert(lines, "")
    table.insert(lines, "Events")

    local anyEvent = false
    for _, eventName in ipairs(reportEventOrder) do
        local record = events[eventName]
        if type(record) == "table" and integer(record.count) > 0 then
            table.insert(lines, eventName .. ": " .. string.format("%d", integer(record.count)))
            anyEvent = true
        end
    end
    if not anyEvent then
        table.insert(lines, "No supported events observed yet.")
    end

    table.insert(lines, "")
    table.insert(lines, "Map")
    table.insert(lines, "Status: " .. capabilityStatus(map))
    if map and map.available then
        table.insert(lines, "Map ID available: " .. yesNo(type(map.mapID) == "number"))
        table.insert(lines, "Map position available: " .. yesNo(map.positionAvailable))
        table.insert(lines, "Outdoor world position available: " .. yesNo(map.worldPositionAvailable))
    end

    table.insert(lines, "")
    table.insert(lines, "Guild")
    table.insert(lines, "Status: " .. capabilityStatus(guild))
    if guild and guild.available then
        table.insert(lines, "Members visible: " .. string.format("%d", integer(guild.memberCount)))
        table.insert(lines, "Online visible: " .. string.format("%d", integer(guild.onlineCount)))
    end

    table.insert(lines, "")
    table.insert(lines, "Professions")
    table.insert(lines, "Status: " .. capabilityStatus(professions))
    if professions and professions.available then
        table.insert(lines, "Primary professions visible: " .. string.format("%d", integer(professions.primaryCount)))
        table.insert(lines, "Secondary professions visible: " .. string.format("%d", integer(professions.secondaryCount)))
        table.insert(lines, "Cooking learned: " .. yesNo(professions.cookingLearned))
        table.insert(lines, "Fishing learned: " .. yesNo(professions.fishingLearned))
        table.insert(lines, "Archaeology learned: " .. yesNo(professions.archaeologyLearned))
        table.insert(lines, "Recipe enumeration available: " .. yesNo(professions.recipeEnumerationAvailable))
        if professions.recipeEnumerationAvailable then
            table.insert(lines, "Recipes visible in current window: " .. string.format("%d", integer(professions.recipeCount)))
        end
    end

    table.insert(lines, "")
    table.insert(lines, "Messaging")
    table.insert(lines, "Status: " .. capabilityStatus(messaging))
    if messaging and messaging.available then
        table.insert(lines, "Prefix registered: " .. yesNo(messaging.prefixRegistered))
        table.insert(lines, "Registration result: " .. tostring(messaging.registrationResult or "unknown"))
        table.insert(lines, "Outgoing restricted: " .. yesNo(messaging.outgoingRestricted))
        if messaging.chatLockdownAvailable then
            table.insert(lines, "Chat lockdown: " .. yesNo(messaging.chatLockdown))
        else
            table.insert(lines, "Chat lockdown: unavailable")
        end
    end
    table.insert(lines, "Pings sent: " .. string.format("%d", integer(messages.sent)))
    table.insert(lines, "Pings received: " .. string.format("%d", integer(messages.receivedPing)))
    table.insert(lines, "Pongs received: " .. string.format("%d", integer(messages.receivedPong)))
    if type(messages.lastSendFailure) == "string" then
        table.insert(lines, "Last send failure: " .. messages.lastSendFailure)
    end

    table.insert(lines, "")
    table.insert(lines, "Next Actions")
    table.insert(lines, "1. Use /mamdiag mark, copy Current marker, then /reload and compare Loaded marker.")
    table.insert(lines, "2. Use /mamdiag ping self to verify local addon messages.")
    table.insert(lines, "3. Follow the Phase 0 checklist before building Chronicles.")
    return lines
end

function addon.BuildReportText()
    return table.concat(addon.GetReportLines(), "\n")
end

local function refreshVisibleReport()
    if addon.reportEditBox then
        addon.reportEditBox:SetText(addon.BuildReportText())
        addon.reportEditBox:SetCursorPosition(0)
    end
end

local function createReportFrame()
    if addon.reportFrame then
        return addon.reportFrame
    end

    local frame = CreateFrame("Frame", "MAMChroniclesDiagnosticsFrame", UIParent, "BackdropTemplate")
    frame:SetSize(620, 520)
    frame:SetPoint("CENTER")
    frame:SetMovable(true)
    frame:EnableMouse(true)
    frame:RegisterForDrag("LeftButton")
    frame:SetClampedToScreen(true)
    frame:SetFrameStrata("DIALOG")
    frame:SetBackdrop({
        bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
        edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
        tile = true,
        tileSize = 32,
        edgeSize = 32,
        insets = { left = 10, right = 10, top = 10, bottom = 10 },
    })
    frame:SetScript("OnDragStart", frame.StartMoving)
    frame:SetScript("OnDragStop", frame.StopMovingOrSizing)

    local title = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    title:SetPoint("TOPLEFT", 22, -18)
    title:SetText("Moms Against Magic Chronicles — Phase 0")

    local close = CreateFrame("Button", nil, frame, "UIPanelCloseButton")
    close:SetPoint("TOPRIGHT", -8, -8)

    local refresh = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
    refresh:SetSize(110, 24)
    refresh:SetPoint("TOPRIGHT", -48, -15)
    refresh:SetText("Run Checks")
    refresh:SetScript("OnClick", function()
        addon.RunCapabilities()
        refreshVisibleReport()
    end)

    local scroll = CreateFrame("ScrollFrame", nil, frame, "UIPanelScrollFrameTemplate")
    scroll:SetPoint("TOPLEFT", 22, -52)
    scroll:SetPoint("BOTTOMRIGHT", -42, 22)

    local editBox = CreateFrame("EditBox", nil, scroll)
    editBox:SetMultiLine(true)
    editBox:SetAutoFocus(false)
    editBox:SetFontObject(GameFontHighlightSmall)
    editBox:SetWidth(535)
    editBox:SetTextInsets(4, 4, 4, 4)
    editBox:SetScript("OnEscapePressed", function() frame:Hide() end)
    scroll:SetScrollChild(editBox)

    addon.reportFrame = frame
    addon.reportEditBox = editBox
    frame:Hide()
    return frame
end

function addon.ToggleReport()
    local frame = createReportFrame()
    if frame:IsShown() then
        frame:Hide()
    else
        refreshVisibleReport()
        frame:Show()
    end
end

function addon.RunAndRefresh()
    addon.RunCapabilities()
    refreshVisibleReport()
end

function addon.MarkAndRefresh()
    addon.MarkPersistence()
    refreshVisibleReport()
end

function addon.ResetDiagnostics()
    if type(MAMChroniclesDiagnosticsDB) ~= "table" then
        addon.Initialize()
    end
    MAMChroniclesDiagnosticsDB.events = {}
    MAMChroniclesDiagnosticsDB.capabilities = {}
    MAMChroniclesDiagnosticsDB.messages = {}
    MAMChroniclesDiagnosticsDB.eventRegistration = {}
    addon.PrepareEventStorage(MAMChroniclesDiagnosticsDB)
    addon.SafeRegisterEvents(addon.eventFrame, reportEventOrder)
    refreshVisibleReport()
end

local function printHelp()
    DEFAULT_CHAT_FRAME:AddMessage("MAM Chronicles: /mamdiag | /mamdiag run | /mamdiag mark | /mamdiag ping self | /mamdiag ping guild | /mamdiag reset")
end

local function runPing(scope)
    local sent = addon.SendPing(scope)
    if sent then
        DEFAULT_CHAT_FRAME:AddMessage("MAM Chronicles: " .. scope .. " ping sent.")
    else
        DEFAULT_CHAT_FRAME:AddMessage("MAM Chronicles: " .. scope .. " ping was not sent. Check Messaging status in /mamdiag.")
    end
    refreshVisibleReport()
end

SLASH_MAMCHRONICLESDIAGNOSTICS1 = "/mamdiag"
SlashCmdList.MAMCHRONICLESDIAGNOSTICS = function(message)
    local command = string.lower((message or ""):match("^%s*(.-)%s*$"))
    if command == "" then
        addon.ToggleReport()
    elseif command == "run" then
        addon.RunAndRefresh()
    elseif command == "mark" then
        addon.MarkAndRefresh()
    elseif command == "ping self" then
        runPing("self")
    elseif command == "ping guild" then
        runPing("guild")
    elseif command == "reset" then
        addon.ResetDiagnostics()
    else
        printHelp()
    end
end
