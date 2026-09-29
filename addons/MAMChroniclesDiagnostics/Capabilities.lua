local addon = MAMChroniclesDiagnostics

local function unavailable(reason)
    return { available = false, reason = reason }
end

local function roundCoordinate(value)
    if type(value) ~= "number" then
        return nil
    end
    return math.floor(value * 10000 + 0.5) / 10000
end

function addon.ProbeMap()
    if type(C_Map) ~= "table"
        or type(C_Map.GetBestMapForUnit) ~= "function"
        or type(C_Map.GetPlayerMapPosition) ~= "function" then
        return unavailable("map-api-missing")
    end

    local mapOk, mapID = addon.SafeCall(C_Map.GetBestMapForUnit, "player")
    if not mapOk then
        return unavailable("map-query-error")
    end
    if type(mapID) ~= "number" then
        return unavailable("map-unavailable")
    end

    local positionOk, position = addon.SafeCall(C_Map.GetPlayerMapPosition, mapID, "player")
    if not positionOk then
        return unavailable("map-query-error")
    end

    local result = {
        available = true,
        mapID = mapID,
        positionAvailable = false,
        worldPositionAvailable = false,
    }

    if type(position) == "table" and type(position.GetXY) == "function" then
        local xyOk, x, y = addon.SafeCall(position.GetXY, position)
        if not xyOk then
            return unavailable("map-query-error")
        end
        if type(x) == "number" and type(y) == "number" then
            result.positionAvailable = true
            result.x = roundCoordinate(x)
            result.y = roundCoordinate(y)
        end
    end

    if type(UnitPosition) == "function" then
        local worldOk, worldX, worldY = addon.SafeCall(UnitPosition, "player")
        if not worldOk then
            return unavailable("map-query-error")
        end
        result.worldPositionAvailable = type(worldX) == "number" and type(worldY) == "number"
    end

    return result
end

function addon.ProbeProfessions()
    if type(GetProfessions) ~= "function" or type(GetProfessionInfo) ~= "function" then
        return unavailable("profession-api-missing")
    end

    local ok, profession1, profession2 = addon.SafeCall(GetProfessions)
    if not ok then
        return unavailable("profession-query-error")
    end

    local result = {
        available = true,
        primaryCount = 0,
        skillInfoCount = 0,
        recipeCount = 0,
    }

    local professionIndexes = { profession1, profession2 }
    for _, index in ipairs(professionIndexes) do
        if type(index) == "number" then
            result.primaryCount = result.primaryCount + 1
            local infoOk, _, _, skillLevel, maxSkillLevel = addon.SafeCall(GetProfessionInfo, index)
            if not infoOk then
                return unavailable("profession-query-error")
            end
            if type(skillLevel) == "number" and type(maxSkillLevel) == "number" then
                result.skillInfoCount = result.skillInfoCount + 1
            end
        end
    end

    if type(C_TradeSkillUI) == "table" and type(C_TradeSkillUI.GetAllRecipeIDs) == "function" then
        local recipeOk, recipeIDs = addon.SafeCall(C_TradeSkillUI.GetAllRecipeIDs)
        if not recipeOk then
            return unavailable("profession-query-error")
        end
        if type(recipeIDs) == "table" then
            result.recipeCount = #recipeIDs
        end
    end

    return result
end

function addon.ProbeGuild()
    if type(GetNumGuildMembers) ~= "function" or type(GetGuildRosterInfo) ~= "function" then
        return unavailable("guild-api-missing")
    end

    local ok, memberCount = addon.SafeCall(GetNumGuildMembers)
    if not ok or type(memberCount) ~= "number" then
        return unavailable("guild-query-error")
    end

    local result = { available = true, memberCount = memberCount, onlineCount = 0 }
    for index = 1, memberCount do
        local infoOk, _, _, _, _, _, _, _, _, isOnline = addon.SafeCall(GetGuildRosterInfo, index)
        if not infoOk then
            return unavailable("guild-query-error")
        end
        if isOnline == true then
            result.onlineCount = result.onlineCount + 1
        end
    end
    return result
end

function addon.ProbeMessaging()
    if type(C_ChatInfo) ~= "table"
        or type(C_ChatInfo.RegisterAddonMessagePrefix) ~= "function"
        or type(C_ChatInfo.AreOutgoingAddonChatMessagesRestricted) ~= "function" then
        return unavailable("chat-api-missing")
    end

    local registerOk, registered = addon.SafeCall(C_ChatInfo.RegisterAddonMessagePrefix, addon.MESSAGE_PREFIX)
    local restrictionOk, restricted = addon.SafeCall(C_ChatInfo.AreOutgoingAddonChatMessagesRestricted)
    if not registerOk or not restrictionOk then
        return unavailable("chat-query-error")
    end

    return {
        available = true,
        prefixRegistered = registered == true,
        outgoingRestricted = restricted == true,
    }
end

function addon.RunCapabilities()
    if type(MAMChroniclesDiagnosticsDB) ~= "table" then
        addon.Initialize()
    end
    local capabilities = MAMChroniclesDiagnosticsDB.capabilities
    capabilities.map = addon.ProbeMap()
    capabilities.professions = addon.ProbeProfessions()
    capabilities.guild = addon.ProbeGuild()
    capabilities.messaging = addon.ProbeMessaging()
    capabilities.checkedAt = addon.Now()
    return capabilities
end
