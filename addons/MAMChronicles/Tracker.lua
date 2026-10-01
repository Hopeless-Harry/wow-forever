local Addon = MAMChronicles
local Tracker = {}
Addon.Tracker = Tracker

-- A small movable "goals" window: pinned medal goals, this week's unfinished Mom Quests and pinned guildmates.
-- Click a goal or quest to open the Medals tab, click a guildmate to open the map at them. Hidden when there is nothing to show.
local WIDTH, ROW_HEIGHT, MAX_ROWS = 250, 16, 14
local REFRESH_DELAY = 0.5

Tracker.rows = {}

local safeMethod = Addon.SafeMethod
local function settings() return Addon.db and Addon.db.settings or {} end

-- Goals and quests are only read once the medal baseline exists (statistics have settled). Before that, reading them would
-- prune pinned goals that look unavailable and seed weekly-quest baselines from half-loaded data.
local function medalsReady()
  local database = Addon.db
  return Addon.Medals ~= nil and database ~= nil and type(database.medals) == "table" and database.medals[Addon.characterKey] ~= nil
end

function Tracker:Build()
  local lines = {}
  local config = settings()
  if medalsReady() then
    for _, goal in ipairs(Addon:SafeCall(Addon.Medals.GetGoals, Addon.Medals) or {}) do
      lines[#lines + 1] = { kind = "goal", id = goal.def.id, text = goal.def.name .. "  " .. tostring(math.floor(goal.current)) .. " / " .. tostring(goal.target) }
    end
    if config.trackerQuests ~= false then
      for _, quest in ipairs(Addon:SafeCall(Addon.Medals.GetWeeklyQuests, Addon.Medals) or {}) do
        if not quest.done then
          lines[#lines + 1] = { kind = "quest", text = quest.text .. "  " .. tostring(math.floor(math.min(quest.current, quest.target))) .. " / " .. tostring(quest.target) }
        end
      end
    end
  end
  if Addon.Map and type(config.pinnedPlayers) == "table" then
    for _, name in ipairs(config.pinnedPlayers) do
      local memberName, member = Addon.Map:Find(name)
      if member then
        lines[#lines + 1] = { kind = "player", name = memberName, text = memberName .. " - " .. Addon.Map:ZoneName(member.mapID) }
      else
        lines[#lines + 1] = { kind = "player", name = name, text = name .. " - not sharing" }
      end
    end
  end
  while #lines > MAX_ROWS do table.remove(lines) end
  return lines
end

local function openMedals()
  local UI = Addon.UI
  if not UI then return end
  if UI.Create then UI:Create() end
  if UI.SetActiveTab then UI:SetActiveTab("Medals") end
  if UI.Show then UI:Show() end
end

function Tracker:CreateFrame()
  if self.frame or not CreateFrame then return self.frame end
  local frame = CreateFrame("Frame", "MAMChroniclesTracker", UIParent, "BackdropTemplate")
  safeMethod(frame, "SetSize", WIDTH, 40)
  safeMethod(frame, "SetFrameStrata", "MEDIUM")
  safeMethod(frame, "SetClampedToScreen", true)
  safeMethod(frame, "SetMovable", true)
  safeMethod(frame, "EnableMouse", true)
  safeMethod(frame, "RegisterForDrag", "LeftButton")
  local T = Addon.Theme
  if T and T.Panel and T.colors then safeMethod(T, "Panel", frame, T.colors.panel, T.colors.border) end
  local pos = settings().tracker
  safeMethod(frame, "ClearAllPoints")
  if type(pos) == "table" and pos.point then safeMethod(frame, "SetPoint", pos.point, UIParent, pos.relPoint or pos.point, pos.x, pos.y)
  else safeMethod(frame, "SetPoint", "TOPRIGHT", UIParent, "TOPRIGHT", -220, -240) end
  safeMethod(frame, "SetScript", "OnDragStart", function(f) if settings().trackerLocked ~= true then safeMethod(f, "StartMoving") end end)
  safeMethod(frame, "SetScript", "OnDragStop", function(f)
    safeMethod(f, "StopMovingOrSizing")
    -- After a drag the frame is anchored to a different UIParent corner than its own, so keep both points.
    local ok, point, _, relPoint, x, y = pcall(f.GetPoint, f, 1)
    if ok and type(point) == "string" and tonumber(x) and tonumber(y) and Addon.db then
      Addon.db.settings.tracker = { point = point, relPoint = type(relPoint) == "string" and relPoint or point, x = x, y = y }
    end
  end)
  frame.title = T and T.Text and T:Text(frame, "GameFontNormalSmall") or frame:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
  safeMethod(frame.title, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 8, -6)
  safeMethod(frame.title, "SetText", "Chronicles goals")
  self.frame = frame
  return frame
end

function Tracker:GetRow(index)
  local row = self.rows[index]
  if row then return row end
  row = CreateFrame("Button", nil, self.frame)
  safeMethod(row, "SetSize", WIDTH - 12, ROW_HEIGHT)
  safeMethod(row, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", 6, -(22 + (index - 1) * ROW_HEIGHT))
  row.label = row:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  safeMethod(row.label, "SetPoint", "LEFT", row, "LEFT", 2, 0)
  safeMethod(row.label, "SetJustifyH", "LEFT")
  -- Long goal and quest names are cut to the row instead of spilling out of the panel.
  safeMethod(row.label, "SetWidth", WIDTH - 20)
  safeMethod(row.label, "SetWordWrap", false)
  safeMethod(row, "RegisterForClicks", "LeftButtonUp", "RightButtonUp")
  safeMethod(row, "RegisterForDrag", "LeftButton")
  safeMethod(row, "SetScript", "OnEnter", function(r)
    if not (GameTooltip and r.kind) then return end
    safeMethod(GameTooltip, "SetOwner", r, "ANCHOR_LEFT")
    safeMethod(GameTooltip, "SetText", r.kind == "goal" and "Medal goal" or (r.kind == "quest" and "Mom Quest" or "Guildmate"))
    local hint = r.kind == "player" and "Click: open the map at them. Right-click: unpin." or (r.kind == "goal" and "Click: open Medals. Right-click: unpin this goal." or "Click: open Medals.")
    safeMethod(GameTooltip, "AddLine", hint, 0.8, 0.8, 0.8, true)
    safeMethod(GameTooltip, "Show")
  end)
  safeMethod(row, "SetScript", "OnLeave", function() if GameTooltip then safeMethod(GameTooltip, "Hide") end end)
  safeMethod(row, "SetScript", "OnClick", function(r, mouseButton)
    if mouseButton == "RightButton" then
      if r.kind == "goal" and r.id and Addon.Medals then Addon.Medals:SetPinned(r.id, false)
      elseif r.kind == "player" and r.name and Addon.Map then Addon.Map:SetPinned(r.name, false) end
      Tracker:Refresh()
      return
    end
    if r.kind == "player" and Addon.Map and r.name then
      if not Addon.Map:GoTo(r.name) then Addon:Print(tostring(r.name) .. " is not sharing a location right now.") end
    else
      openMedals()
    end
  end)
  self.rows[index] = row
  return row
end

local COLOURS = { goal = { 1, 0.82, 0 }, quest = { 0.6, 0.8, 1 }, player = { 0.5, 1, 0.5 } }

function Tracker:Refresh()
  self.pending = false
  -- Nothing is built during combat; it appears when combat ends.
  if Addon:InCombat() then
    if not self.combatQueued then
      self.combatQueued = true
      Addon:AfterCombat(function() Tracker.combatQueued = false; Tracker:Refresh() end)
    end
    return false
  end
  local config = settings()
  local lines = config.trackerEnabled ~= false and self:Build() or {}
  if #lines == 0 then
    if self.frame then safeMethod(self.frame, "Hide") end
    return false
  end
  if not self:CreateFrame() then return false end
  for index, line in ipairs(lines) do
    local row = self:GetRow(index)
    row.kind, row.name, row.id = line.kind, line.name, line.id
    safeMethod(row.label, "SetText", line.text)
    local colour = COLOURS[line.kind]
    safeMethod(row.label, "SetTextColor", colour[1], colour[2], colour[3])
    safeMethod(row, "Show")
  end
  for index = #lines + 1, #self.rows do safeMethod(self.rows[index], "Hide") end
  safeMethod(self.frame, "SetHeight", 28 + #lines * ROW_HEIGHT)
  safeMethod(self.frame, "Show")
  return true
end

-- Many things change at once (counters, map updates); redraw once shortly afterwards.
function Tracker:Request()
  if self.pending then return end
  if not (C_Timer and C_Timer.After) then self:Refresh(); return end
  self.pending = true
  C_Timer.After(REFRESH_DELAY, function() Tracker.pending = false; Addon:Guard("Tracker", Tracker.Refresh, Tracker) end)
end

function Tracker:Initialise()
  if self.initialised then return end
  self.initialised = true
  self:Refresh()
end
