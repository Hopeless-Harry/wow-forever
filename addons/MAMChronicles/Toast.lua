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

local function safeMethod(object, method, ...)
  if object and type(object[method]) == "function" then return pcall(object[method], object, ...) end
end

local function inCombat() return InCombatLockdown and InCombatLockdown() and true or false end

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
    self:Show({ title = "Level " .. tostring(event.payload.level) .. " reached!", text = "Recorded in your Chronicle.", kind = "info" })
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
  if self.current or inCombat() then enqueue(self, spec); return "queued" end
  self:Start(spec)
  return "shown"
end

function Toast:CreateFrame()
  if self.frame then return self.frame end
  local T = Addon.Theme; local C = T.colors
  local frame = CreateFrame("Frame", "MAMChroniclesToast", UIParent, "BackdropTemplate")
  safeMethod(frame, "SetSize", 340, 66); safeMethod(frame, "SetFrameStrata", "FULLSCREEN_DIALOG"); safeMethod(frame, "EnableMouse", true)
  T:Panel(frame, C.panel, C.border)
  self.stripe = frame:CreateTexture(nil, "ARTWORK")
  safeMethod(self.stripe, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 0, 0); safeMethod(self.stripe, "SetPoint", "BOTTOMLEFT", frame, "BOTTOMLEFT", 0, 0); safeMethod(self.stripe, "SetWidth", 5)
  local icon = frame:CreateTexture(nil, "ARTWORK")
  safeMethod(icon, "SetTexture", ICON); safeMethod(icon, "SetSize", 34, 34); safeMethod(icon, "SetPoint", "LEFT", frame, "LEFT", 14, 0)
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

function Toast:Start(spec)
  local frame = self:CreateFrame()
  local T = Addon.Theme; local C = T.colors
  self.current, self.phase, self.timer = spec, "in", 0
  local colour = spec.kind == "medal" and C.gold or (spec.kind == "guild" and T.kindColors.instance or C.accent)
  safeMethod(self.stripe, "SetColorTexture", colour[1], colour[2], colour[3], 1)
  safeMethod(self.title, "SetText", spec.title or ""); safeMethod(self.body, "SetText", spec.text or "")
  safeMethod(self.points, "SetText", spec.points and ("+" .. tostring(spec.points) .. " Mom Money") or "")
  self:Render()
  safeMethod(frame, "Show")
  local settings = Addon.db and Addon.db.settings
  if settings and settings.toastSound and PlaySound then
    pcall(PlaySound, SOUNDKIT and SOUNDKIT.ACHIEVEMENT_MENU_OPEN or 888)
  end
end

function Toast:Render()
  if not (self.frame and self.current) then return end
  local phase, progress = self.phase, self.timer / DURATIONS[self.phase]
  local alpha, offset = 1, -110
  if phase == "in" then alpha = progress; offset = -110 + (1 - progress) * 50
  elseif phase == "out" then alpha = 1 - progress end
  safeMethod(self.frame, "SetAlpha", math.max(0, math.min(1, alpha)))
  safeMethod(self.frame, "ClearAllPoints"); safeMethod(self.frame, "SetPoint", "TOP", UIParent, "TOP", 0, offset)
end

function Toast:Finish()
  self.current, self.phase, self.timer = nil, nil, 0
  safeMethod(self.frame, "Hide")
  if #self.queue > 0 and not inCombat() then self:Start(table.remove(self.queue, 1)) end
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

function Toast:Flush()
  if not self.current and #self.queue > 0 and not inCombat() then self:Start(table.remove(self.queue, 1)) end
end

function Toast:Click(button)
  local spec = self.current
  local action = spec and (spec.action or (spec.kind == "medal" and "Medals" or nil))
  if button ~= "LeftButton" then return end
  if action == "Medals" and Addon.UI then Addon.UI:Show(); Addon.UI:SetActiveTab("Medals") end
  self:Finish()
end
