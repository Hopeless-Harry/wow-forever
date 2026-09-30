local Addon = MAMChronicles
local Counters = {}
Addon.Counters = Counters

-- Privacy-safe activity counters for the silly Mom Medals. Only integers per category are stored:
-- never item names, chat, locations or anything else. Counters stay on this computer.
local ARM_WINDOW = 2       -- seconds between pressing an item and the cast that confirms it
local REPEAT_WINDOW = 1.5  -- ignore the same item pressed again this quickly
local EVALUATE_DELAY = 5   -- batch medal checks after counting

Counters.handles = {
  UNIT_SPELLCAST_SUCCEEDED = true, UNIT_SPELLCAST_START = true, UNIT_SPELLCAST_CHANNEL_START = true,
  PLAYER_MOUNT_DISPLAY_CHANGED = true, PLAYER_FLAGS_CHANGED = true, PLAYER_UPDATE_RESTING = true, SCREENSHOT_SUCCEEDED = true,
}

local keywordSets = {
  { "wine", { "wine", "merlot", "chardonnay", "riesling", "pinot", "zinfandel" } },
  { "ale", { "ale", "beer", "lager", "stout", "mead", "grog", "rum", "whiskey", "whisky", "cider", "moonshine", "liquor", "brew" } },
  { "coffee", { "coffee", "tea", "cocoa", "espresso" } },
  { "food", { "stew", "cake", "pie", "bread", "cheese", "cookie", "cookies", "jerky", "sandwich", "soup", "feast", "roast", "pudding", "pastry", "muffin", "fruit", "apple", "steak", "biscuit", "pancake", "pancakes", "sausage", "fish", "meat", "tart", "pretzel" } },
  { "bandage", { "bandage" } },
  { "potion", { "potion", "elixir", "flask", "tonic" } },
}

local function safe(fn, ...) return Addon:SafeCall(fn, ...) end
local function clock() return GetTime and GetTime() or Addon:Now() end

-- Whole-word matching so "Whale" is not ale and "Steakhouse" is not steak.
function Counters:ClassifyItem(name)
  local lowered = string.lower(tostring(name or ""))
  local categories = {}
  for _, set in ipairs(keywordSets) do
    for _, word in ipairs(set[2]) do
      if lowered:find("%f[%a]" .. word .. "%f[%A]") then table.insert(categories, set[1]); break end
    end
  end
  return categories
end

function Counters:Add(name, amount)
  local database = Addon.db
  if not (database and Addon.characterKey) then return end
  database.counters = type(database.counters) == "table" and database.counters or {}
  local row = database.counters[Addon.characterKey] or {}
  database.counters[Addon.characterKey] = row
  row[name] = (row[name] or 0) + (amount or 1)
  if not Addon.Medals then return end
  if C_Timer and C_Timer.After then
    if self.evaluatePending then return end
    self.evaluatePending = true
    C_Timer.After(EVALUATE_DELAY, function() Counters.evaluatePending = false; Addon.Medals:Evaluate("counter") end)
  else
    Addon.Medals:Evaluate("counter")
  end
end

local function itemName(itemID)
  if C_Item and C_Item.GetItemNameByID then return safe(C_Item.GetItemNameByID, itemID) end
  return (safe(GetItemInfo, itemID))
end

-- Pressing an item does not prove it was used (it may be on cooldown), so it is only "armed" until
-- the player's next successful cast confirms it.
function Counters:Arm(itemID)
  if not itemID then return end
  local name = itemName(itemID)
  if not name then return end
  local categories = self:ClassifyItem(name)
  if #categories == 0 then return end
  local now = clock()
  if self.lastArmItem == itemID and now - (self.lastArmTime or -100) < REPEAT_WINDOW then return end
  self.lastArmItem, self.lastArmTime = itemID, now
  self.armed = { categories = categories, at = now }
end

function Counters:OnActionUsed(slot)
  local kind, id = safe(GetActionInfo, slot)
  if kind == "item" then self:Arm(id) end
end

function Counters:OnBagUsed(bag, slot)
  local info = C_Container and C_Container.GetContainerItemInfo and safe(C_Container.GetContainerItemInfo, bag, slot)
  if type(info) == "table" and info.itemID then self:Arm(info.itemID) end
end

function Counters:OnCast(unit)
  if unit ~= "player" or not self.armed then return end
  local armed = self.armed
  self.armed = nil
  if clock() - armed.at > ARM_WINDOW then return end
  for _, category in ipairs(armed.categories) do self:Add(category, 1) end
end

function Counters:OnEvent(eventName, ...)
  if eventName == "UNIT_SPELLCAST_SUCCEEDED" or eventName == "UNIT_SPELLCAST_START" or eventName == "UNIT_SPELLCAST_CHANNEL_START" then
    self:OnCast((...))
  elseif eventName == "PLAYER_MOUNT_DISPLAY_CHANGED" then
    local mounted = safe(IsMounted) and true or false
    if mounted and not self.mounted then self:Add("mounts", 1) end
    self.mounted = mounted
  elseif eventName == "PLAYER_FLAGS_CHANGED" then
    if (...) == "player" then
      local away = safe(UnitIsAFK, "player") and true or false
      if away and not self.away then self:Add("afk", 1) end
      self.away = away
    end
  elseif eventName == "PLAYER_UPDATE_RESTING" then
    local resting = safe(IsResting) and true or false
    if resting and not self.resting then self:Add("rest", 1) end
    self.resting = resting
  elseif eventName == "SCREENSHOT_SUCCEEDED" then
    self:Add("shots", 1)
  end
end

function Counters:Initialise()
  if self.initialised then return end
  self.initialised = true
  self.mounted = safe(IsMounted) and true or false
  self.away = safe(UnitIsAFK, "player") and true or false
  self.resting = safe(IsResting) and true or false
  if hooksecurefunc then
    pcall(hooksecurefunc, "UseAction", function(slot) Counters:OnActionUsed(slot) end)
    if C_Container and C_Container.UseContainerItem then
      pcall(hooksecurefunc, C_Container, "UseContainerItem", function(bag, slot) Counters:OnBagUsed(bag, slot) end)
    elseif UseContainerItem then
      pcall(hooksecurefunc, "UseContainerItem", function(bag, slot) Counters:OnBagUsed(bag, slot) end)
    end
    if JumpOrAscendStart then pcall(hooksecurefunc, "JumpOrAscendStart", function() Counters:Add("jumps", 1) end) end
  end
  local frame = Addon.eventFrame
  if not frame then return end
  for eventName in pairs(self.handles) do
    if eventName:find("^UNIT_SPELLCAST") and frame.RegisterUnitEvent then
      pcall(frame.RegisterUnitEvent, frame, eventName, "player")
    else
      pcall(frame.RegisterEvent, frame, eventName)
    end
  end
end
