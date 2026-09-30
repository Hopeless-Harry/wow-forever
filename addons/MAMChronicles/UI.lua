local Addon=MAMChronicles
Addon.UI=Addon.UI or {}
local UI=Addon.UI

UI.tabs={"Home","Chronicle","Statistics","Settings","Diagnostics"}
UI.filters={"All","Deaths","Quests","World","Instances","Loot","Memories"}
UI.dateRanges={"All","30 Days","This Month"}
UI.activeTab="Home"; UI.activeFilter="All"; UI.activeRange="All"; UI.search=""; UI.rowPool={}

local validTabs={Home=true,Chronicle=true,Statistics=true,Settings=true,Diagnostics=true}
local groups={
  Deaths={ ["character.death"]=true,["character.resurrected"]=true },
  Quests={ ["quest.accepted"]=true,["quest.completed"]=true },
  World={ ["world.zone_discovered"]=true },
  Instances={ ["instance.entered"]=true,["instance.exited"]=true },
  Loot={ ["loot.notable"]=true }, Memories={ ["memory.manual"]=true },
}
local function label(event)
  local p=event.payload or {}; return p.text or p.questName or p.itemName or p.achievementName or p.professionName or p.zone or p.instanceName or event.type
end
UI.EventLabel=label
local function safeMethod(object,method,...)
  if object and type(object[method])=="function" then pcall(object[method],object,...) end
end
local function finite(value) return type(value)=="number" and value==value and value~=math.huge and value~=-math.huge end
local function clamp(value,minimum,maximum) return math.max(minimum,math.min(maximum,value)) end

function UI:SetActiveTab(name)
  if not validTabs[name] then return false end
  self.activeTab=name; self.textOffset=0
  if Addon.db and Addon.db.settings and Addon.db.settings.ui then Addon.db.settings.ui.activeTab=name end
  self:Refresh()
  return true
end

function UI:UpdateTabStates()
  for index,name in ipairs(self.tabs) do
    local button=self.tabButtons and self.tabButtons[index]
    if button then
      if name==self.activeTab then safeMethod(button,"LockHighlight"); safeMethod(button,"SetEnabled",false)
      else safeMethod(button,"UnlockHighlight"); safeMethod(button,"SetEnabled",true) end
      if Addon.Theme then Addon.Theme:SetSelected(button,name==self.activeTab) end
    end
  end
end

function UI:SetTimelineOffset(offset,total)
  total=math.max(0,tonumber(total) or 0)
  local maximum=math.max(0,total-30)
  local value=tonumber(offset) or 0
  if not finite(value) then value=0 end
  self.timelineOffset=math.max(0,math.min(maximum,math.floor(value)))
  self:UpdateNavigation(total)
  return self.timelineOffset
end

function UI:UpdateNavigation(total)
  total=math.max(0,tonumber(total) or 0)
  local maximum=math.max(0,total-30); local offset=self.timelineOffset or 0
  self.timelineTotal=total
  if Addon.Theme then Addon.Theme:SetEnabled(self.previousButton,offset>0); Addon.Theme:SetEnabled(self.nextButton,offset<maximum)
  else safeMethod(self.previousButton,"SetEnabled",offset>0); safeMethod(self.nextButton,"SetEnabled",offset<maximum) end
  if self.slider then
    self.updatingSlider=true
    safeMethod(self.slider,"SetMinMaxValues",0,maximum); safeMethod(self.slider,"SetValue",offset)
    self.updatingSlider=false
  end
end

function UI:CloseMenu() if self.menu then safeMethod(self.menu,"Hide") end end

function UI:OpenMenu(anchor,options,current,onSelect)
  self:Create()
  if self.menu.shown and self.menuOptions==options then self:CloseMenu(); return end
  self.menuOptions=options
  for index,button in ipairs(self.menuButtons) do
    local value=options[index]
    if value then
      button.value=value; safeMethod(button,"SetText",(value==current and "> " or "")..value)
      button.text=value; safeMethod(button,"SetScript","OnClick",function() onSelect(value) end); safeMethod(button,"Show")
    else button.value=nil; safeMethod(button,"Hide") end
  end
  safeMethod(self.menu,"ClearAllPoints"); safeMethod(self.menu,"SetPoint","TOPLEFT",anchor or self.frame,"BOTTOMLEFT",0,-2)
  safeMethod(self.menu,"SetSize",130,#options*22+8); safeMethod(self.menu,"Show")
end

function UI:OpenFilterMenu(anchor) self:OpenMenu(anchor,self.filters,self.activeFilter,function(value) UI:SelectFilter(value) end) end
function UI:OpenRangeMenu(anchor) self:OpenMenu(anchor,self.dateRanges,self.activeRange,function(value) UI:SelectRange(value) end) end

local function contains(list,value) for _,item in ipairs(list) do if item==value then return true end end return false end

function UI:SelectFilter(value)
  if not contains(self.filters,value) then return false end
  self.activeFilter=value; self.timelineOffset=0; safeMethod(self.filterButton,"SetText","Filter: "..value); self.filterButton.text="Filter: "..value
  self:CloseMenu(); self:Refresh(); return true
end

function UI:SelectRange(value)
  if not contains(self.dateRanges,value) then return false end
  self.activeRange=value; self.timelineOffset=0; safeMethod(self.rangeButton,"SetText","Range: "..value); self.rangeButton.text="Range: "..value
  self:CloseMenu(); self:Refresh(); return true
end

local function attachTooltip(control,title,instruction)
  local function enter(owner)
    if not GameTooltip then return end
    safeMethod(GameTooltip,"SetOwner",owner,"ANCHOR_RIGHT"); safeMethod(GameTooltip,"SetText",title); safeMethod(GameTooltip,"AddLine",instruction); safeMethod(GameTooltip,"Show")
  end
  local function leave() if GameTooltip then safeMethod(GameTooltip,"Hide") end end
  -- HookScript keeps the flat-button hover highlight that the theme installed.
  if control and type(control.HookScript)=="function" then
    pcall(control.HookScript,control,"OnEnter",enter); pcall(control.HookScript,control,"OnLeave",leave)
  else
    safeMethod(control,"SetScript","OnEnter",enter); safeMethod(control,"SetScript","OnLeave",leave)
  end
end

function UI:SaveWindowState()
  if not self.frame or not Addon.db or not Addon.db.settings then return false end
  local ok,point,_,_,x,y=pcall(self.frame.GetPoint,self.frame,1)
  if not ok or not validTabs[self.activeTab] then return false end
  local width=self.frame.GetWidth and self.frame:GetWidth(); local height=self.frame.GetHeight and self.frame:GetHeight()
  if type(point)~="string" or not finite(x) or not finite(y) or not finite(width) or not finite(height) then return false end
  local ui=Addon.db.settings.ui
  ui.point=point; ui.x=clamp(x,-10000,10000); ui.y=clamp(y,-10000,10000)
  ui.width=clamp(width,620,1600); ui.height=clamp(height,440,1200); ui.activeTab=self.activeTab
  Addon.db.meta.updatedAt=Addon:Now()
  return true
end

function UI:RestoreWindowState()
  if not self.frame or not Addon.db or not Addon.db.settings then return false end
  Addon.Database:NormaliseSettings()
  local ui=Addon.db.settings.ui; self.activeTab=ui.activeTab
  safeMethod(self.frame,"ClearAllPoints"); safeMethod(self.frame,"SetSize",ui.width,ui.height)
  safeMethod(self.frame,"SetPoint",ui.point,UIParent,ui.point,ui.x,ui.y); safeMethod(self.frame,"SetUserPlaced",true); safeMethod(self.frame,"SetClampedToScreen",true)
  return true
end

function UI:ResetWindow()
  if not Addon.db or not Addon.db.settings then return false end
  local minimapAngle=Addon.db.settings.ui and Addon.db.settings.ui.minimapAngle
  Addon.Database:ResetUIState()
  if finite(minimapAngle) then Addon.db.settings.ui.minimapAngle=minimapAngle end
  self.activeTab="Home"; self:RestoreWindowState(); self:Refresh()
  return true
end

function UI:Toggle()
  self:Create()
  if self.frame.IsShown and self.frame:IsShown() then self:Hide() else self:Show() end
end

function UI:GetCurrentMonthRange()
  local current=Addon:Now(); local dateFn=date or (os and os.date); local timeFn=time or (os and os.time)
  if not dateFn or not timeFn then return current-2678400,current end
  local parts=dateFn("*t",current); return timeFn({year=parts.year,month=parts.month,day=1,hour=0,min=0,sec=0,isdst=parts.isdst}),current
end

function UI:FormatEventDetails(event)
  if type(event)~="table" then return "Select an entry to inspect its details." end
  local lines={event.type or "unknown","Occurred: "..tostring(event.occurredAt or "unknown"),"Event ID: "..tostring(event.id or "unknown")}
  local fields={"questID","questName","itemID","itemName","quality","quantity","zone","subzone","mapID","x","y","instanceName","instanceType","level","professionID","professionName","skillLevel","maxSkillLevel","achievementID","achievementName","points","text","lastHostileTarget","deathKind"}
  for _,key in ipairs(fields) do local value=event.payload and event.payload[key]; if value~=nil then table.insert(lines,key..": "..tostring(value)) end end
  return table.concat(lines,"\n")
end

function UI:BuildTimeline(options)
  options=options or {}; local filter=options.filter or self.activeFilter or "All"
  local fromTime,toTime=options.fromTime,options.toTime
  if fromTime==nil and toTime==nil then
    if self.activeRange=="30 Days" then fromTime=Addon:Now()-2678400
    elseif self.activeRange=="This Month" and date and time then local parts=date("*t",Addon:Now()); parts.day,parts.hour,parts.min,parts.sec=1,0,0,0; fromTime=time(parts) end
  end
  local source=Addon.EventStore:Query({text=options.search or self.search,fromTime=fromTime,toTime=toTime}); if filter=="All" then return source end
  local result={}; for _,event in ipairs(source) do if groups[filter] and groups[filter][event.type] then table.insert(result,event) end end return result
end

function UI:GetVisibleTimeline()
  local events=self:BuildTimeline(); local offset=self:SetTimelineOffset(self.timelineOffset,#events)
  local result={}; for index=offset+1,math.min(offset+30,#events) do table.insert(result,events[index]) end return result,#events
end

local booleanSettings={enabled=true,recordCoordinates=true,recordQuestAccepts=true,recordStatistics=true,recordGoldStatistics=true,toastsEnabled=true,toastSound=true,announceMedals=true,announceGuildChat=true,receiveGuildAlerts=true}
function UI:SetSetting(key,value)
  if key=="showMinimapButton" and Addon.SettingsPanel then return Addon.SettingsPanel:ApplySetting(key,value==true) end
  local settings=Addon.db.settings
  if key=="theme" then
    if not (Addon.Theme and Addon.Theme.presets[value]) then return false end
    settings.theme=value; Addon.db.meta.updatedAt=Addon:Now(); return true
  elseif key=="windowAlpha" then
    settings.windowAlpha=math.max(0.3,math.min(1,math.floor((tonumber(value) or 1)*100+0.5)/100)); Addon.db.meta.updatedAt=Addon:Now()
    self:ApplyAppearance(); return true
  elseif key=="notableQuality" then value=math.max(4,math.min(5,tonumber(value) or 4))
  elseif key=="maxEvents" then value=math.max(100,math.min(10000,math.floor(tonumber(value) or 10000)))
  elseif booleanSettings[key] then value=value==true
  else return false end
  settings[key]=value; Addon.db.meta.updatedAt=Addon:Now()
  if key=="recordGoldStatistics" and not value and Addon.AchievementStats then Addon.AchievementStats:PurgeGold() end
  return true
end

local ROW_TOP, FOOTER, SIDE, DETAILS_W, ROW_COUNT = 130, 46, 16, 250, 30
local ICON = "Interface\\AddOns\\MAMChronicles\\MAMChroniclesIcon"

local function clampNumber(value, low, high) return math.max(low, math.min(high, value)) end

function UI:LayoutRows(availableHeight)
  local pitch = clampNumber(math.floor((tonumber(availableHeight) or 0) / ROW_COUNT), 13, 20)
  if self.frame and self.rowButtons then
    for index, row in ipairs(self.rowButtons) do
      local offset = -(ROW_TOP + (index - 1) * pitch)
      safeMethod(row, "ClearAllPoints")
      safeMethod(row, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", SIDE, offset)
      safeMethod(row, "SetPoint", "TOPRIGHT", self.frame, "TOPRIGHT", -(SIDE + DETAILS_W + 24), offset)
      safeMethod(row, "SetHeight", pitch)
    end
  end
  self.rowPitch = pitch
  return pitch
end

local TEXT_SCROLLBAR = 18

local function estimateTextHeight(text, width)
  local lines = 0
  for line in (tostring(text or "") .. "\n"):gmatch("(.-)\n") do lines = lines + math.max(1, math.ceil(#line / math.max(20, width / 7))) end
  return lines * 14 + 24
end

function UI:TextViewHeight()
  local height = self.layoutHeight or (self.frame and self.frame.GetHeight and self.frame:GetHeight()) or 560
  if not height or height <= 0 then height = 560 end
  return math.max(40, height - (self.textTop or 84) - FOOTER - 4)
end

function UI:SetTextScroll(value)
  local target = clampNumber(tonumber(value) or 0, 0, self.textRange or 0)
  self.textOffset = target
  safeMethod(self.textScroll, "SetVerticalScroll", target)
  self.updatingTextSlider = true; safeMethod(self.textSlider, "SetValue", target); self.updatingTextSlider = false
end

function UI:ScrollText(delta) self:SetTextScroll((self.textOffset or 0) + delta) end

function UI:UpdateTextScroll()
  if not self.textScroll then return end
  local view, width = self:TextViewHeight(), self.textWidth or 700
  local contentHeight
  if self.copyShown then
    contentHeight = estimateTextHeight(self.copyText, width)
    safeMethod(self.copyBox, "SetSize", width, math.max(view, contentHeight))
  else
    local ok, measured = pcall(self.content.GetStringHeight, self.content)
    contentHeight = (ok and tonumber(measured) or 0) + 16
  end
  local range = math.max(0, contentHeight - view)
  self.textRange = range
  safeMethod(self.textChild, "SetSize", width, math.max(contentHeight, view))
  self.updatingTextSlider = true; safeMethod(self.textSlider, "SetMinMaxValues", 0, range); self.updatingTextSlider = false
  self:SetTextScroll(self.textOffset or 0)
  safeMethod(self.textSlider, (self.textVisible and range > 0) and "Show" or "Hide")
end

function UI:ApplyLayout(width, height)
  width = tonumber(width) or 780; height = tonumber(height) or 560
  self.textWidth = width - SIDE * 2 - TEXT_SCROLLBAR; self.layoutHeight = height
  safeMethod(self.content, "SetWidth", self.textWidth); safeMethod(self.copyBox, "SetWidth", self.textWidth)
  self:LayoutRows(height - ROW_TOP - FOOTER)
  if self.dashboard then self.dashboard:Layout(width - SIDE * 2, height - 84 - FOOTER - 4) end
  self:UpdateTextScroll(); self:UpdateSettingsScroll()
end

function UI:SetDetailsVisible(visible)
  local method = visible and "Show" or "Hide"
  safeMethod(self.detailsPanel, method); safeMethod(self.details, method)
end

function UI:SetToolbarVisible(visible)
  local method = visible and "Show" or "Hide"
  safeMethod(self.searchBox, method); safeMethod(self.filterButton, method); safeMethod(self.rangeButton, method)
  if not visible then safeMethod(self.searchHint, "Hide") elseif (self.search or "") == "" then safeMethod(self.searchHint, "Show") end
end

function UI:PlaceContent(belowToolbar)
  self.textTop = belowToolbar and 112 or 84
  safeMethod(self.textScroll, "ClearAllPoints")
  safeMethod(self.textScroll, "SetPoint", "TOPLEFT", self.frame, "TOPLEFT", SIDE, -self.textTop)
  safeMethod(self.textScroll, "SetPoint", "BOTTOMRIGHT", self.frame, "BOTTOMRIGHT", -(SIDE + TEXT_SCROLLBAR), FOOTER + 4)
  safeMethod(self.textSlider, "ClearAllPoints")
  safeMethod(self.textSlider, "SetPoint", "TOPRIGHT", self.frame, "TOPRIGHT", -SIDE, -self.textTop)
  safeMethod(self.textSlider, "SetPoint", "BOTTOMRIGHT", self.frame, "BOTTOMRIGHT", -SIDE, FOOTER + 4)
end

function UI:ShowTextArea(copy)
  self.copyShown = copy and true or false; self.textVisible = true
  safeMethod(self.textScroll, "Show"); self:UpdateTextScroll()
end

function UI:ColouriseStatistics(text)
  local T = Addon.Theme; local groups = {}
  if Addon.AchievementStats then for _, name in ipairs(Addon.AchievementStats.groupOrder) do groups[name] = true end end
  local lines = {}
  for line in (text .. "\n"):gmatch("(.-)\n") do
    local head, rest = line:match("^(Lifetime statistics)(.*)$")
    if head then line = T:Colorize(head, T.colors.gold) .. T:Colorize(rest, T.colors.muted)
    elseif line == "Moms Against Magic Chronicles" or groups[line] then line = T:Colorize(line, T.colors.gold)
    elseif line:match("^  %+") then line = T:Colorize(line, T.kindColors.world)
    elseif line:match("^Changes shown") or line:match("^Coverage") or line:match("^Reporting window") then line = T:Colorize(line, T.colors.muted) end
    table.insert(lines, line)
  end
  return table.concat(lines, "\n")
end

function UI:FillRow(index, event)
  local T = Addon.Theme; local row = self.rowButtons[index]
  local kindName, color = T:DescribeType(event.type)
  local stamp = date and date("%d %b %H:%M", event.occurredAt) or tostring(event.occurredAt)
  safeMethod(row.timeText, "SetText", stamp)
  safeMethod(row.kindText, "SetText", kindName); safeMethod(row.kindText, "SetTextColor", color[1], color[2], color[3], 1)
  safeMethod(row.stripe, "SetColorTexture", color[1], color[2], color[3], 1)
  safeMethod(self.rowPool[index], "SetText", tostring(label(event)))
  row.event = event
  safeMethod(row.selected, self.selectedEvent == event and "Show" or "Hide")
  safeMethod(self.rowPool[index], "Show"); safeMethod(row, "Show")
end

local function createRow(self, frame, index)
  local T = Addon.Theme; local C = T.colors
  local row = CreateFrame("Button", nil, frame)
  local zebra = row:CreateTexture(nil, "BACKGROUND")
  safeMethod(zebra, "SetAllPoints", row); safeMethod(zebra, "SetColorTexture", 1, 1, 1, index % 2 == 0 and C.stripe[4] or 0)
  row.hover = row:CreateTexture(nil, "BACKGROUND"); safeMethod(row.hover, "SetAllPoints", row); safeMethod(row.hover, "SetColorTexture", C.hover[1], C.hover[2], C.hover[3], 0.7); safeMethod(row.hover, "Hide")
  row.selected = row:CreateTexture(nil, "BACKGROUND"); safeMethod(row.selected, "SetAllPoints", row); safeMethod(row.selected, "SetColorTexture", C.gold[1], C.gold[2], C.gold[3], 0.14); safeMethod(row.selected, "Hide")
  row.stripe = row:CreateTexture(nil, "ARTWORK")
  safeMethod(row.stripe, "SetPoint", "TOPLEFT", row, "TOPLEFT", 0, -1); safeMethod(row.stripe, "SetPoint", "BOTTOMLEFT", row, "BOTTOMLEFT", 0, 1); safeMethod(row.stripe, "SetWidth", 3)
  safeMethod(row.stripe, "SetColorTexture", C.muted[1], C.muted[2], C.muted[3], 1)
  row.timeText = row:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
  safeMethod(row.timeText, "SetPoint", "LEFT", row, "LEFT", 10, 0); safeMethod(row.timeText, "SetWidth", 84); safeMethod(row.timeText, "SetJustifyH", "LEFT"); safeMethod(row.timeText, "SetTextColor", C.muted[1], C.muted[2], C.muted[3], 1)
  row.kindText = row:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
  safeMethod(row.kindText, "SetPoint", "LEFT", row.timeText, "RIGHT", 4, 0); safeMethod(row.kindText, "SetWidth", 82); safeMethod(row.kindText, "SetJustifyH", "LEFT")
  local text = row:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  safeMethod(text, "SetPoint", "LEFT", row.kindText, "RIGHT", 4, 0); safeMethod(text, "SetPoint", "RIGHT", row, "RIGHT", -6, 0); safeMethod(text, "SetJustifyH", "LEFT"); safeMethod(text, "SetWordWrap", false)
  safeMethod(text, "SetTextColor", C.text[1], C.text[2], C.text[3], 1)
  self.rowPool[index] = text
  safeMethod(row, "SetScript", "OnEnter", function(r) safeMethod(r.hover, "Show") end)
  safeMethod(row, "SetScript", "OnLeave", function(r) safeMethod(r.hover, "Hide") end)
  safeMethod(row, "SetScript", "OnClick", function(clicked)
    if not clicked.event then return end
    UI.selectedEvent = clicked.event
    for _, other in ipairs(UI.rowButtons) do safeMethod(other.selected, other.event == clicked.event and "Show" or "Hide") end
    safeMethod(UI.details, "SetText", UI:FormatEventDetails(clicked.event))
  end)
  safeMethod(row, "Hide")
  return row
end

function UI:ApplyAppearance()
  if not (self.frame and Addon.Theme and Addon.db) then return end
  local C, alpha = Addon.Theme.colors, Addon.db.settings.windowAlpha or 1
  safeMethod(self.bgFill, "SetColorTexture", C.bg[1], C.bg[2], C.bg[3], alpha)
  safeMethod(self.frame, "SetBackdropColor", C.bg[1], C.bg[2], C.bg[3], alpha)
end

function UI:SyncSettingsControls()
  if not (self.settingChecks and Addon.db) then return end
  local settings, T = Addon.db.settings, Addon.Theme
  for key, check in pairs(self.settingChecks) do safeMethod(check, "SetChecked", settings[key] == true) end
  for index, button in ipairs(self.themeButtons or {}) do T:SetSelected(button, T.presetOrder[index] == settings.theme) end
  if self.alphaSlider then
    self.syncingSettings = true
    safeMethod(self.alphaSlider, "SetValue", math.floor((1 - (settings.windowAlpha or 1)) * 100 + 0.5))
    self.syncingSettings = false
  end
  safeMethod(self.alphaValue, "SetText", tostring(math.floor((1 - (settings.windowAlpha or 1)) * 100 + 0.5)) .. "% transparent")
  local pending = settings.theme ~= T.current
  T:SetEnabled(self.applyThemeButton, pending)
  safeMethod(self.themeNote, "SetText", pending and "Saved. Apply to reload the interface with this theme." or "")
end

function UI:UpdateSettingsScroll()
  if not self.settingsArea then return end
  local view = self:TextViewHeight()
  self.settingsArea:Update(self.settingsHeight or 700, view, (self.textWidth or 700))
end

function UI:ShowSettingsPage()
  local area = self.settingsArea
  area:Place(self.frame, 84, FOOTER + 4, SIDE, TEXT_SCROLLBAR); area:Show()
  for _, control in ipairs(self.settingControls) do safeMethod(control, "Show") end
  self:SyncSettingsControls(); self:UpdateSettingsScroll()
end

function UI:BuildSettingsPage(frame)
  local T = Addon.Theme; local C = T.colors
  local area = T:ScrollArea(frame); self.settingsArea = area
  local child = area.child
  self.settingControls, self.settingChecks, self.themeButtons = {}, {}, {}
  local y = -4
  local function add(control) self.settingControls[#self.settingControls + 1] = control end
  local function heading(text)
    y = y - 10
    local fs = child:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    safeMethod(fs, "SetPoint", "TOPLEFT", child, "TOPLEFT", 4, y); safeMethod(fs, "SetText", text); safeMethod(fs, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
    add(fs); y = y - 30
  end
  local function label(text)
    local fs = child:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
    safeMethod(fs, "SetPoint", "TOPLEFT", child, "TOPLEFT", 8, y); safeMethod(fs, "SetText", text); safeMethod(fs, "SetTextColor", C.muted[1], C.muted[2], C.muted[3], 1)
    add(fs); y = y - 20
    return fs
  end
  local function check(key, text, tip)
    local box, caption = T:Check(child, text)
    safeMethod(box, "SetPoint", "TOPLEFT", child, "TOPLEFT", 8, y)
    safeMethod(box, "SetScript", "OnClick", function(button)
      local checked = button.GetChecked and button:GetChecked() or not Addon.db.settings[key]
      UI:SetSetting(key, checked); UI:SyncSettingsControls()
    end)
    if tip then attachTooltip(box, text, tip) end
    self.settingChecks[key] = box; add(box); add(caption); y = y - 26
  end
  local function button(text, width, x, onClick)
    local b = T:Button(child, text, width, 26)
    safeMethod(b, "SetPoint", "TOPLEFT", child, "TOPLEFT", x, y); safeMethod(b, "SetScript", "OnClick", onClick)
    add(b); return b
  end

  heading("Appearance")
  label("Theme")
  for index, name in ipairs(T.presetOrder) do
    local b = button(T.presetNames[name], 112, 8 + (index - 1) * 120, function()
      UI:SetSetting("theme", name); UI:SyncSettingsControls()
    end)
    self.themeButtons[index] = b
  end
  y = y - 34
  self.applyThemeButton = button("Apply theme (reloads UI)", 220, 8, function()
    if ReloadUI then ReloadUI() else Addon:Print("Type /reload to apply the theme.") end
  end)
  self.themeNote = child:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
  safeMethod(self.themeNote, "SetPoint", "LEFT", self.applyThemeButton, "RIGHT", 12, 0); add(self.themeNote)
  y = y - 38
  label("Window transparency")
  self.alphaSlider = T:Slider(child, 260, 0, 70, 1)
  safeMethod(self.alphaSlider, "SetPoint", "TOPLEFT", child, "TOPLEFT", 8, y - 2)
  safeMethod(self.alphaSlider, "SetScript", "OnValueChanged", function(_, value)
    if UI.syncingSettings then return end
    UI:SetSetting("windowAlpha", 1 - (tonumber(value) or 0) / 100); UI:SyncSettingsControls()
  end)
  attachTooltip(self.alphaSlider, "Window transparency", "Make the window background see-through so the game shows behind it.")
  add(self.alphaSlider)
  self.alphaValue = child:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  safeMethod(self.alphaValue, "SetPoint", "LEFT", self.alphaSlider, "RIGHT", 14, 0); add(self.alphaValue)
  y = y - 34
  check("showMinimapButton", "Show minimap button")

  heading("Alerts")
  check("toastsEnabled", "Show toast alerts", "Toasts are held while you are in combat and appear once combat ends.")
  check("toastSound", "Play a sound with toasts")
  check("announceMedals", "Announce my Mom Medals to the guild", "Guildmates running the addon see a toast when you earn a medal. Nothing is sent when messaging is restricted.")
  check("announceGuildChat", "Also post my medals in guild chat", "Posts one line to guild chat that everyone can read, even without the addon. Off by default.")
  check("receiveGuildAlerts", "Show toasts when guildmates earn medals")

  heading("Recording")
  check("enabled", "Record Chronicle")
  check("recordQuestAccepts", "Record quest accepts")
  check("recordCoordinates", "Attach coordinates to events")

  heading("Statistics")
  check("recordStatistics", "Collect achievement statistics")
  check("recordGoldStatistics", "Include gold statistics (local only)")

  heading("Data")
  local function qualityText(value) return value == 5 and "Loot: Legendary only" or "Loot: Epic and above" end
  self.qualityButton = button(qualityText(Addon.db.settings.notableQuality), 220, 8, function(b)
    local nextValue = Addon.db.settings.notableQuality == 4 and 5 or 4
    UI:SetSetting("notableQuality", nextValue); safeMethod(b, "SetText", qualityText(nextValue))
  end)
  y = y - 34
  self.historyButton = button("History: " .. tostring(Addon.db.settings.maxEvents), 220, 8, function(b)
    local current = Addon.db.settings.maxEvents
    local nextValue = current >= 10000 and 1000 or (current >= 5000 and 10000 or 5000)
    UI:SetSetting("maxEvents", nextValue); safeMethod(b, "SetText", "History: " .. tostring(nextValue)); Addon.Database:Compact()
  end)
  y = y - 34

  heading("Window")
  local resetWindow = button("Reset Window", 220, 8, function() if Addon.SettingsPanel then Addon.SettingsPanel:ResetWindow() end end)
  attachTooltip(resetWindow, "Reset Window", "Restore the window size and position.")
  y = y - 34
  local resetMinimap = button("Reset Minimap Button", 220, 8, function() if Addon.SettingsPanel then Addon.SettingsPanel:ResetMinimap() end end)
  attachTooltip(resetMinimap, "Reset Minimap Button", "Put the minimap button back in its default place.")
  y = y - 34

  heading("Danger zone")
  self.eraseButton = button("Erase Chronicle Data...", 220, 8, function() if Addon.SettingsPanel then Addon.SettingsPanel:RequestEraseHistory() end end)
  if self.eraseButton.label then safeMethod(self.eraseButton.label, "SetTextColor", C.danger[1], C.danger[2], C.danger[3], 1) end
  attachTooltip(self.eraseButton, "Erase Chronicle Data", "Permanently deletes recorded history. Settings are kept.")
  y = y - 40
  self.settingsHeight = -y
  safeMethod(area.child, "SetSize", 600, self.settingsHeight)
  area:Hide()
end

function UI:Create()
  if self.frame then return self.frame end
  local T = Addon.Theme; local C = T.colors
  local frame = CreateFrame("Frame", "MAMChroniclesFrame", UIParent, "BackdropTemplate")
  self.frame = frame; self:RestoreWindowState()
  safeMethod(frame, "SetMovable", true); safeMethod(frame, "EnableMouse", true); safeMethod(frame, "RegisterForDrag", "LeftButton"); safeMethod(frame, "SetClampedToScreen", true); safeMethod(frame, "SetResizable", true)
  if frame.SetResizeBounds then safeMethod(frame, "SetResizeBounds", 620, 440) else safeMethod(frame, "SetMinResize", 620, 440) end
  safeMethod(frame, "SetFrameStrata", "HIGH")
  T:Panel(frame, C.bg, C.border)
  self.bgFill = frame:CreateTexture(nil, "BACKGROUND", nil, -8)
  safeMethod(self.bgFill, "SetAllPoints", frame); safeMethod(self.bgFill, "SetColorTexture", C.bg[1], C.bg[2], C.bg[3], 1)
  self:ApplyAppearance()
  safeMethod(frame, "SetScript", "OnDragStart", function(f) safeMethod(f, "StartMoving") end)
  safeMethod(frame, "SetScript", "OnDragStop", function(f) safeMethod(f, "StopMovingOrSizing"); UI:SaveWindowState() end)
  if type(UISpecialFrames) == "table" then
    local found = false
    for _, name in ipairs(UISpecialFrames) do if name == "MAMChroniclesFrame" then found = true; break end end
    if not found then table.insert(UISpecialFrames, "MAMChroniclesFrame") end
  end

  -- title bar
  local bar = CreateFrame("Frame", nil, frame)
  safeMethod(bar, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 1, -1); safeMethod(bar, "SetPoint", "TOPRIGHT", frame, "TOPRIGHT", -1, -1); safeMethod(bar, "SetHeight", 34)
  T:Fill(bar, "BACKGROUND", C.panel)
  local icon = bar:CreateTexture(nil, "ARTWORK")
  safeMethod(icon, "SetTexture", ICON); safeMethod(icon, "SetSize", 22, 22); safeMethod(icon, "SetPoint", "LEFT", bar, "LEFT", 12, 0)
  self.titleBarIcon = icon
  local title = bar:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
  safeMethod(title, "SetPoint", "LEFT", icon, "RIGHT", 8, 0); safeMethod(title, "SetText", "Moms Against Magic Chronicles"); safeMethod(title, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
  self.title = title
  local close = T:Button(bar, "x", 28, 22)
  safeMethod(close, "SetPoint", "RIGHT", bar, "RIGHT", -6, 0)
  safeMethod(close, "SetScript", "OnClick", function() UI:Hide() end)
  self.closeButton = close

  -- tabs
  self.tabButtons = {}
  for index, name in ipairs(self.tabs) do
    local tab = T:Tab(frame, name, 112, 28)
    safeMethod(tab, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 12 + (index - 1) * 114, -38)
    safeMethod(tab, "SetScript", "OnClick", function() UI:SetActiveTab(name) end)
    self.tabButtons[index] = tab
  end
  local tabLine = frame:CreateTexture(nil, "BORDER")
  safeMethod(tabLine, "SetColorTexture", C.border[1], C.border[2], C.border[3], 1)
  safeMethod(tabLine, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 1, -68); safeMethod(tabLine, "SetPoint", "TOPRIGHT", frame, "TOPRIGHT", -1, -68); safeMethod(tabLine, "SetHeight", 1)

  -- toolbar
  local search = CreateFrame("EditBox", nil, frame, "BackdropTemplate")
  safeMethod(search, "SetSize", 220, 26); safeMethod(search, "SetPoint", "TOPLEFT", frame, "TOPLEFT", SIDE, -78); safeMethod(search, "SetAutoFocus", false)
  T:Input(search)
  local hint = search:CreateFontString(nil, "OVERLAY", "GameFontDisable")
  safeMethod(hint, "SetPoint", "LEFT", search, "LEFT", 9, 0); safeMethod(hint, "SetText", "Search the Chronicle...")
  self.searchHint = hint
  safeMethod(search, "SetScript", "OnTextChanged", function(box)
    if box.GetText then UI.search = box:GetText() or ""; UI.timelineOffset = 0; safeMethod(UI.searchHint, UI.search == "" and "Show" or "Hide"); UI:Refresh() end
  end)
  self.searchBox = search; attachTooltip(search, "Search", "Type words to find matching Chronicle entries.")
  local filter = T:Button(frame, "Filter: All", 130, 26)
  safeMethod(filter, "SetPoint", "LEFT", search, "RIGHT", 8, 0)
  safeMethod(filter, "SetScript", "OnClick", function(button) UI:OpenFilterMenu(button) end)
  self.filterButton = filter; attachTooltip(filter, "Filter", "Choose which kind of entry to show.")
  local range = T:Button(frame, "Range: All", 130, 26)
  safeMethod(range, "SetPoint", "LEFT", filter, "RIGHT", 8, 0)
  safeMethod(range, "SetScript", "OnClick", function(button) UI:OpenRangeMenu(button) end)
  self.rangeButton = range; attachTooltip(range, "Date range", "Choose how far back to look.")

  -- body text (empty states, statistics, diagnostics) lives in a scroll area that follows the window
  local textScroll = CreateFrame("ScrollFrame", nil, frame)
  local textChild = CreateFrame("Frame", nil, textScroll)
  safeMethod(textScroll, "SetScrollChild", textChild); safeMethod(textScroll, "EnableMouseWheel", true)
  safeMethod(textScroll, "SetScript", "OnMouseWheel", function(_, delta) UI:ScrollText(-delta * 28) end)
  self.textScroll, self.textChild = textScroll, textChild
  self.content = textChild:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  safeMethod(self.content, "SetPoint", "TOPLEFT", textChild, "TOPLEFT", 0, 0); safeMethod(self.content, "SetJustifyH", "LEFT"); safeMethod(self.content, "SetJustifyV", "TOP")
  safeMethod(self.content, "SetTextColor", C.text[1], C.text[2], C.text[3], 1); safeMethod(self.content, "SetSpacing", 3)
  local textSlider = CreateFrame("Slider", nil, frame, "BackdropTemplate")
  safeMethod(textSlider, "SetOrientation", "VERTICAL"); safeMethod(textSlider, "SetWidth", 10); safeMethod(textSlider, "SetMinMaxValues", 0, 0); safeMethod(textSlider, "SetValueStep", 1)
  T:Scrollbar(textSlider)
  safeMethod(textSlider, "SetScript", "OnValueChanged", function(_, value) if UI.updatingTextSlider then return end; UI:SetTextScroll(value) end)
  safeMethod(textSlider, "Hide")
  self.textSlider = textSlider

  -- footer
  local footerLine = frame:CreateTexture(nil, "BORDER")
  safeMethod(footerLine, "SetColorTexture", C.border[1], C.border[2], C.border[3], 1)
  safeMethod(footerLine, "SetPoint", "BOTTOMLEFT", frame, "BOTTOMLEFT", 1, FOOTER - 2); safeMethod(footerLine, "SetPoint", "BOTTOMRIGHT", frame, "BOTTOMRIGHT", -1, FOOTER - 2); safeMethod(footerLine, "SetHeight", 1)
  local previous = T:Button(frame, "Previous", 84, 24)
  safeMethod(previous, "SetPoint", "BOTTOMLEFT", frame, "BOTTOMLEFT", SIDE, 11)
  safeMethod(previous, "SetScript", "OnClick", function() UI:SetTimelineOffset((UI.timelineOffset or 0) - 30, UI.timelineTotal); UI:Refresh() end)
  self.previousButton = previous; attachTooltip(previous, "Previous page", "Show newer entries.")
  local nextPage = T:Button(frame, "Next", 84, 24)
  safeMethod(nextPage, "SetPoint", "LEFT", previous, "RIGHT", 8, 0)
  safeMethod(nextPage, "SetScript", "OnClick", function() UI:SetTimelineOffset((UI.timelineOffset or 0) + 30, UI.timelineTotal); UI:Refresh() end)
  self.nextButton = nextPage; attachTooltip(nextPage, "Next page", "Show older entries.")
  self.pageLabel = frame:CreateFontString(nil, "OVERLAY", "GameFontDisable")
  safeMethod(self.pageLabel, "SetPoint", "LEFT", nextPage, "RIGHT", 14, 0)
  local versionText = frame:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
  safeMethod(versionText, "SetPoint", "BOTTOMRIGHT", frame, "BOTTOMRIGHT", -34, 16); safeMethod(versionText, "SetText", "v" .. tostring(Addon.version))
  self.versionText = versionText
  local resize = CreateFrame("Button", nil, frame)
  safeMethod(resize, "SetSize", 16, 16); safeMethod(resize, "SetPoint", "BOTTOMRIGHT", frame, "BOTTOMRIGHT", -6, 6)
  safeMethod(resize, "SetNormalTexture", "Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Up"); safeMethod(resize, "SetPushedTexture", "Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Down"); safeMethod(resize, "SetHighlightTexture", "Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Highlight")
  safeMethod(resize, "SetScript", "OnMouseDown", function(_, button) if button == "LeftButton" then safeMethod(frame, "StartSizing", "BOTTOMRIGHT") end end)
  safeMethod(resize, "SetScript", "OnMouseUp", function() safeMethod(frame, "StopMovingOrSizing"); UI:SaveWindowState() end)
  self.resizeHandle = resize

  -- timeline region: wheel catcher, scrollbar, rows, details panel
  local function onWheel(_, delta)
    if UI.activeTab ~= "Chronicle" then return end
    UI:SetTimelineOffset((UI.timelineOffset or 0) - (delta * 5), UI.timelineTotal); UI:Refresh()
  end
  local scroll = CreateFrame("ScrollFrame", nil, frame)
  safeMethod(scroll, "SetPoint", "TOPLEFT", frame, "TOPLEFT", SIDE, -ROW_TOP); safeMethod(scroll, "SetPoint", "BOTTOMRIGHT", frame, "BOTTOMRIGHT", -(SIDE + DETAILS_W + 24), FOOTER)
  safeMethod(scroll, "EnableMouseWheel", true); safeMethod(scroll, "SetScript", "OnMouseWheel", onWheel); self.scrollFrame = scroll
  safeMethod(frame, "EnableMouseWheel", true); safeMethod(frame, "SetScript", "OnMouseWheel", onWheel)
  local slider = CreateFrame("Slider", nil, frame, "BackdropTemplate")
  safeMethod(slider, "SetOrientation", "VERTICAL"); safeMethod(slider, "SetWidth", 10)
  safeMethod(slider, "SetPoint", "TOPRIGHT", frame, "TOPRIGHT", -(SIDE + DETAILS_W + 10), -ROW_TOP); safeMethod(slider, "SetPoint", "BOTTOMRIGHT", frame, "BOTTOMRIGHT", -(SIDE + DETAILS_W + 10), FOOTER)
  safeMethod(slider, "SetMinMaxValues", 0, 0); safeMethod(slider, "SetValueStep", 1); safeMethod(slider, "SetObeyStepOnDrag", true)
  T:Scrollbar(slider)
  safeMethod(slider, "SetScript", "OnValueChanged", function(_, value) if UI.updatingSlider then return end; UI:SetTimelineOffset(value, UI.timelineTotal); UI:Refresh() end)
  self.slider = slider; attachTooltip(slider, "Timeline position", "Drag or use the mouse wheel to scroll.")
  local panel = CreateFrame("Frame", nil, frame, "BackdropTemplate")
  safeMethod(panel, "SetWidth", DETAILS_W)
  safeMethod(panel, "SetPoint", "TOPRIGHT", frame, "TOPRIGHT", -SIDE, -ROW_TOP); safeMethod(panel, "SetPoint", "BOTTOMRIGHT", frame, "BOTTOMRIGHT", -SIDE, FOOTER)
  T:Panel(panel, C.panel, C.border)
  self.detailsPanel = panel
  self.details = panel:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  safeMethod(self.details, "SetPoint", "TOPLEFT", panel, "TOPLEFT", 10, -10); safeMethod(self.details, "SetPoint", "BOTTOMRIGHT", panel, "BOTTOMRIGHT", -10, 10)
  safeMethod(self.details, "SetJustifyH", "LEFT"); safeMethod(self.details, "SetJustifyV", "TOP"); safeMethod(self.details, "SetTextColor", C.text[1], C.text[2], C.text[3], 1)
  safeMethod(self.details, "SetText", "Select an entry to inspect its details.")
  self.rowButtons = {}
  for index = 1, ROW_COUNT do
    local row = createRow(self, frame, index)
    safeMethod(row, "EnableMouseWheel", true); safeMethod(row, "SetScript", "OnMouseWheel", onWheel)
    self.rowButtons[index] = row
  end

  -- filter / range menu
  local menu = CreateFrame("Frame", nil, frame, "BackdropTemplate")
  safeMethod(menu, "SetFrameStrata", "DIALOG"); T:Panel(menu, C.raised, C.border); safeMethod(menu, "Hide")
  self.menu = menu; self.menuButtons = {}
  for index = 1, math.max(#self.filters, #self.dateRanges) do
    local b = T:Button(menu, "", 122, 20)
    safeMethod(b, "SetPoint", "TOPLEFT", menu, "TOPLEFT", 4, -4 - (index - 1) * 22); safeMethod(b, "Hide")
    self.menuButtons[index] = b
  end

  -- export / diagnostics text box
  local copy = CreateFrame("EditBox", nil, self.textChild, "BackdropTemplate")
  safeMethod(copy, "SetMultiLine", true); safeMethod(copy, "SetAutoFocus", false)
  safeMethod(copy, "SetPoint", "TOPLEFT", self.textChild, "TOPLEFT", 0, 0); T:Input(copy); safeMethod(copy, "SetTextInsets", 10, 10, 8, 8); safeMethod(copy, "Hide")
  self.copyBox = copy

  self.dashboard = Addon.Dashboard and Addon.Dashboard:Create(frame, self) or nil

  self:BuildSettingsPage(frame)

  safeMethod(frame, "SetScript", "OnSizeChanged", function(_, width, height) UI:ApplyLayout(width, height) end)
  self:ApplyLayout(frame.GetWidth and frame:GetWidth() or 780, frame.GetHeight and frame:GetHeight() or 560)
  safeMethod(frame, "Hide"); return frame
end

function UI:HideAllViews()
  for _, row in ipairs(self.rowPool) do safeMethod(row, "Hide") end
  for _, button in ipairs(self.rowButtons) do button.event = nil; safeMethod(button, "Hide") end
  for _, control in ipairs(self.settingControls) do safeMethod(control, "Hide") end
  safeMethod(self.previousButton, "Hide"); safeMethod(self.nextButton, "Hide"); safeMethod(self.scrollFrame, "Hide"); safeMethod(self.slider, "Hide"); safeMethod(self.pageLabel, "Hide")
  self:SetDetailsVisible(false); safeMethod(self.copyBox, "Hide"); safeMethod(self.content, "SetText", "")
  safeMethod(self.textScroll, "Hide"); safeMethod(self.textSlider, "Hide"); self.textVisible = false; self.copyShown = false
  if self.dashboard then self.dashboard:Hide() end
  if self.settingsArea then self.settingsArea:Hide() end
end

function UI:Refresh()
  self:Create(); self:HideAllViews(); self:UpdateTabStates()
  local chronicle = self.activeTab == "Chronicle"
  self:SetToolbarVisible(chronicle); if not chronicle then self:CloseMenu() end
  self:PlaceContent(chronicle)
  if self.activeTab == "Home" then
    if self.dashboard then self.dashboard:Show(); self.dashboard:Refresh() end
  elseif chronicle then
    safeMethod(self.previousButton, "Show"); safeMethod(self.nextButton, "Show"); safeMethod(self.scrollFrame, "Show"); safeMethod(self.slider, "Show"); self:SetDetailsVisible(true); safeMethod(self.pageLabel, "Show")
    local events, total = self:GetVisibleTimeline()
    if total == 0 then
      local unfiltered = self.activeFilter == "All" and self.activeRange == "All" and (self.search or "") == ""
      safeMethod(self.content, "SetText", unfiltered and "No Chronicle entries yet. Play for a while, or use /mam remember to add a memory." or "No entries match this filter, range, or search. Try widening them.")
      safeMethod(self.pageLabel, "SetText", ""); self:ShowTextArea(false)
    else
      safeMethod(self.pageLabel, "SetText", tostring(self.timelineOffset + 1) .. "-" .. tostring(self.timelineOffset + #events) .. " of " .. tostring(total))
    end
    for index = 1, #events do self:FillRow(index, events[index]) end
  elseif self.activeTab == "Statistics" then
    local fromTime, toTime = self:GetCurrentMonthRange(); local stats = Addon.Statistics:Build(fromTime, toTime)
    local text = Addon.Export:BuildHumanSummary(stats.fromTime, stats.toTime) .. (Addon.AchievementStats and "\n\n" .. Addon.AchievementStats:BuildText(Addon.characterKey) or "")
    safeMethod(self.content, "SetText", self:ColouriseStatistics(text)); self:ShowTextArea(false)
  elseif self.activeTab == "Settings" then
    self:ShowSettingsPage()
  else
    self.copyText = Addon.Export:BuildDiagnosticReport(); safeMethod(self.copyBox, "SetText", self.copyText); safeMethod(self.copyBox, "Show"); self:ShowTextArea(true)
  end
end

function UI:Show() self:Create(); self:Refresh(); safeMethod(self.frame,"Show") end
function UI:Hide() if self.frame then safeMethod(self.frame,"Hide") end end
function UI:ShowCopy(text)
  self:Create(); self:HideAllViews(); self:CloseMenu(); self:SetToolbarVisible(false); self:PlaceContent(false)
  self.copyText = text or ""; self.textOffset = 0
  safeMethod(self.copyBox, "SetText", self.copyText); safeMethod(self.copyBox, "Show"); self:ShowTextArea(true)
  safeMethod(self.copyBox, "SetFocus"); safeMethod(self.copyBox, "HighlightText"); safeMethod(self.frame, "Show")
end

function UI:HandleSlash(command)
  command=(command or ""):match("^%s*(.-)%s*$"); local verb,rest=command:match("^(%S+)%s*(.-)$"); verb=string.lower(verb or "")
  if verb=="" then self.activeTab="Chronicle"; Addon.db.settings.ui.activeTab="Chronicle"; self:Toggle()
  elseif verb=="remember" then local event,err=Addon.Collectors:RecordManualMemory(rest); self.lastMessage=event and "Memory saved." or err; Addon:Print(self.lastMessage)
  elseif verb=="stats" then self.activeTab="Statistics"; Addon.db.settings.ui.activeTab="Statistics"; self:Show()
  elseif verb=="export" then local value,err=Addon.Export:BuildCourierPayload(0,Addon:Now()); self:ShowCopy(value or err)
  elseif verb=="diag" then self.activeTab="Diagnostics"; Addon.db.settings.ui.activeTab="Diagnostics"; self:ShowCopy(Addon.Export:BuildDiagnosticReport())
  else self.lastMessage="Commands: /mam, remember, stats, export, diag, help"; Addon:Print(self.lastMessage) end
end

function UI:InitialiseSlashCommands()
  SLASH_MAMCHRONICLES1="/mam"; SlashCmdList.MAMCHRONICLES=function(message) UI:HandleSlash(message) end
end
