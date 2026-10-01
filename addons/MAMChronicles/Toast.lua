local Addon = MAMChronicles
local Toast = {}
Addon.Toast = Toast

-- Slide-in alerts. They are never shown in combat: they wait in a queue and appear when combat ends.
local DURATIONS = { ["in"] = 0.25, hold = 6, out = 0.4 }
local NEXT_PHASE = { ["in"] = "hold", hold = "out" }
local MAX_QUEUE = 20
local ICON = "Interface\\AddOns\\MAMChronicles\\MAMChroniclesIcon"

Toast.queue = {}
Toast.durations = DURATIONS

local safeMethod = Addon.SafeMethod

local function inCombat() return InCombatLockdown and InCombatLockdown() and true or false end

local quietTypes = { party = true, raid = true, scenario = true, pvp = true, arena = true }

-- Toasts wait in dungeons, raids, scenarios and battlegrounds (when Settings > Alerts allows it) and during combat.
local function held()
  if inCombat() then return true end
  if Toast.muteUntil and Addon:Now() < Toast.muteUntil then return true end
  local settings = Addon.db and Addon.db.settings
  if settings and settings.quietInstances == false then return false end
  if type(IsInInstance) ~= "function" then return false end
  local ok, inInstance, kind = pcall(IsInInstance)
  return ok and inInstance and quietTypes[kind] == true or false
end

function Toast:Initialise()
  if self.initialised then return end
  self.initialised = true
  self:CreateFrame()
  if Addon.eventFrame then pcall(function() Addon.eventFrame:RegisterEvent("PLAYER_REGEN_ENABLED") end) end
  if Addon.Medals then
    Addon.Medals:AddListener(function(def, info) Toast:OnMedal(def, info) end)
  end
end

function Toast:OnMedal(def, info)
  if info and info.summary then
    self:Show({ title = "Welcome to Mom Medals", text = tostring(info.count) .. " medals worth " .. tostring(info.points) .. " Mom Money counted from your history.", kind = "info", action = "Medals" })
  elseif def then
    self:Show({ title = "Medal earned: " .. def.name, text = def.description, kind = "medal", points = def.points, action = "Medals" })
  end
end

function Toast:OnEvent(event)
  if event and event.type == "character.level_up" and event.payload and event.payload.level then
    local text = "Recorded in your Chronicle."
    -- Time played on the level just finished, once there is a measured one to show.
    local pace = Addon.Statistics and Addon.Statistics.BuildLevelPace and Addon:SafeCall(Addon.Statistics.BuildLevelPace, Addon.Statistics)
    if type(pace) == "table" and pace.last and pace.last.level == event.payload.level then
      text = "Level " .. tostring(pace.last.level) .. " took " .. Addon.Statistics:FormatDuration(pace.last.seconds) .. " of play (average " .. Addon.Statistics:FormatDuration(pace.average) .. ")."
    end
    self:Show({ title = "Level " .. tostring(event.payload.level) .. " reached!", text = text, kind = "info" })
  end
end

-- Several medals close together become one summary toast instead of a stack.
local function enqueue(self, spec)
  if spec.kind == "medal" then
    local medals = {}
    for index, queued in ipairs(self.queue) do if queued.kind == "medal" then table.insert(medals, index) end end
    local summary
    for _, index in ipairs(medals) do if self.queue[index].count then summary = self.queue[index] end end
    if summary then
      summary.count = summary.count + 1; summary.points = summary.points + (spec.points or 0)
      summary.title = tostring(summary.count) .. " new medals!"; summary.text = "Worth " .. tostring(summary.points) .. " Mom Money in total."
      return
    elseif #medals >= 2 then
      local count, points = 1, spec.points or 0
      for position = #medals, 1, -1 do
        local queued = table.remove(self.queue, medals[position])
        count = count + 1; points = points + (queued.points or 0)
      end
      table.insert(self.queue, { kind = "medal", count = count, points = points, title = tostring(count) .. " new medals!", text = "Worth " .. tostring(points) .. " Mom Money in total.", action = "Medals" })
      return
    end
  end
  table.insert(self.queue, spec)
  while #self.queue > MAX_QUEUE do table.remove(self.queue, 1) end
end

function Toast:Show(spec)
  local settings = Addon.db and Addon.db.settings
  if not settings or settings.toastsEnabled == false then return "dropped" end
  if spec.kind == "guild" and settings.receiveGuildAlerts == false then return "dropped" end
  if self.current or held() then enqueue(self, spec); return "queued" end
  self:Start(spec)
  return "shown"
end

function Toast:CreateFrame()
  if self.frame then return self.frame end
  local T = Addon.Theme; local C = T.colors
  local frame = CreateFrame("Frame", "MAMChroniclesToast", UIParent, "BackdropTemplate")
  safeMethod(frame, "SetSize", 340, 66); safeMethod(frame, "SetFrameStrata", "FULLSCREEN_DIALOG"); safeMethod(frame, "EnableMouse", true)
  if T.artTheme then
    frame.__shadow = T:NineSlice(frame, "Shadow", { 0, 0, 128, 128 }, 40, "BACKGROUND", 40, 22)
    frame.__slices = T:NineSlice(frame, "Toast", { 0, 0, 512, 128 }, 18, "BACKGROUND", 16)
  else
    T:Panel(frame, C.panel, C.border)
  end
  self.stripe = frame:CreateTexture(nil, "ARTWORK")
  safeMethod(self.stripe, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 0, 0); safeMethod(self.stripe, "SetPoint", "BOTTOMLEFT", frame, "BOTTOMLEFT", 0, 0); safeMethod(self.stripe, "SetWidth", 5)
  local icon = frame:CreateTexture(nil, "ARTWORK")
  safeMethod(icon, "SetTexture", ICON); safeMethod(icon, "SetSize", 34, 34); safeMethod(icon, "SetPoint", "LEFT", frame, "LEFT", 14, 0)
  self.icon = icon
  if T.artTheme then
    -- the flat accent stripe becomes a soft glow behind the icon
    safeMethod(self.stripe, "Hide")
    local glow = frame:CreateTexture(nil, "BORDER")
    safeMethod(glow, "SetTexture", T.ART .. "Glow"); safeMethod(glow, "SetSize", 92, 92); safeMethod(glow, "SetPoint", "CENTER", icon, "CENTER", 0, 0); safeMethod(glow, "SetBlendMode", "ADD")
    self.stripe = glow
  end
  self.title = frame:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  safeMethod(self.title, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 56, -10); safeMethod(self.title, "SetPoint", "RIGHT", frame, "RIGHT", -12, 0); safeMethod(self.title, "SetJustifyH", "LEFT"); safeMethod(self.title, "SetWordWrap", false)
  safeMethod(self.title, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
  self.body = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  safeMethod(self.body, "SetPoint", "TOPLEFT", self.title, "BOTTOMLEFT", 0, -4); safeMethod(self.body, "SetPoint", "RIGHT", frame, "RIGHT", -12, 0); safeMethod(self.body, "SetJustifyH", "LEFT"); safeMethod(self.body, "SetWordWrap", false)
  safeMethod(self.body, "SetTextColor", C.text[1], C.text[2], C.text[3], 1)
  self.points = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
  safeMethod(self.points, "SetPoint", "BOTTOMLEFT", frame, "BOTTOMLEFT", 56, 8); safeMethod(self.points, "SetTextColor", C.muted[1], C.muted[2], C.muted[3], 1)
  safeMethod(frame, "SetScript", "OnUpdate", function(_, elapsed) Toast:Advance(elapsed) end)
  safeMethod(frame, "SetScript", "OnMouseUp", function(_, button) Toast:Click(button) end)
  safeMethod(frame, "Hide")
  self.frame = frame
  return frame
end

-- Stock game sounds only (no files shipped). Each entry names a SOUNDKIT field and a numeric fallback id for clients
-- that lack the name; an id a client does not know simply plays nothing.
Toast.sounds = {
  { key = "chime", label = "Chime", kit = "ACHIEVEMENT_MENU_OPEN", id = 12891 },
  { key = "quest", label = "Quest complete", kit = "IG_QUEST_LIST_COMPLETE", id = 878 },
  { key = "fanfare", label = "Fanfare", kit = "LEVELUP", id = 888 },
  { key = "loot", label = "Loot toast", kit = "UI_EPICLOOT_TOAST", id = 31578 },
  { key = "ready", label = "Ready check", kit = "READY_CHECK", id = 8960 },
  { key = "raid", label = "Raid warning", kit = "RAID_WARNING", id = 8959 },
  { key = "ping", label = "Map ping", kit = "MAP_PING", id = 3175 },
  { key = "whisper", label = "Whisper", kit = "TELL_MESSAGE", id = 3081 },
  { key = "coins", label = "Coins", kit = "LOOT_WINDOW_COIN_SOUND", id = 120 },
}
Toast.soundKeys = {}
for _, sound in ipairs(Toast.sounds) do Toast.soundKeys[sound.key] = sound end

function Toast:PreviewSound(key)
  local sound = self.soundKeys[key] or self.sounds[1]
  if not PlaySound then return false end
  local kits = type(SOUNDKIT) == "table" and SOUNDKIT or {}
  return pcall(PlaySound, kits[sound.kit] or sound.id)
end

function Toast:Start(spec)
  local frame = self:CreateFrame()
  local T = Addon.Theme; local C = T.colors
  self.current, self.phase, self.timer = spec, "in", 0
  local styleColour = Addon.Medals and Addon.Medals.GetToastColour and Addon.Medals:GetToastColour()
  local colour = styleColour or (spec.kind == "medal" and C.gold or (spec.kind == "guild" and T.kindColors.instance or C.accent))
  if T.artTheme then safeMethod(self.stripe, "SetVertexColor", colour[1], colour[2], colour[3], 0.9) else safeMethod(self.stripe, "SetColorTexture", colour[1], colour[2], colour[3], 1) end
  safeMethod(self.title, "SetText", spec.title or ""); safeMethod(self.body, "SetText", spec.text or "")
  safeMethod(self.points, "SetText", spec.points and ("+" .. tostring(spec.points) .. " Mom Money") or "")
  self:Render()
  safeMethod(frame, "Show")
  local lively = spec.kind == "medal" or spec.kind == "guild"
  if lively then T:Pulse(self.stripe, 0.55, 1, 0.9); T:Pop(self.icon) else T:StopPulse(self.stripe) end
  local window = Addon.UI and Addon.UI.frame
  if (lively or spec.action == "Medals") and Addon.Launcher and not (window and window.IsShown and window:IsShown()) then Addon.Launcher:SetAttention(true) end
  local settings = Addon.db and Addon.db.settings
  if settings and settings.toastSound and PlaySound then
    self:PreviewSound(settings.toastSoundChoice)
  end
end

function Toast:Render()
  if not (self.frame and self.current) then return end
  local phase, progress = self.phase, self.timer / DURATIONS[self.phase]
  local alpha, offset = 1, -110
  if phase == "in" then
    local eased = 1 - (1 - progress) ^ 3 -- fast start, soft landing
    alpha = eased; offset = -110 + (1 - eased) * 50
  elseif phase == "out" then
    alpha = 1 - progress; offset = -110 + 14 * progress * progress -- drifts up as it fades
  end
  safeMethod(self.frame, "SetAlpha", math.max(0, math.min(1, alpha)))
  safeMethod(self.frame, "ClearAllPoints"); safeMethod(self.frame, "SetPoint", "TOP", UIParent, "TOP", 0, offset)
end

function Toast:Finish()
  self.current, self.phase, self.timer = nil, nil, 0
  if Addon.Theme then Addon.Theme:StopPulse(self.stripe) end
  safeMethod(self.frame, "Hide")
  if #self.queue > 0 and not held() then self:Start(table.remove(self.queue, 1)) end
end

function Toast:Advance(elapsed)
  if not self.current then return end
  local remaining = tonumber(elapsed) or 0
  while remaining > 0 and self.current do
    local left = DURATIONS[self.phase] - self.timer
    if remaining < left then self.timer = self.timer + remaining; remaining = 0
    elseif self.phase == "out" then self:Finish(); return
    else remaining = remaining - left; self.phase, self.timer = NEXT_PHASE[self.phase], 0 end
  end
  self:Render()
end

-- Debug helper behind Settings > Alerts > Send a test toast and /mam toast. Cycles through the three toast looks.
function Toast:SendTest()
  self.testIndex = ((self.testIndex or 0) % 3) + 1
  local specs = {
    { title = "Test toast", text = "If you can see this, toasts are working.", kind = "info" },
    { title = "Medal earned: Test Medal", text = "A pretend medal, worth pretend Mom Money.", kind = "medal", points = 25 },
    { title = "Alice earned the Test Medal", text = "A pretend guildmate medal.", kind = "guild", points = 25 },
  }
  local result = self:Show(specs[self.testIndex])
  if result == "dropped" then Addon:Print("Toasts are switched off in Settings > Alerts (or guild alerts are off), so nothing was shown.")
  elseif result == "queued" then Addon:Print("Test toast queued: you are in combat or another toast is showing.") end
  return result
end

-- Do not disturb: toasts wait (nothing is lost) until the time is up, then appear one after another.
function Toast:Mute(minutes)
  minutes = math.max(1, math.min(480, math.floor(tonumber(minutes) or 30)))
  self.muteUntil = Addon:Now() + minutes * 60
  if C_Timer and C_Timer.After then C_Timer.After(minutes * 60 + 1, function() Toast:Flush() end) end
  return minutes
end

function Toast:Unmute()
  local was = self.muteUntil ~= nil and Addon:Now() < self.muteUntil
  self.muteUntil = nil
  self:Flush()
  return was
end

function Toast:Flush()
  if not self.current and #self.queue > 0 and not held() then self:Start(table.remove(self.queue, 1)) end
end

function Toast:Click(button)
  local spec = self.current
  local action = spec and (spec.action or (spec.kind == "medal" and "Medals" or nil))
  if button ~= "LeftButton" then return end
  if action == "Medals" and Addon.UI then Addon.UI:Show(); Addon.UI:SetActiveTab("Medals") end
  self:Finish()
end
