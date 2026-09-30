local Addon = MAMChronicles
local Counters = {}
Addon.Counters = Counters

-- Privacy-safe activity counters for the silly Mom Medals. Counters are integers per category. Emote targets keep only a guildmate's lowercase first name and a count. Everything stays on this computer and is never sent or exported.
local ARM_WINDOW = 2         -- seconds between pressing an item and the cast that confirms it
local REPEAT_WINDOW = 1.5    -- ignore the same item pressed again this quickly
local EVALUATE_DELAY = 5     -- batch medal checks after counting
local EMOTE_DEBOUNCE = 0.3   -- the server throttles emotes too; DoEmote and PerformEmote may both fire
local EQUIP_GRACE = 10       -- ignore equipment changes right after entering the world
local MAX_EMOTE_TARGETS = 1000
local FALL_MEMORY = 1.5      -- how long after falling a death still counts as a fall

Counters.campSpellNames = {}
Counters.handles = {
  UNIT_SPELLCAST_SUCCEEDED = true, UNIT_SPELLCAST_START = true, UNIT_SPELLCAST_CHANNEL_START = true,
  PLAYER_MOUNT_DISPLAY_CHANGED = true, PLAYER_FLAGS_CHANGED = true, PLAYER_UPDATE_RESTING = true, SCREENSHOT_SUCCEEDED = true,
  PLAYER_EQUIPMENT_CHANGED = true, PLAYER_ENTERING_WORLD = true, GROUP_JOINED = true, GROUP_LEFT = true, READY_CHECK_CONFIRM = true,
}

local trackedEmotes = { SIT = true, SLEEP = true, STARE = true, FACEPALM = true, NO = true, THANK = true, HUG = true, DANCE = true, KISS = true, WAVE = true, CHEER = true, SPIT = true }

local keywordSets = {
  { "wine", { "wine", "merlot", "chardonnay", "riesling", "pinot", "zinfandel" } },
  { "ale", { "ale", "beer", "lager", "stout", "mead", "grog", "rum", "whiskey", "whisky", "cider", "moonshine", "liquor", "brew" } },
  { "coffee", { "coffee", "tea", "cocoa", "espresso" } },
  { "food", { "stew", "cake", "pie", "bread", "cheese", "cookie", "cookies", "jerky", "sandwich", "soup", "feast", "roast", "pudding", "pastry", "muffin", "fruit", "apple", "steak", "biscuit", "biscuits", "pancake", "pancakes", "sausage", "fish", "meat", "tart", "pretzel" } },
  { "cheese", { "cheese" } },
  { "cookie", { "cookie", "cookies", "biscuit", "biscuits" } },
  { "pie", { "pie", "tart", "pastry" } },
  { "soup", { "soup", "chowder", "broth", "stew" } },
  { "fish", { "fish", "salmon", "trout", "sushi", "eel", "bass" } },
  { "juice", { "juice", "lemonade", "nectar", "milk" } },
  { "water", { "water" } },
  { "bandage", { "bandage" } },
  { "potion", { "potion", "elixir", "flask", "tonic" } },
}

local function safe(fn, ...) return Addon:SafeCall(fn, ...) end
local function clock() return GetTime and GetTime() or Addon:Now() end

-- The jump key is handled by the game's own binding code, so hooking the Lua function JumpOrAscendStart never fires on
-- Retail (live result: hook installed, jumps stayed at 0). Jumps are therefore also detected by the character leaving the
-- ground. Walking off a ledge counts too; flying, swimming and taxi rides do not. A jump seen by both is counted once.
Counters.jumpSources = { hook = 0, ticker = 0 }
local JUMP_DEDUPE = 1.5

function Counters:CountJump(source)
  self.jumpSources[source] = self.jumpSources[source] + 1
  self:Add("jumps", 1)
end

function Counters:OnJumpHook()
  self.lastHookJump = clock()
  self:CountJump("hook")
end

function Counters:CheckGround()
  local falling = safe(IsFalling) and true or false
  if falling then self.lastFalling = clock() end
  if falling and not self.wasFalling then
    local airborne = (IsFlying and safe(IsFlying)) or (IsSwimming and safe(IsSwimming)) or (UnitOnTaxi and safe(UnitOnTaxi, "player"))
    local recentHook = self.lastHookJump and clock() - self.lastHookJump < JUMP_DEDUPE
    if not airborne and not recentHook then self:CountJump("ticker") end
  end
  self.wasFalling = falling
end

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
  amount = amount == nil and 1 or tonumber(amount)
  if not (amount and amount == amount and amount > 0 and amount < math.huge) then return end
  local row = database.counters[Addon.characterKey] or {}
  database.counters[Addon.characterKey] = row
  row[name] = math.min(1000000000, (row[name] or 0) + amount)
  local season = Addon.Medals and Addon.Medals.ActiveSeason and Addon.Medals:ActiveSeason()
  if season and season.counters[name] then
    local key = "season_" .. season.key
    row[key] = math.min(1000000000, (row[key] or 0) + amount)
  end
  if not Addon.Medals then return end
  if C_Timer and C_Timer.After then
    if self.evaluatePending then return end
    self.evaluatePending = true
    C_Timer.After(EVALUATE_DELAY, function() Counters.evaluatePending = false; Addon.Medals:Evaluate("counter") end)
  else
    Addon.Medals:Evaluate("counter")
  end
end

-- Some sources fire twice for one real action; count each key at most once per window.
-- `before` runs only when the action is counted and before medals are re-evaluated.
function Counters:AddOnce(name, window, before)
  local now = clock()
  self.lastAdd = self.lastAdd or {}
  if self.lastAdd[name] and now - self.lastAdd[name] < window then return false end
  self.lastAdd[name] = now
  if before then before() end
  self:Add(name, 1)
  return true
end

local function itemName(itemID)
  if C_Item and C_Item.GetItemNameByID then return safe(C_Item.GetItemNameByID, itemID) end
  return (Addon:GetItemInfo(itemID))
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

local function merchantOpen() return MerchantFrame and MerchantFrame.IsShown and MerchantFrame:IsShown() and true or false end

function Counters:OnActionUsed(slot)
  local kind, id = safe(GetActionInfo, slot)
  if kind == "item" then self:Arm(id) end
end

function Counters:OnBagUsed(bag, slot)
  if merchantOpen() then self:Add("sales", 1); return end  -- right-clicking a bag item at a vendor sells it
  local info = C_Container and C_Container.GetContainerItemInfo and safe(C_Container.GetContainerItemInfo, bag, slot)
  if type(info) == "table" and info.itemID then self:Arm(info.itemID) end
end

local function shortName(name) return (tostring(name or ""):match("^[^-]+")) or "" end

-- Who an emote was aimed at: a unit token ("target", "party1") or a character name. Only guildmates count.
function Counters:ResolveEmoteTarget(target)
  target = (type(target) == "string" and target ~= "") and target or "target"
  local name
  if safe(UnitExists, target) then
    if not safe(UnitIsPlayer, target) then return nil end
    local theirs, mine = safe(GetGuildInfo, target), safe(GetGuildInfo, "player")
    if not (theirs and mine and theirs == mine) then return nil end
    name = safe(UnitName, target)
  elseif Addon.Comms and Addon.Comms:IsGuildmate(target) then
    name = target
  end
  name = shortName(name)
  if name == "" or string.lower(name) == string.lower(shortName(safe(UnitName, "player"))) then return nil end
  return string.lower(name)
end

function Counters:RecordEmoteTarget(token, target)
  local database = Addon.db
  if not (database and Addon.characterKey) then return false end
  local name = self:ResolveEmoteTarget(target)
  if not name then return false end
  database.emoteTargets = type(database.emoteTargets) == "table" and database.emoteTargets or {}
  local character = database.emoteTargets[Addon.characterKey] or {}
  database.emoteTargets[Addon.characterKey] = character
  local row = type(character[token]) == "table" and character[token] or { distinct = 0, names = {} }
  character[token] = row
  row.names = type(row.names) == "table" and row.names or {}
  if not row.names[name] then
    if (tonumber(row.distinct) or 0) >= MAX_EMOTE_TARGETS then return false end
    row.distinct = (tonumber(row.distinct) or 0) + 1
  end
  row.names[name] = math.min(1000000, (row.names[name] or 0) + 1)
  return true
end

function Counters:OnEmote(token, target)
  token = string.upper(tostring(token or "")):gsub("^/", "")
  if not trackedEmotes[token] then return end
  self:AddOnce("emote_" .. string.lower(token), EMOTE_DEBOUNCE, function() self:RecordEmoteTarget(token, target) end)
end

function Counters:OnCast(unit)
  if unit ~= "player" or not self.armed then return end
  local armed = self.armed
  self.armed = nil
  if clock() - armed.at > ARM_WINDOW then return end
  for _, category in ipairs(armed.categories) do self:Add(category, 1) end
end

local function spellName(spellID)
  if not spellID then return nil end
  if C_Spell and C_Spell.GetSpellName then return safe(C_Spell.GetSpellName, spellID) end
  if C_Spell and C_Spell.GetSpellInfo then
    local info = safe(C_Spell.GetSpellInfo, spellID)
    return type(info) == "table" and info.name or nil
  end
  return nil
end

-- WoW Forever camping: campfire kits and profession objects are recognised by spell name. Only counts are kept;
-- the names of camp-related spells seen are listed in /mam diag so the keywords can be checked against the real client.
function Counters:OnSpell(spellID)
  local name = spellName(spellID)
  if type(name) ~= "string" then return end
  local lowered = string.lower(name)
  local isCamp = false
  if lowered:find("%f[%a]campfire%f[%A]") then
    isCamp = true
    self:Add("campfires", 1)
    if lowered:find("journeyman", 1, true) then self:Add("campfire_journeyman", 1) end
    if lowered:find("expert", 1, true) then self:Add("campfire_expert", 1) end
  elseif Addon.Medals then
    for _, object in ipairs(Addon.Medals.campObjects) do
      if lowered:find(object, 1, true) then
        isCamp = true
        self:Add("camp_objects", 1)
        Addon.Medals:AddToSet("campObjects", object)
        break
      end
    end
  end
  if isCamp or lowered:find("camp", 1, true) then
    self.campSpellsSeen = self.campSpellsSeen or {}
    if not self.campSpellsSeen[name] and #self.campSpellNames < 12 then
      self.campSpellsSeen[name] = true
      table.insert(self.campSpellNames, name)
    end
  end
end

function Counters:WasFalling()
  return self.lastFalling ~= nil and clock() - self.lastFalling < FALL_MEMORY
end

function Counters:OnEvent(eventName, ...)
  if eventName == "UNIT_SPELLCAST_SUCCEEDED" or eventName == "UNIT_SPELLCAST_START" or eventName == "UNIT_SPELLCAST_CHANNEL_START" then
    self:OnCast((...))
    if eventName == "UNIT_SPELLCAST_SUCCEEDED" then
      local unit, _, spellID = ...
      if unit == "player" then self:OnSpell(spellID) end
    end
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
  elseif eventName == "PLAYER_ENTERING_WORLD" then
    self.enteredAt = clock()
  elseif eventName == "PLAYER_EQUIPMENT_CHANGED" then
    if self.enteredAt and clock() - self.enteredAt >= EQUIP_GRACE then self:AddOnce("outfits", 0.5) end
  elseif eventName == "GROUP_JOINED" then
    self:AddOnce("groups", 2)
  elseif eventName == "GROUP_LEFT" then
    self:AddOnce("left", 2)
  elseif eventName == "READY_CHECK_CONFIRM" then
    local unit, isReady = ...
    if isReady and unit and safe(UnitIsUnit, unit, "player") then self:AddOnce("ready", 5) end
  end
end

function Counters:Initialise()
  if self.initialised then return end
  self.initialised = true
  self.hooked = {}
  self.mounted = safe(IsMounted) and true or false
  self.away = safe(UnitIsAFK, "player") and true or false
  self.resting = safe(IsResting) and true or false
  if hooksecurefunc then
    pcall(hooksecurefunc, "UseAction", function(slot) Counters:OnActionUsed(slot) end)
    self.hooked[#self.hooked + 1] = "UseAction"
    if C_Container and C_Container.UseContainerItem then
      if pcall(hooksecurefunc, C_Container, "UseContainerItem", function(bag, slot) Counters:OnBagUsed(bag, slot) end) then self.hooked[#self.hooked + 1] = "UseContainerItem" end
    elseif UseContainerItem then
      if pcall(hooksecurefunc, "UseContainerItem", function(bag, slot) Counters:OnBagUsed(bag, slot) end) then self.hooked[#self.hooked + 1] = "UseContainerItem" end
    end
    if JumpOrAscendStart and pcall(hooksecurefunc, "JumpOrAscendStart", function() Counters:OnJumpHook() end) then self.hooked[#self.hooked + 1] = "JumpOrAscendStart" end
    -- DoEmote is deprecated in 12.0 in favour of C_ChatInfo.PerformEmote: hook whichever exist.
    if C_ChatInfo and C_ChatInfo.PerformEmote and pcall(hooksecurefunc, C_ChatInfo, "PerformEmote", function(token, target) Counters:OnEmote(token, target) end) then self.hooked[#self.hooked + 1] = "PerformEmote" end
    if DoEmote and pcall(hooksecurefunc, "DoEmote", function(token, target) Counters:OnEmote(token, target) end) then self.hooked[#self.hooked + 1] = "DoEmote" end
    if RepairAllItems and pcall(hooksecurefunc, "RepairAllItems", function() if merchantOpen() then Counters:Add("repairs", 1) end end) then self.hooked[#self.hooked + 1] = "RepairAllItems" end
    if BuyMerchantItem and pcall(hooksecurefunc, "BuyMerchantItem", function() Counters:Add("purchases", 1) end) then self.hooked[#self.hooked + 1] = "BuyMerchantItem" end
    if C_MerchantFrame and C_MerchantFrame.SellAllJunkItems and pcall(hooksecurefunc, C_MerchantFrame, "SellAllJunkItems", function() Counters:Add("sales", 1) end) then self.hooked[#self.hooked + 1] = "SellAllJunkItems" end
  end
  local frame = Addon.eventFrame
  if frame then
    for eventName in pairs(self.handles) do
      if eventName:find("^UNIT_SPELLCAST") and frame.RegisterUnitEvent then
        pcall(frame.RegisterUnitEvent, frame, eventName, "player")
      else
        pcall(frame.RegisterEvent, frame, eventName)
      end
    end
  end
  -- Remember when the player was last falling, so a fatal landing can be recorded as a fall.
  if CreateFrame and IsFalling then
    local ticker, elapsed = CreateFrame("Frame"), 0
    ticker:SetScript("OnUpdate", function(_, step)
      elapsed = elapsed + step
      if elapsed >= 0.1 then
        elapsed = 0
        Counters:CheckGround()
      end
    end)
    self.ticker = ticker
  end
end
