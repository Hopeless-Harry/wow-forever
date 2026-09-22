local ADDON_NAME = ...

local function Now()
    if GetServerTime then
        return GetServerTime()
    end
    return time()
end

local function ReadGameMode()
    if not GetCVar then
        return nil
    end

    local ok, value = pcall(GetCVar, "currentGameMode")
    if ok and value ~= "" then
        return tonumber(value) or value
    end
    return nil
end

local function RecordClientState()
    ForeverBridgeDB = ForeverBridgeDB or {}

    local version, build, buildDate, interfaceVersion = GetBuildInfo()
    ForeverBridgeDB.addonVersion = "0.1.0"
    ForeverBridgeDB.clientVersion = version
    ForeverBridgeDB.clientBuild = build
    ForeverBridgeDB.clientBuildDate = buildDate
    ForeverBridgeDB.interfaceVersion = interfaceVersion
    ForeverBridgeDB.locale = GetLocale()
    ForeverBridgeDB.gameMode = ReadGameMode()
    ForeverBridgeDB.lastSeenAt = Now()
end

local function PrintStatus()
    RecordClientState()
    ForeverBridgeDB.lastCommandAt = Now()

    local message = string.format(
        "WoW Forever Bridge: build %s, interface %s. Data saves on reload, logout or exit.",
        tostring(ForeverBridgeDB.clientBuild or "unknown"),
        tostring(ForeverBridgeDB.interfaceVersion or "unknown")
    )
    DEFAULT_CHAT_FRAME:AddMessage(message)
end

SLASH_WOWFOREVERMCP1 = "/wfmcp"
SlashCmdList.WOWFOREVERMCP = PrintStatus

local events = CreateFrame("Frame")
events:RegisterEvent("ADDON_LOADED")
events:RegisterEvent("PLAYER_LOGIN")
events:RegisterEvent("PLAYER_LOGOUT")
events:SetScript("OnEvent", function(_, event, loadedAddon)
    if event == "ADDON_LOADED" and loadedAddon == ADDON_NAME then
        RecordClientState()
    elseif event == "PLAYER_LOGIN" then
        RecordClientState()
        ForeverBridgeDB.loginAt = Now()
    elseif event == "PLAYER_LOGOUT" then
        RecordClientState()
        ForeverBridgeDB.logoutAt = Now()
    end
end)

