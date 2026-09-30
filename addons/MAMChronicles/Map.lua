local Addon = MAMChronicles
local Map = {}
Addon.Map = Map

-- Live guild map. Guildmates who turn on "Share my location" broadcast a tiny hidden addon message
-- (map id, position to a thousandth, level, class, version) every 20 seconds while in the open world.
-- Received positions live only in memory for this session: nothing is ever saved to disk. Sharing is OFF by default.
-- Message: L1|<mapID>|<x 0-1000>|<y 0-1000>|<level>|<classID>|<version>
Map.version = 1
Map.MAX_MEMBERS = 200
Map.MAX_PINNED = 5
Map.SEND_INTERVAL = 20  -- seconds between location messages
Map.RESEND_SAME = 60    -- an unchanged position is only resent this often
Map.ACCEPT_GAP = 8      -- a sender's updates closer together than this are ignored
Map.STALE = 120         -- shown dimmed after this long
Map.EXPIRE = 300        -- forgotten after this long
Map.members = {}
Map.pins = {}
Map.status = { sent = 0, received = 0, ignored = 0 }

local function now() return Addon:Now() end
local function settings() return Addon.db and Addon.db.settings or {} end
local function safe(fn, ...) return Addon:SafeCall(fn, ...) end
local function shortName(sender) return (tostring(sender):match("^[^-]+")) or tostring(sender) end
local function validName(name) return type(name) == "string" and #name >= 1 and #name <= 24 and name:match("^[^%s%c|]+$") ~= nil end

-- ---------------------------------------------------------------- my position and sending
function Map:GetPosition()
  if not (C_Map and C_Map.GetBestMapForUnit and C_Map.GetPlayerMapPosition) then return nil end
  local mapID = safe(C_Map.GetBestMapForUnit, "player")
  if not mapID then return nil end
  local position = safe(C_Map.GetPlayerMapPosition, mapID, "player")
  if not (position and position.GetXY) then return nil end
  local x, y = safe(position.GetXY, position)
  if not (x and y) then return nil end
  return mapID, x, y
end

function Map:BuildMessage()
  local mapID, x, y = self:GetPosition()
  if not mapID then return nil end
  local level = tonumber(safe(UnitLevel, "player")) or 0
  local _, _, classID = safe(UnitClass, "player")
  local function scaled(value) return math.max(0, math.min(1000, math.floor(value * 1000 + 0.5))) end
  return string.format("L1|%d|%d|%d|%d|%d|%d", mapID, scaled(x), scaled(y), math.max(0, math.min(130, level)), tonumber(classID) or 0, self.version)
end

-- Returns a short reason when nothing was sent.
function Map:Send(force)
  if settings().shareLocation ~= true then return "sharing is off" end
  if IsInGuild and not IsInGuild() then return "not in guild" end
  if IsInInstance and safe(IsInInstance) then return "in an instance" end
  local comms = Addon.Comms
  if not comms then return "unavailable" end
  local reason = comms:Availability()
  if reason then return reason end
  local text = self:BuildMessage()
  if not text then return "no position" end
  local t = now()
  if not force and self.lastSentAt then
    if t - self.lastSentAt < self.SEND_INTERVAL then return "too soon" end
    if text == self.lastText and t - self.lastSentAt < self.RESEND_SAME then return "unchanged" end
  end
  local outcome = comms:SendRaw(text)
  if outcome == "sent" then
    self.lastSentAt, self.lastText = t, text
    self.status.sent = self.status.sent + 1
  end
  return outcome
end

function Map:Tick()
  if settings().shareLocation ~= true then self.loopRunning = false; return end
  self:Send(false)
  if C_Timer and C_Timer.After then C_Timer.After(self.SEND_INTERVAL, function() Map:Tick() end) else self.loopRunning = false end
end

function Map:Start()
  if self.loopRunning or settings().shareLocation ~= true or not (C_Timer and C_Timer.After) then return end
  self.loopRunning = true
  self:Tick()
end

function Map:SetShare(on)
  local config = settings()
  if type(config) ~= "table" then return false end
  config.shareLocation = on == true
  if on then self:Start() end
  return true
end

-- ---------------------------------------------------------------- receiving
function Map:ParseMessage(text)
  local parts = {}
  for piece in (tostring(text) .. "|"):gmatch("([^|]*)|") do parts[#parts + 1] = piece end
  if #parts ~= 7 or parts[1] ~= "L1" then return nil end
  local n = {}
  for index = 2, 7 do
    local value = tonumber(parts[index])
    if not value or value ~= math.floor(value) then return nil end
    n[index] = value
  end
  if n[7] ~= self.version then return nil end
  if n[2] < 1 or n[2] > 99999 or n[3] < 0 or n[3] > 1000 or n[4] < 0 or n[4] > 1000 or n[5] < 0 or n[5] > 130 or n[6] < 0 or n[6] > 20 then return nil end
  return { mapID = n[2], x = n[3] / 1000, y = n[4] / 1000, level = n[5], classID = n[6] }
end

function Map:OnMessage(sender, text)
  if settings().showGuildMap == false then return end
  local name = shortName(sender)
  if not validName(name) then return end
  local data = self:ParseMessage(text)
  if not data then self.status.ignored = self.status.ignored + 1; return end
  local t = now()
  local old = self.members[name]
  if old and t - old.at < self.ACCEPT_GAP then return end
  if not old then
    local count, oldestName, oldestAt = 0, nil, nil
    for memberName, member in pairs(self.members) do
      count = count + 1
      if not oldestAt or member.at < oldestAt then oldestName, oldestAt = memberName, member.at end
    end
    if count >= self.MAX_MEMBERS and oldestName then self.members[oldestName] = nil end
  end
  data.at = t
  self.members[name] = data
  self.status.received = self.status.received + 1
  if Addon.UI and Addon.UI.RefreshMapIfVisible then Addon:Guard("Map", Addon.UI.RefreshMapIfVisible, Addon.UI) end
  if Addon.Tracker and Addon.Tracker.Request then Addon.Tracker:Request() end
end

-- ---------------------------------------------------------------- roster
function Map:ZoneName(mapID)
  if C_Map and C_Map.GetMapInfo then
    local info = safe(C_Map.GetMapInfo, mapID)
    if type(info) == "table" and info.name then return info.name end
  end
  return "Zone " .. tostring(mapID)
end

function Map:ClassInfo(classID)
  if C_CreatureInfo and C_CreatureInfo.GetClassInfo then
    local info = safe(C_CreatureInfo.GetClassInfo, classID)
    if type(info) == "table" then return info.className, info.classFile end
  end
  if GetClassInfo then
    local className, classFile = safe(GetClassInfo, classID)
    return className, classFile
  end
  return nil, nil
end

function Map:IsPinned(name)
  local list = settings().pinnedPlayers
  if type(list) ~= "table" then return false end
  for _, pinned in ipairs(list) do if pinned == name then return true end end
  return false
end

function Map:SetPinned(name, on)
  local config = settings()
  if type(config) ~= "table" then return false end
  if type(config.pinnedPlayers) ~= "table" then config.pinnedPlayers = {} end
  local list, index = config.pinnedPlayers, nil
  for position, pinned in ipairs(list) do if pinned == name then index = position end end
  if not on then
    if index then table.remove(list, index) end
    return true
  end
  if not validName(name) then return false end
  if index then return true end
  if #list >= self.MAX_PINNED then return false end
  table.insert(list, name)
  return true
end

function Map:GetList()
  local list, t = {}, now()
  for name, member in pairs(self.members) do
    local age = t - member.at
    if age > self.EXPIRE then self.members[name] = nil
    else
      local className, classFile = self:ClassInfo(member.classID)
      list[#list + 1] = {
        name = name, mapID = member.mapID, x = member.x, y = member.y, level = member.level, classID = member.classID, className = className, classFile = classFile,
        zone = self:ZoneName(member.mapID), age = age, stale = age > self.STALE, pinned = self:IsPinned(name),
      }
    end
  end
  table.sort(list, function(a, b)
    if a.pinned ~= b.pinned then return a.pinned end
    return a.name < b.name
  end)
  return list
end

function Map:Find(name)
  local wanted = string.lower(tostring(name or ""))
  for memberName, member in pairs(self.members) do
    if string.lower(memberName) == wanted then return memberName, member end
  end
  return nil
end

-- ---------------------------------------------------------------- the game's own world map
local function classColour(classFile)
  local colours = RAID_CLASS_COLORS
  local colour = colours and classFile and colours[classFile]
  if colour then return colour.r, colour.g, colour.b end
  return 1, 0.82, 0
end

function Map:ShowPins()
  if Addon:InCombat() then return false end
  if not (WorldMapFrame and WorldMapFrame.GetCanvas) then return false end
  local canvas = safe(WorldMapFrame.GetCanvas, WorldMapFrame)
  if not canvas then return false end
  local shownMap = WorldMapFrame.GetMapID and safe(WorldMapFrame.GetMapID, WorldMapFrame)
  local width, height = tonumber(canvas.GetWidth and canvas:GetWidth()) or 0, tonumber(canvas.GetHeight and canvas:GetHeight()) or 0
  local used = 0
  for _, member in ipairs(self:GetList()) do
    if member.mapID == shownMap then
      used = used + 1
      local pin = self.pins[used]
      if not pin then
        pin = CreateFrame("Frame", nil, canvas)
        pcall(pin.SetSize, pin, 18, 18)
        local dot = pin:CreateTexture(nil, "OVERLAY")
        if dot then
          dot:SetTexture((Addon.Theme and Addon.Theme.ART or "") .. "Glow"); if dot.SetAllPoints then dot:SetAllPoints(pin) end
          pin.dot = dot
        end
        if pin.SetFrameLevel and canvas.GetFrameLevel then pcall(pin.SetFrameLevel, pin, (canvas:GetFrameLevel() or 0) + 40) end
        if pin.EnableMouse then pin:EnableMouse(true) end
        pin:SetScript("OnEnter", function(p)
          if GameTooltip and GameTooltip.SetOwner then GameTooltip:SetOwner(p, "ANCHOR_RIGHT"); GameTooltip:SetText(tostring(p.label or "")); GameTooltip:Show() end
        end)
        pin:SetScript("OnLeave", function() if GameTooltip and GameTooltip.Hide then GameTooltip:Hide() end end)
        self.pins[used] = pin
      end
      if pin.ClearAllPoints then pin:ClearAllPoints() end
      pin:SetPoint("TOPLEFT", canvas, "TOPLEFT", member.x * width, -member.y * height)
      pin.label = member.name .. "  (level " .. tostring(member.level) .. (member.className and (" " .. member.className) or "") .. ")"
      if pin.dot and pin.dot.SetVertexColor then pin.dot:SetVertexColor(classColour(member.classFile)) end
      if pin.SetAlpha then pin:SetAlpha(member.stale and 0.45 or 1) end
      pin:Show()
    end
  end
  for index = used + 1, #self.pins do self.pins[index]:Hide() end
  return true
end

function Map:HookWorldMap()
  if self.hooked or not WorldMapFrame then return end
  self.hooked = true
  local refresh = function() Map:ShowPins() end
  if WorldMapFrame.HookScript then pcall(WorldMapFrame.HookScript, WorldMapFrame, "OnShow", refresh) end
  if hooksecurefunc and WorldMapFrame.OnMapChanged then pcall(hooksecurefunc, WorldMapFrame, "OnMapChanged", refresh) end
end

-- Takes you to a guildmate: sets a map waypoint with the tracking arrow, opens the world map at their zone and shows pins.
function Map:GoTo(name)
  local memberName, member = self:Find(name)
  if not member then return false end
  if C_Map and C_Map.SetUserWaypoint and UiMapPoint and UiMapPoint.CreateFromCoordinates then
    local point = safe(UiMapPoint.CreateFromCoordinates, member.mapID, member.x, member.y)
    if point then
      safe(C_Map.SetUserWaypoint, point)
      if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then safe(C_SuperTrack.SetSuperTrackedUserWaypoint, true) end
    end
  end
  if OpenWorldMap then
    pcall(OpenWorldMap, member.mapID)
  elseif WorldMapFrame and WorldMapFrame.SetMapID then
    pcall(WorldMapFrame.SetMapID, WorldMapFrame, member.mapID)
    if ShowUIPanel then pcall(ShowUIPanel, WorldMapFrame) elseif WorldMapFrame.Show then pcall(WorldMapFrame.Show, WorldMapFrame) end
  end
  self:HookWorldMap()
  self:ShowPins()
  return true
end

-- Opens the game's world map at the player's own position (with the guildmate markers).
function Map:OpenMyMap()
  local mapID = self:GetPosition()
  if OpenWorldMap and mapID then pcall(OpenWorldMap, mapID)
  elseif ToggleWorldMap then pcall(ToggleWorldMap)
  elseif WorldMapFrame and WorldMapFrame.Show then pcall(WorldMapFrame.Show, WorldMapFrame) end
  self:HookWorldMap()
  self:ShowPins()
  return true
end

function Map:Describe()
  local on = settings().shareLocation == true
  return "Location sharing: " .. (on and "on" or "off") .. ", sent " .. tostring(self.status.sent) .. ", received " .. tostring(self.status.received)
end
