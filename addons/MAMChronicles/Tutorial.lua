local Addon = MAMChronicles
local Tutorial = {}
Addon.Tutorial = Tutorial

-- A short guided tour, opened from the ? button in the window title bar, from /mam tutorial, and once automatically for
-- players who have not seen it. Each step can switch the Chronicle window to the page it is talking about.
local safeMethod = Addon.SafeMethod
local WIDTH, HEIGHT = 470, 236
local START_DELAY = 5

Tutorial.steps = {
  { title = "Welcome to Moms Against Magic Chronicles", tab = "Home",
    text = "This addon keeps a private diary of your adventures and turns everyday play into silly Mom Medals.\n\nThis short tour shows you around. You can open it again at any time with the ? button at the top of the window. Nothing here changes how the game plays." },
  { title = "Home: your summary", tab = "Home",
    text = "Home is the quick look: your totals, your latest moments and the goals you are working on.\n\nStart here whenever you log in." },
  { title = "Chronicle: your timeline", tab = "Chronicle",
    text = "Chronicle lists what happened: levels, deaths, quests, new places and loot.\n\nUse Search and the filter buttons to find things. Type /mam remember followed by some text to pin a memory of your own." },
  { title = "Medals: play to earn", tab = "Medals",
    text = "Medals are earned just by playing: drinks, jumps, dungeons with friends and much more.\n\n\"Next up\" shows the closest ones. Click a medal to pin it as a goal (up to six). Shift-click a medal you have earned to share it in chat." },
  { title = "Goal tracker", tab = "Home",
    text = "Your pinned goals and this week's Mom Quests also appear in a small window you can drag anywhere on screen.\n\nRight-click a row to unpin it. Hide or lock the window in Settings, or type /mam tracker." },
  { title = "Statistics", tab = "Statistics",
    text = "Statistics shows your month at a glance and how quickly you are levelling, including about how much play is left until the level cap." },
  { title = "Guild and Map", tab = "Guild",
    text = "Guild shows a leaderboard of guildmates who use the addon, and the medals they earned recently. The Map tab shows guildmates who share their location; click a name to find them.\n\nSharing is optional. You can switch it off in Settings." },
  { title = "Settings", tab = "Settings",
    text = "Settings has a list of categories on the left and a search box. Point at any option to read what it does on the right.\n\nIf the window feels like too much, turn on Simple view to show only the main tabs." },
  { title = "Handy extras", tab = "Home",
    text = "Type /mam help to see every command. /mam mute holds pop-ups for a while when you want to concentrate, and you can set a key under Key Bindings.\n\nClick the ? button any time to see this tour again. Have fun!" },
}

local function settings() return Addon.db and Addon.db.settings or nil end

function Tutorial:Count() return #self.steps end

function Tutorial:CreateFrame()
  if self.frame then return self.frame end
  if not CreateFrame then return nil end
  local T = Addon.Theme; local C = T.colors
  local frame = CreateFrame("Frame", "MAMChroniclesTutorial", UIParent, "BackdropTemplate")
  safeMethod(frame, "SetSize", WIDTH, HEIGHT)
  safeMethod(frame, "SetFrameStrata", "DIALOG")
  safeMethod(frame, "SetClampedToScreen", true)
  safeMethod(frame, "SetMovable", true); safeMethod(frame, "EnableMouse", true); safeMethod(frame, "RegisterForDrag", "LeftButton")
  safeMethod(frame, "SetScript", "OnDragStart", function(f) safeMethod(f, "StartMoving") end)
  safeMethod(frame, "SetScript", "OnDragStop", function(f) safeMethod(f, "StopMovingOrSizing") end)
  T:Window(frame)
  frame.heading = T:Text(frame, "GameFontNormalLarge")
  safeMethod(frame.heading, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 20, -18); safeMethod(frame.heading, "SetWidth", WIDTH - 130); safeMethod(frame.heading, "SetJustifyH", "LEFT")
  safeMethod(frame.heading, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
  frame.counter = T:Text(frame, "GameFontDisableSmall")
  safeMethod(frame.counter, "SetPoint", "TOPRIGHT", frame, "TOPRIGHT", -20, -22)
  frame.body = T:Text(frame, "GameFontHighlight")
  safeMethod(frame.body, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 20, -56); safeMethod(frame.body, "SetWidth", WIDTH - 40)
  safeMethod(frame.body, "SetJustifyH", "LEFT"); safeMethod(frame.body, "SetJustifyV", "TOP"); safeMethod(frame.body, "SetWordWrap", true)
  frame.back = T:Button(frame, "Back", 90, 26)
  safeMethod(frame.back, "SetPoint", "BOTTOMLEFT", frame, "BOTTOMLEFT", 20, 16)
  safeMethod(frame.back, "SetScript", "OnClick", function() Tutorial:Go((Tutorial.step or 1) - 1) end)
  frame.skip = T:Button(frame, "Skip tour", 100, 26)
  safeMethod(frame.skip, "SetPoint", "LEFT", frame.back, "RIGHT", 10, 0)
  safeMethod(frame.skip, "SetScript", "OnClick", function() Tutorial:Close() end)
  frame.nextButton = T:Button(frame, "Next", 110, 26)
  safeMethod(frame.nextButton, "SetPoint", "BOTTOMRIGHT", frame, "BOTTOMRIGHT", -20, 16)
  safeMethod(frame.nextButton, "SetScript", "OnClick", function()
    if (Tutorial.step or 1) >= Tutorial:Count() then Tutorial:Close() else Tutorial:Go((Tutorial.step or 1) + 1) end
  end)
  safeMethod(frame, "Hide")
  self.frame = frame
  return frame
end

function Tutorial:Place()
  local frame, UI = self.frame, Addon.UI
  if not frame then return end
  safeMethod(frame, "ClearAllPoints")
  -- Sits just under the Chronicle window so the page being described stays visible.
  if UI and UI.frame then safeMethod(frame, "SetPoint", "TOP", UI.frame, "BOTTOM", 0, -8) else safeMethod(frame, "SetPoint", "CENTER", UIParent, "CENTER", 0, 0) end
end

function Tutorial:Go(step)
  local frame = self:CreateFrame()
  if not frame then return false end
  step = math.max(1, math.min(self:Count(), tonumber(step) or 1))
  self.step = step
  local data = self.steps[step]
  safeMethod(frame.heading, "SetText", data.title)
  safeMethod(frame.body, "SetText", data.text)
  safeMethod(frame.counter, "SetText", "Step " .. step .. " of " .. self:Count())
  safeMethod(frame.nextButton, "SetText", step >= self:Count() and "Done" or "Next")
  safeMethod(frame.back, step == 1 and "Hide" or "Show")
  safeMethod(frame.skip, step >= self:Count() and "Hide" or "Show")
  local UI = Addon.UI
  if UI and data.tab then
    if UI.Show then UI:Show() end
    if UI.SetActiveTab then UI:SetActiveTab(data.tab) end
  end
  self:Place()
  safeMethod(frame, "Show")
  return true
end

function Tutorial:Open(step)
  return self:Go(step or 1)
end

-- Closing (finished or skipped) counts as seen, so it is not offered again on its own.
function Tutorial:Close()
  local config = settings()
  if config then config.tutorialSeen = true end
  if self.frame then safeMethod(self.frame, "Hide") end
  self.step = nil
end

function Tutorial:IsOpen() return self.frame ~= nil and self.frame.IsShown ~= nil and self.frame:IsShown() == true end

-- First time only: wait a few seconds after login, and never interrupt combat.
function Tutorial:MaybeStart()
  local config = settings()
  if not config or config.tutorialSeen == true or self:IsOpen() then return false end
  if Addon:InCombat() then return false end
  return self:Open(1)
end

function Tutorial:Schedule()
  local config = settings()
  if not config or config.tutorialSeen == true then return end
  if C_Timer and C_Timer.After then C_Timer.After(START_DELAY, function() Addon:Guard("Tutorial", Tutorial.MaybeStart, Tutorial) end) end
end
