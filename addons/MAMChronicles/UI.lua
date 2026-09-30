local Addon=MAMChronicles
Addon.UI=Addon.UI or {}
local UI=Addon.UI

UI.tabs={"Home","Chronicle","Medals","Statistics","Characters","Settings","Diagnostics"}
UI.filters={"All","Deaths","Quests","World","Instances","Loot","Memories","Medals"}
UI.dateRanges={"All","30 Days","This Month"}
UI.activeTab="Home"; UI.activeFilter="All"; UI.activeRange="All"; UI.search=""; UI.rowPool={}

local validTabs={Home=true,Chronicle=true,Medals=true,Statistics=true,Characters=true,Settings=true,Diagnostics=true}
local groups={
  Deaths={ ["character.death"]=true,["character.resurrected"]=true },
  Quests={ ["quest.accepted"]=true,["quest.completed"]=true },
  World={ ["world.zone_discovered"]=true },
  Instances={ ["instance.entered"]=true,["instance.exited"]=true },
  Loot={ ["loot.notable"]=true }, Memories={ ["memory.manual"]=true }, Medals={ ["medal.earned"]=true },
}
local function shortDuration(seconds)
  seconds=math.floor(tonumber(seconds) or 0)
  if seconds>=3600 then return math.floor(seconds/3600).."h "..math.floor((seconds%3600)/60).."m" end
  return math.max(1,math.floor(seconds/60)).."m"
end
local function label(event)
  local p=event.payload or {}; local kind=event.type
  if kind=="session.login" then return "Logged in" end
  if kind=="session.logout" then return p.duration and ("Logged out after "..shortDuration(p.duration)) or "Logged out" end
  if kind=="character.level_up" and p.level then return "Reached level "..tostring(p.level) end
  if kind=="medal.earned" and (p.medalName or p.medalId) then return tostring(p.medalName or p.medalId)..(p.points and (" (+"..tostring(p.points).." Mom Money)") or "") end
  return p.text or p.questName or p.itemName or p.achievementName or p.professionName or p.zone or p.instanceName or (tostring(kind):gsub("[%._]"," "))
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
  self:FadeActivePage()
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
  -- Keep the saved size inside the screen (high UI scales shrink UIParent), but never below the window minimum.
  local width,height=ui.width,ui.height
  local okW,screenW=pcall(function() return UIParent.GetWidth and UIParent:GetWidth() end)
  local okH,screenH=pcall(function() return UIParent.GetHeight and UIParent:GetHeight() end)
  if okW and finite(screenW) and screenW>0 then width=clamp(width,620,math.max(620,screenW-20)) end
  if okH and finite(screenH) and screenH>0 then height=clamp(height,440,math.max(440,screenH-20)) end
  safeMethod(self.frame,"ClearAllPoints"); safeMethod(self.frame,"SetSize",width,height)
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
  if self.frame and self.frame.IsShown and self.frame:IsShown() then self:Hide(); return end
  self:Show()
end

-- Building or laying out the window waits for the end of combat.
function UI:DeferForCombat(copyText)
  if not Addon:InCombat() then return false end
  local first = not (self.pendingShow or self.pendingCopy)
  self.pendingShow, self.pendingCopy = true, copyText
  Addon:Print("In combat: the Chronicle will open when combat ends.")
  if first then Addon:AfterCombat(function() UI:OpenPending() end) end
  return true
end

function UI:OpenPending()
  local text = self.pendingCopy
  self.pendingShow, self.pendingCopy = nil, nil
  if text then self:ShowCopy(text, self.pendingDiagnostics) else self:Show() end
  self.pendingDiagnostics = nil
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

local booleanSettings={enabled=true,recordCoordinates=true,recordQuestAccepts=true,recordStatistics=true,recordGoldStatistics=true,toastsEnabled=true,toastSound=true,quietInstances=true,animations=true,announceMedals=true,announceGuildChat=true,receiveGuildAlerts=true}
function UI:SetSetting(key,value)
  if key=="showMinimapButton" and Addon.SettingsPanel then return Addon.SettingsPanel:ApplySetting(key,value==true) end
  local settings=Addon.db.settings
  if key=="theme" then
    if not (Addon.Theme and Addon.Theme.presets[value]) then return false end
    settings.theme=value; Addon.db.meta.updatedAt=Addon:Now(); return true
  elseif key=="windowAlpha" then
    settings.windowAlpha=math.max(0.3,math.min(1,math.floor((tonumber(value) or 1)*100+0.5)/100)); Addon.db.meta.updatedAt=Addon:Now()
    self:ApplyAppearance(); return true
  elseif key=="toastSoundChoice" then
    if not (Addon.Toast and Addon.Toast.soundKeys[value]) then return false end
    settings.toastSoundChoice=value; Addon.db.meta.updatedAt=Addon:Now(); return true
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
  self:UpdateTextScroll(); self:UpdateSettingsScroll(); self:UpdateMedalsScroll()
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

function UI:SetDiagBarVisible(visible)
  local method = visible and "Show" or "Hide"
  safeMethod(self.copyDiagButton, method); safeMethod(self.diagNote, method)
end

function UI:SelectDiagnostics()
  safeMethod(self.copyBox, "SetFocus"); safeMethod(self.copyBox, "HighlightText")
  self.lastMessage = "Diagnostics selected. Press Ctrl+C to copy, then paste them into your message."
  Addon:Print(self.lastMessage)
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
    elseif line == "Moms Against Magic Chronicles" or line == "Hall of Shame" or line == "Hall of Fame" or groups[line] then line = T:Colorize(line, T.colors.gold)
    elseif line:match("^  %+") then line = T:Colorize(line, T.kindColors.world)
    elseif line:match("^Changes shown") or line:match("^Coverage") or line:match("^Reporting window") then line = T:Colorize(line, T.colors.muted) end
    table.insert(lines, line)
  end
  return table.concat(lines, "\n")
end

function UI:ColouriseCharacters(text)
  local T = Addon.Theme
  local lines = {}
  for line in (text .. "\n"):gmatch("(.-)\n") do
    if line:match("^Characters on this account") then line = T:Colorize(line, T.colors.gold)
    elseif line ~= "" and not line:match("^%s") then line = T:Colorize(line, T.colors.gold)
    elseif line:match("^  Last played") then line = T:Colorize(line, T.colors.muted) end
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
  row.timeText = Addon.Theme:Text(row, "GameFontDisableSmall")
  safeMethod(row.timeText, "SetPoint", "LEFT", row, "LEFT", 10, 0); safeMethod(row.timeText, "SetWidth", 84); safeMethod(row.timeText, "SetJustifyH", "LEFT"); safeMethod(row.timeText, "SetTextColor", C.muted[1], C.muted[2], C.muted[3], 1)
  row.kindText = Addon.Theme:Text(row, "GameFontNormalSmall")
  safeMethod(row.kindText, "SetPoint", "LEFT", row.timeText, "RIGHT", 4, 0); safeMethod(row.kindText, "SetWidth", 82); safeMethod(row.kindText, "SetJustifyH", "LEFT")
  local text = Addon.Theme:Text(row, "GameFontHighlightSmall")
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
  if Addon.Theme.artTheme then
    if self.frame.__slices then self.frame.__slices:SetAlpha(alpha) end
    return
  end
  safeMethod(self.bgFill, "SetColorTexture", C.bg[1], C.bg[2], C.bg[3], alpha)
  safeMethod(self.frame, "SetBackdropColor", C.bg[1], C.bg[2], C.bg[3], alpha)
end

function UI:SyncShop()
  if not (self.shopButtons and Addon.Medals) then return end
  local Medals = Addon.Medals
  safeMethod(self.shopBalance, "SetText", "Mom Money available: " .. tostring(Medals:GetMomMoney()) .. ". Cosmetic only; never shared.")
  for _, b in ipairs(self.shopButtons) do
    local item = Medals.cosmeticsById[b.itemId]
    local state = Medals:IsEquipped(item.id) and "equipped" or (Medals:IsOwned(item.id) and "owned, click to equip" or (tostring(item.cost) .. " Mom Money"))
    safeMethod(b, "SetText", item.name .. " - " .. state)
  end
  local choice = Addon.db.settings.titleChoice
  safeMethod(self.titleButton, "SetText", "Title: " .. (choice == "auto" and "Auto" or Medals:GetTitle()))
end

function UI:ClickShopItem(item)
  local Medals = Addon.Medals
  if not Medals:IsOwned(item.id) then
    local ok, reason = Medals:Buy(item.id)
    if not ok then Addon:Print(reason) end
  elseif item.kind == "flourish" and Medals:IsEquipped(item.id) then Medals:Unequip("flourish")
  else Medals:Equip(item.id) end
  self:SyncShop()
end

function UI:CycleTitle()
  local Medals = Addon.Medals
  local choices = { "auto" }
  for _, entry in ipairs(Medals:GetEarnedTitles()) do choices[#choices + 1] = entry.family end
  local current = 1
  for index, key in ipairs(choices) do if key == Addon.db.settings.titleChoice then current = index end end
  Medals:SetTitleChoice(choices[current % #choices + 1])
  self:SyncShop()
end

function UI:SyncSettingsControls()
  self:SyncShop()
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
    local fs = Addon.Theme:Text(child, "GameFontNormalLarge")
    safeMethod(fs, "SetPoint", "TOPLEFT", child, "TOPLEFT", 4, y); safeMethod(fs, "SetText", text); safeMethod(fs, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
    add(fs)
    if T.artTheme then
      local divider = child:CreateTexture(nil, "ARTWORK")
      safeMethod(divider, "SetTexture", T.ART .. "Divider")
      safeMethod(divider, "SetPoint", "TOPLEFT", child, "TOPLEFT", 0, y - 24); safeMethod(divider, "SetPoint", "TOPRIGHT", child, "TOPRIGHT", -4, y - 24); safeMethod(divider, "SetHeight", 10)
      add(divider)
    end
    y = y - 30
  end
  local function label(text)
    local fs = Addon.Theme:Text(child, "GameFontHighlight")
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
  self.themeNote = Addon.Theme:Text(child, "GameFontDisableSmall")
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
  self.alphaValue = Addon.Theme:Text(child, "GameFontHighlight")
  safeMethod(self.alphaValue, "SetPoint", "LEFT", self.alphaSlider, "RIGHT", 14, 0); add(self.alphaValue)
  y = y - 34
  check("showMinimapButton", "Show minimap button")
  check("animations", "Animations (fades, pulses and bounces)", "Turn this off for a perfectly still interface.")

  heading("Alerts")
  check("toastsEnabled", "Show toast alerts", "Toasts are held while you are in combat and appear once combat ends.")
  check("toastSound", "Play a sound with toasts")
  check("announceMedals", "Announce my Mom Medals to the guild", "Guildmates running the addon see a toast when you earn a medal. Nothing is sent when messaging is restricted.")
  check("announceGuildChat", "Also post my medals in guild chat", "Posts one line to guild chat that everyone can read, even without the addon. Off by default.")
  check("receiveGuildAlerts", "Show toasts when guildmates earn medals")
  check("quietInstances", "Hold toasts in dungeons, raids and battlegrounds", "Toasts wait until you are back in the open world. They are always held in combat.")
  y = y - 4
  local function soundText() local s = Addon.Toast.soundKeys[Addon.db.settings.toastSoundChoice] or Addon.Toast.sounds[1]; return "Toast sound: " .. s.label end
  self.soundButton = button(soundText(), 220, 8, function(b)
    local list, current = Addon.Toast.sounds, 1
    for index, sound in ipairs(list) do if sound.key == Addon.db.settings.toastSoundChoice then current = index end end
    local nextSound = list[current % #list + 1]
    UI:SetSetting("toastSoundChoice", nextSound.key); safeMethod(b, "SetText", soundText())
    Addon.Toast:PreviewSound(nextSound.key)
  end)
  attachTooltip(self.soundButton, "Toast sound", "Click to hear the next sound and choose it. It plays with toasts when 'Play a sound with toasts' is ticked.")
  y = y - 34
  self.testToastButton = button("Send a test toast", 220, 8, function() if Addon.Toast then Addon.Toast:SendTest() end end)
  attachTooltip(self.testToastButton, "Send a test toast", "Shows a sample toast so you can check they appear. Click again for the medal and guildmate looks.")
  y = y - 34

  if Addon.Medals then
    heading("Mom Money shop")
    self.shopBalance = label("")
    self.shopButtons = {}
    for _, item in ipairs(Addon.Medals.cosmetics) do
      if item.cost > 0 then
        local b = button(item.name, 300, 8, function() UI:ClickShopItem(item) end)
        b.itemId = item.id
        self.shopButtons[#self.shopButtons + 1] = b
        y = y - 34
      end
    end
    self.styleResetButton = button("Default toast colours", 300, 8, function() Addon.Medals:Equip("style_gold"); UI:SyncShop() end)
    attachTooltip(self.styleResetButton, "Default toast colours", "Go back to the normal toast colours.")
    y = y - 34
    self.titleButton = button("Title: Auto", 300, 8, function() UI:CycleTitle() end)
    attachTooltip(self.titleButton, "Mom title", "Click to cycle through the titles you have earned. Auto uses the medal family you have earned the most Mom Money in.")
    y = y - 34
  end

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

local MEDAL_ROW_HEIGHT = 54

function UI:UpdateMedalsScroll()
  if not self.medalsArea then return end
  self.medalsArea:Update(self.medalsHeight or 200, self:TextViewHeight(), self.textWidth or 700)
end

local MEDAL_PITCH = MEDAL_ROW_HEIGHT + 4
local MEDAL_LIST_TOP = 124
UI.medalFilters = { "All", "Earned", "In progress", "Locked", "Next up" }
UI.medalFilter = "Next up"
UI.medalSearch = ""
UI.medalCategory = "all"

function UI:SetMedalCategory(key)
  if key ~= "all" and not (Addon.Medals and Addon.Medals.categoriesByKey[key]) then return false end
  self.medalCategory = key
  if self.medalsArea then self.medalsArea:SetOffset(0); self:RefreshMedals(); self:AnimateMedalBars() end
  return true
end

function UI:DescribeCategory(key)
  for _, category in ipairs(Addon.Medals:GetCategories()) do
    if category.key == key then return category.label .. ": " .. tostring(category.earned) .. " of " .. tostring(category.total) .. " medals earned" end
  end
  return "All categories"
end

function UI:CategoryLabel()
  local category = Addon.Medals.categoriesByKey[self.medalCategory]
  return category and category.label or "All"
end

function UI:CycleMedalCategory()
  local keys = { "all" }
  for _, category in ipairs(Addon.Medals:GetCategories()) do keys[#keys + 1] = category.key end
  local current = 1
  for index, key in ipairs(keys) do if key == self.medalCategory then current = index end end
  self:SetMedalCategory(keys[current % #keys + 1])
end

function UI:SetMedalFilter(value)
  local valid = false
  for _, name in ipairs(self.medalFilters) do if name == value then valid = true end end
  if not valid then return false end
  self.medalFilter = value
  if self.medalsArea then self.medalsArea:SetOffset(0); self:RefreshMedals(); self:AnimateMedalBars() end
  return true
end

function UI:SetMedalSearch(text)
  self.medalSearch = type(text) == "string" and text or ""
  if self.medalsArea then self.medalsArea:SetOffset(0); self:RefreshMedals() end
end

local function medalState(entry)
  if entry.earned then return "Earned" end
  if entry.current > 0 then return "In progress" end
  return "Locked"
end

-- Rows are created only for the slots the window can show and rebound as the list scrolls.
local function createMedalRow(ui, index)
  local T = Addon.Theme; local C = T.colors
  local child = ui.medalsArea.child
  local row = CreateFrame("Frame", nil, child, "BackdropTemplate")
  T:Panel(row, C.panel, C.border); safeMethod(row, "SetHeight", MEDAL_ROW_HEIGHT); safeMethod(row, "EnableMouse", true)
  row.stripe = row:CreateTexture(nil, "ARTWORK")
  safeMethod(row.stripe, "SetPoint", "TOPLEFT", row, "TOPLEFT", 0, 0); safeMethod(row.stripe, "SetPoint", "BOTTOMLEFT", row, "BOTTOMLEFT", 0, 0); safeMethod(row.stripe, "SetWidth", 4)
  local art = T.artTheme
  if art then
    safeMethod(row.stripe, "Hide")
    row.badge = row:CreateTexture(nil, "ARTWORK")
    safeMethod(row.badge, "SetTexture", T.ART .. "Badge"); safeMethod(row.badge, "SetSize", 36, 36); safeMethod(row.badge, "SetPoint", "LEFT", row, "LEFT", 10, 0)
  end
  row.name = Addon.Theme:Text(row, "GameFontNormal")
  safeMethod(row.name, "SetPoint", "TOPLEFT", row, "TOPLEFT", art and 54 or 14, -7); safeMethod(row.name, "SetJustifyH", "LEFT")
  row.newTag = Addon.Theme:Text(row, "GameFontNormalSmall")
  safeMethod(row.newTag, "SetPoint", "LEFT", row.name, "RIGHT", 8, 0); safeMethod(row.newTag, "SetText", "NEW"); safeMethod(row.newTag, "SetTextColor", T.kindColors.world[1], T.kindColors.world[2], T.kindColors.world[3], 1); safeMethod(row.newTag, "Hide")
  row.goalTag = Addon.Theme:Text(row, "GameFontNormalSmall")
  safeMethod(row.goalTag, "SetPoint", "LEFT", row.newTag, "RIGHT", 6, 0); safeMethod(row.goalTag, "SetText", "GOAL"); safeMethod(row.goalTag, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1); safeMethod(row.goalTag, "Hide")
  row.desc = Addon.Theme:Text(row, "GameFontDisableSmall")
  safeMethod(row.desc, "SetPoint", "TOPLEFT", row.name, "BOTTOMLEFT", 0, -3); safeMethod(row.desc, "SetPoint", "RIGHT", row, "RIGHT", -130, 0); safeMethod(row.desc, "SetJustifyH", "LEFT"); safeMethod(row.desc, "SetWordWrap", false)
  row.points = Addon.Theme:Text(row, "GameFontNormal")
  safeMethod(row.points, "SetPoint", "TOPRIGHT", row, "TOPRIGHT", -12, -7)
  row.progress = Addon.Theme:Text(row, "GameFontDisableSmall")
  safeMethod(row.progress, "SetPoint", "BOTTOMRIGHT", row, "BOTTOMRIGHT", -12, 9)
  if art then
    row.barTrack = row:CreateTexture(nil, "ARTWORK")
    safeMethod(row.barTrack, "SetTexture", T.ART .. "Bar"); safeMethod(row.barTrack, "SetTexCoord", 0, 1, 0, 0.25)
    safeMethod(row.barTrack, "SetPoint", "BOTTOMLEFT", row, "BOTTOMLEFT", 54, 8); safeMethod(row.barTrack, "SetPoint", "BOTTOMRIGHT", row, "BOTTOMRIGHT", -132, 8); safeMethod(row.barTrack, "SetHeight", 8)
    row.bar = row:CreateTexture(nil, "ARTWORK", nil, 1)
    safeMethod(row.bar, "SetTexture", T.ART .. "Bar"); safeMethod(row.bar, "SetTexCoord", 0, 1, 0.25, 0.5)
    safeMethod(row.bar, "SetPoint", "BOTTOMLEFT", row, "BOTTOMLEFT", 54, 8); safeMethod(row.bar, "SetHeight", 8)
  else
    row.bar = row:CreateTexture(nil, "ARTWORK")
    safeMethod(row.bar, "SetPoint", "BOTTOMLEFT", row, "BOTTOMLEFT", 4, 0); safeMethod(row.bar, "SetHeight", 3)
  end
  safeMethod(row, "SetScript", "OnEnter", function(r)
    T:PanelHover(r, true)
    UI:ShowMedalTooltip(r)
  end)
  safeMethod(row, "SetScript", "OnLeave", function(r)
    T:PanelHover(r, false)
    if GameTooltip then safeMethod(GameTooltip, "Hide") end
  end)
  safeMethod(row, "SetScript", "OnMouseUp", function(r, button) UI:ToggleGoal(r, button) end)
  ui.medalRows[index] = row
  return row
end

function UI:ToggleGoal(row, button)
  local entry = row and row.entry
  if button ~= "LeftButton" or not entry or entry.earned then return end
  local id = entry.def.id
  if Addon.Medals:IsPinned(id) then Addon.Medals:SetPinned(id, false)
  elseif not Addon.Medals:SetPinned(id, true) then Addon:Print("You can pin 3 goals. Unpin one first.") end
  self:RefreshMedals()
end

function UI:ShowMedalTooltip(row)
  local entry = row and row.entry
  if not entry or not GameTooltip then return end
  local def = entry.def
  safeMethod(GameTooltip, "SetOwner", row, "ANCHOR_RIGHT"); safeMethod(GameTooltip, "SetText", def.name)
  safeMethod(GameTooltip, "AddLine", def.description, 1, 1, 1, true)
  safeMethod(GameTooltip, "AddLine", "Tracked: " .. tostring(def.tracking), 0.7, 0.7, 0.7, true)
  if entry.earned then
    local when = entry.earned.retro and "before tracking began" or (date and date("%d %b %Y", entry.earned.at) or tostring(entry.earned.at))
    safeMethod(GameTooltip, "AddLine", "Earned " .. when .. " (+" .. tostring(def.points) .. " Mom Money)", 0.9, 0.8, 0.3, true)
  else
    safeMethod(GameTooltip, "AddLine", "Progress: " .. tostring(math.floor(math.min(entry.current, entry.target))) .. " / " .. tostring(entry.target), 0.9, 0.8, 0.3, true)
    safeMethod(GameTooltip, "AddLine", Addon.Medals:IsPinned(def.id) and "Click to unpin this goal." or "Click to pin as a goal.", 0.6, 0.8, 1, true)
  end
  safeMethod(GameTooltip, "Show")
end

function UI:BindMedalRow(row, entry, position)
  local T = Addon.Theme; local C = T.colors
  local def = entry.def
  row.entry = entry
  local tierColour = Addon.Medals.tierColours[def.tier]
  local offset = -(MEDAL_LIST_TOP + (position - 1) * MEDAL_PITCH)
  safeMethod(row, "ClearAllPoints"); safeMethod(row, "SetPoint", "TOPLEFT", self.medalsArea.child, "TOPLEFT", 0, offset); safeMethod(row, "SetPoint", "TOPRIGHT", self.medalsArea.child, "TOPRIGHT", 0, offset)
  safeMethod(row.name, "SetText", def.name); safeMethod(row.desc, "SetText", def.description)
  safeMethod(row.points, "SetText", "+" .. tostring(def.points))
  safeMethod(row.newTag, entry.isNew and "Show" or "Hide")
  safeMethod(row.goalTag, (not entry.earned and Addon.Medals:IsPinned(def.id)) and "Show" or "Hide")
  local earned = entry.earned ~= nil
  local nameColour = earned and C.gold or C.muted
  safeMethod(row.name, "SetTextColor", nameColour[1], nameColour[2], nameColour[3], 1)
  safeMethod(row.points, "SetTextColor", tierColour[1], tierColour[2], tierColour[3], earned and 1 or 0.55)
  safeMethod(row.stripe, "SetColorTexture", tierColour[1], tierColour[2], tierColour[3], earned and 1 or 0.35)
  local art = T.artTheme and row.badge ~= nil
  if art then
    local tier = ({ bronze = 0, silver = 1, gold = 2, platinum = 3 })[def.tier] or 0
    safeMethod(row.badge, "SetTexCoord", tier * 0.25, (tier + 1) * 0.25, 0, 1)
    safeMethod(row.badge, "SetDesaturated", not earned); safeMethod(row.badge, "SetAlpha", earned and 1 or 0.55)
  end
  local rowWidth = (self.textWidth or 700) - 4
  local trackWidth = math.max(20, rowWidth - 54 - 132)
  local function paint(r, g, b, fraction)
    if art then
      safeMethod(row.bar, "SetVertexColor", r, g, b, 1); safeMethod(row.bar, "SetWidth", math.max(10, trackWidth * fraction))
    else
      safeMethod(row.bar, "SetColorTexture", r, g, b, 1); safeMethod(row.bar, "SetWidth", math.max(1, rowWidth * fraction))
    end
  end
  if earned then
    local stamp = entry.earned.retro and "Earned before tracking began" or ("Earned " .. (date and date("%d %b %Y", entry.earned.at) or tostring(entry.earned.at)))
    safeMethod(row.progress, "SetText", stamp)
    paint(tierColour[1], tierColour[2], tierColour[3], 1)
  else
    local current = math.floor(math.min(entry.current, entry.target))
    safeMethod(row.progress, "SetText", tostring(current) .. " / " .. tostring(entry.target))
    paint(C.accent[1], C.accent[2], C.accent[3], entry.fraction)
  end
  safeMethod(row, "Show")
end

function UI:LayoutMedalRows(force)
  if not self.medalsArea then return end
  local list = self.medalList or {}
  local offset = self.medalsArea.offset or 0
  local first = math.max(1, math.floor((offset - MEDAL_LIST_TOP) / MEDAL_PITCH) + 1)
  local slots = math.ceil(self:TextViewHeight() / MEDAL_PITCH) + 2
  if not force and first == self.medalFirst and slots == self.medalSlots then return end
  self.medalFirst, self.medalSlots = first, slots
  for slot = 1, slots do
    local entry = list[first + slot - 1]
    if entry then
      self:BindMedalRow(self.medalRows[slot] or createMedalRow(self, slot), entry, first + slot - 1)
    elseif self.medalRows[slot] then
      self.medalRows[slot].entry = nil; safeMethod(self.medalRows[slot], "Hide")
    end
  end
  for slot = slots + 1, #self.medalRows do self.medalRows[slot].entry = nil; safeMethod(self.medalRows[slot], "Hide") end
end

local filterTips = {
  All = "Show every medal.", Earned = "Medals you have earned.",
  ["In progress"] = "Medals you have started but not earned.", Locked = "Medals you have not started yet.",
  ["Next up"] = "The next tier to aim for in each medal family.",
}
local filterWidths = { All = 84, Earned = 92, ["In progress"] = 112, Locked = 96, ["Next up"] = 104 }

function UI:BuildMedalsPage(frame)
  local T = Addon.Theme; local C = T.colors
  local area = T:ScrollArea(frame); self.medalsArea = area
  local child = area.child
  area.onScroll = function() UI:LayoutMedalRows() end
  self.medalHeader = Addon.Theme:Text(child, "GameFontNormalLarge")
  safeMethod(self.medalHeader, "SetPoint", "TOPLEFT", child, "TOPLEFT", 4, -4); safeMethod(self.medalHeader, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
  self.medalSub = Addon.Theme:Text(child, "GameFontDisable")
  safeMethod(self.medalSub, "SetPoint", "TOPLEFT", self.medalHeader, "BOTTOMLEFT", 0, -4)
  -- search and filters
  local search = CreateFrame("EditBox", nil, child, "BackdropTemplate")
  safeMethod(search, "SetSize", 190, 26); safeMethod(search, "SetPoint", "TOPLEFT", child, "TOPLEFT", 4, -54); safeMethod(search, "SetAutoFocus", false)
  local categoryButton = T:Button(child, "Category: All", 190, 26)
  safeMethod(categoryButton, "SetPoint", "LEFT", search, "RIGHT", 6, 0)
  safeMethod(categoryButton, "SetScript", "OnClick", function() UI:CycleMedalCategory() end)
  attachTooltip(categoryButton, "Medal category", "Click to cycle through the medal categories.")
  self.medalCategoryButton = categoryButton
  T:Input(search)
  local hint = Addon.Theme:Text(search, "GameFontDisable")
  safeMethod(hint, "SetPoint", "LEFT", search, "LEFT", 9, 0); safeMethod(hint, "SetText", "Search medals...")
  safeMethod(search, "SetScript", "OnTextChanged", function(box)
    local text = box.GetText and box:GetText() or ""
    safeMethod(hint, text == "" and "Show" or "Hide")
    if text ~= UI.medalSearch then UI:SetMedalSearch(text) end
  end)
  safeMethod(search, "SetScript", "OnEscapePressed", function(box) safeMethod(box, "ClearFocus") end)
  self.medalSearchBox = search; attachTooltip(search, "Search medals", "Type part of a medal's name or description.")
  self.medalFilterButtons = {}
  local previous
  for index, name in ipairs(self.medalFilters) do
    local b = T:Button(child, name, filterWidths[name] or 92, 26)
    if previous then safeMethod(b, "SetPoint", "LEFT", previous, "RIGHT", 6, 0) else safeMethod(b, "SetPoint", "TOPLEFT", child, "TOPLEFT", 4, -88) end
    safeMethod(b, "SetScript", "OnClick", function() UI:SetMedalFilter(name) end)
    attachTooltip(b, name, filterTips[name])
    self.medalFilterButtons[index] = b; previous = b
  end
  self.medalEmpty = Addon.Theme:Text(child, "GameFontDisable")
  safeMethod(self.medalEmpty, "SetPoint", "TOPLEFT", child, "TOPLEFT", 8, -(MEDAL_LIST_TOP + 6)); safeMethod(self.medalEmpty, "SetText", "No medals match this filter or search. Try another filter or clear the search."); safeMethod(self.medalEmpty, "Hide")
  self.medalRows, self.medalList = {}, {}
  self.guildHeading = Addon.Theme:Text(child, "GameFontNormalLarge")
  safeMethod(self.guildHeading, "SetText", "Guildmates"); safeMethod(self.guildHeading, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
  self.guildLines = {}
  for index = 1, 10 do
    local line = Addon.Theme:Text(child, "GameFontHighlight")
    safeMethod(line, "SetJustifyH", "LEFT"); self.guildLines[index] = line
  end
  self.guildEmpty = Addon.Theme:Text(child, "GameFontDisable")
  safeMethod(self.guildEmpty, "SetText", "No guild medals seen yet. Guildmates running the addon will appear here when they earn one.")
  area:Hide()
end

function UI:RefreshMedals()
  local T = Addon.Theme; local C = T.colors
  local progress = Addon.Medals:GetProgress(Addon.characterKey)
  local needle = string.lower(self.medalSearch or "")
  local searched, counts = {}, { All = 0, Earned = 0, ["In progress"] = 0, Locked = 0, ["Next up"] = 0 }
  local familySeen = {}
  for index, entry in ipairs(progress) do
    entry.index = index; entry.isNew = entry.earned ~= nil and Addon.Medals.newIds[entry.def.id] == true
    -- definitions are listed in tier order, so the first unearned one of a family is its next tier
    entry.isNextUp = false
    if not entry.earned and not familySeen[entry.def.family] then entry.isNextUp = true; familySeen[entry.def.family] = true end
    local text = string.lower(entry.def.name .. " " .. entry.def.description)
    if (self.medalCategory == "all" or entry.def.category == self.medalCategory) and (needle == "" or string.find(text, needle, 1, true)) then
      searched[#searched + 1] = entry
      counts.All = counts.All + 1; local state = medalState(entry); counts[state] = counts[state] + 1
      if entry.isNextUp then counts["Next up"] = counts["Next up"] + 1 end
    end
  end
  local order = {}
  for _, entry in ipairs(searched) do
    if self.medalFilter == "All" or (self.medalFilter == "Next up" and entry.isNextUp) or medalState(entry) == self.medalFilter then order[#order + 1] = entry end
  end
  table.sort(order, function(a, b)
    local ea, eb = a.earned ~= nil, b.earned ~= nil
    if ea ~= eb then return ea end
    if ea then if a.earned.at ~= b.earned.at then return a.earned.at > b.earned.at end return a.index < b.index end
    if a.fraction ~= b.fraction then return a.fraction > b.fraction end
    return a.index < b.index
  end)
  self.medalList = order
  local summary = Addon.Medals:GetSummary(Addon.characterKey)
  local available, earnedMoney = Addon.Medals:GetMomMoney(), Addon.Medals:GetEarnedMoney()
  safeMethod(self.medalHeader, "SetText", "Mom Money " .. tostring(available) .. (available ~= earnedMoney and (" (" .. tostring(earnedMoney) .. " earned)") or ""))
  safeMethod(self.medalSub, "SetText", tostring(summary.count) .. " of " .. tostring(summary.possible) .. " Mom Medals earned  \194\183  " .. Addon.Medals:GetTitle() .. "  \194\183  " .. tostring(Addon.Medals:GetTitleCounts().earned) .. " of " .. tostring(Addon.Medals:GetTitleCounts().total) .. " titles" .. ((self.medalFilter ~= "All" or needle ~= "" or self.medalCategory ~= "all") and ("  \194\183  showing " .. tostring(#order)) or ""))
  for index, name in ipairs(self.medalFilters) do
    local b = self.medalFilterButtons[index]
    safeMethod(b, "SetText", name .. " (" .. tostring(counts[name]) .. ")")
    safeMethod(b, name == self.medalFilter and "LockHighlight" or "UnlockHighlight"); T:SetSelected(b, name == self.medalFilter)
  end
  safeMethod(self.medalCategoryButton, "SetText", "Category: " .. self:CategoryLabel())
  safeMethod(self.medalEmpty, #order == 0 and "Show" or "Hide")
  local base = MEDAL_LIST_TOP + math.max(#order, 1) * MEDAL_PITCH + 16
  self:LayoutMedalRows(true)
  safeMethod(self.guildHeading, "ClearAllPoints"); safeMethod(self.guildHeading, "SetPoint", "TOPLEFT", self.medalsArea.child, "TOPLEFT", 4, -base)
  local feed = (Addon.db and Addon.db.guildFeed) or {}
  for index, line in ipairs(self.guildLines) do
    local entry = feed[index]
    if entry then
      local when = date and date("%d %b", entry.at) or tostring(entry.at)
      safeMethod(line, "ClearAllPoints"); safeMethod(line, "SetPoint", "TOPLEFT", self.medalsArea.child, "TOPLEFT", 8, -(base + 26 + (index - 1) * 18))
      safeMethod(line, "SetText", tostring(entry.sender):match("^[^-]+") .. " earned " .. entry.name .. "  (+" .. tostring(entry.points) .. ")  " .. when); safeMethod(line, "Show")
    else safeMethod(line, "SetText", ""); safeMethod(line, "Hide") end
  end
  safeMethod(self.guildEmpty, "ClearAllPoints"); safeMethod(self.guildEmpty, "SetPoint", "TOPLEFT", self.medalsArea.child, "TOPLEFT", 8, -(base + 26))
  safeMethod(self.guildEmpty, #feed == 0 and "Show" or "Hide")
  self.medalsHeight = base + 26 + math.max(1, math.min(#feed, 10)) * 18 + 16
  self:UpdateMedalsScroll()
end

function UI:ShowMedalsPage()
  local area = self.medalsArea
  area:Place(self.frame, 84, FOOTER + 4, SIDE, TEXT_SCROLLBAR); area:Show()
  self:RefreshMedals(); self:UpdateMedalsScroll(); self:AnimateMedalBars()
end

function UI:Create()
  if self.frame then return self.frame end
  local T = Addon.Theme; local C = T.colors
  local frame = CreateFrame("Frame", "MAMChroniclesFrame", UIParent, "BackdropTemplate")
  self.frame = frame; self:RestoreWindowState()
  safeMethod(frame, "SetMovable", true); safeMethod(frame, "EnableMouse", true); safeMethod(frame, "RegisterForDrag", "LeftButton"); safeMethod(frame, "SetClampedToScreen", true); safeMethod(frame, "SetResizable", true)
  if frame.SetResizeBounds then safeMethod(frame, "SetResizeBounds", 620, 440) else safeMethod(frame, "SetMinResize", 620, 440) end
  safeMethod(frame, "SetFrameStrata", "HIGH")
  T:Window(frame)
  if not T.artTheme then
    self.topAccent = frame:CreateTexture(nil, "OVERLAY")
    safeMethod(self.topAccent, "SetColorTexture", C.accent[1], C.accent[2], C.accent[3], 1)
    safeMethod(self.topAccent, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 1, -1); safeMethod(self.topAccent, "SetPoint", "TOPRIGHT", frame, "TOPRIGHT", -1, -1); safeMethod(self.topAccent, "SetHeight", 2)
    self.bgFill = frame:CreateTexture(nil, "BACKGROUND", nil, -8)
    safeMethod(self.bgFill, "SetAllPoints", frame); safeMethod(self.bgFill, "SetColorTexture", C.bg[1], C.bg[2], C.bg[3], 1)
  end
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
  local edge = T.artTheme and 6 or 1
  safeMethod(bar, "SetPoint", "TOPLEFT", frame, "TOPLEFT", edge, -edge); safeMethod(bar, "SetPoint", "TOPRIGHT", frame, "TOPRIGHT", -edge, -edge); safeMethod(bar, "SetHeight", 34)
  T:Fill(bar, "BACKGROUND", C.panel)
  local icon = bar:CreateTexture(nil, "ARTWORK")
  safeMethod(icon, "SetTexture", ICON); safeMethod(icon, "SetSize", 22, 22); safeMethod(icon, "SetPoint", "LEFT", bar, "LEFT", 12, 0)
  self.titleBarIcon = icon
  local title = Addon.Theme:Text(bar, "GameFontNormalLarge")
  safeMethod(title, "SetPoint", "LEFT", icon, "RIGHT", 8, 0); safeMethod(title, "SetText", "Moms Against Magic Chronicles"); safeMethod(title, "SetTextColor", C.gold[1], C.gold[2], C.gold[3], 1)
  self.title = title
  local close = T:Button(bar, "x", 28, 22, { red = true })
  safeMethod(close, "SetPoint", "RIGHT", bar, "RIGHT", -6, 0)
  safeMethod(close, "SetScript", "OnClick", function() UI:Hide() end)
  self.closeButton = close

  -- tabs
  self.tabButtons = {}
  for index, name in ipairs(self.tabs) do
    local tab = T:Tab(frame, name, 84, 28)
    safeMethod(tab, "SetPoint", "TOPLEFT", frame, "TOPLEFT", 12 + (index - 1) * 86, -38)
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
  local hint = Addon.Theme:Text(search, "GameFontDisable")
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

  -- diagnostics bar (Diagnostics tab only): select-all button and a paste-back note
  local copyDiag = T:Button(frame, "Copy diagnostics", 130, 26)
  safeMethod(copyDiag, "SetPoint", "TOPLEFT", frame, "TOPLEFT", SIDE, -78); safeMethod(copyDiag, "Hide")
  safeMethod(copyDiag, "SetScript", "OnClick", function() UI:SelectDiagnostics() end)
  self.copyDiagButton = copyDiag; attachTooltip(copyDiag, "Copy diagnostics", "Selects the whole report. Press Ctrl+C to copy it.")
  local diagNote = Addon.Theme:Text(frame, "GameFontDisableSmall")
  safeMethod(diagNote, "SetPoint", "LEFT", copyDiag, "RIGHT", 10, 0); safeMethod(diagNote, "SetJustifyH", "LEFT"); safeMethod(diagNote, "Hide")
  safeMethod(diagNote, "SetText", "Found a problem? Click Copy diagnostics, press Ctrl+C, then paste the report into your message. It holds no chat, names or gold.")
  self.diagNote = diagNote

  -- body text (empty states, statistics, diagnostics) lives in a scroll area that follows the window
  local textScroll = CreateFrame("ScrollFrame", nil, frame)
  local textChild = CreateFrame("Frame", nil, textScroll)
  safeMethod(textScroll, "SetScrollChild", textChild); safeMethod(textScroll, "EnableMouseWheel", true)
  safeMethod(textScroll, "SetScript", "OnMouseWheel", function(_, delta) UI:ScrollText(-delta * 28) end)
  self.textScroll, self.textChild = textScroll, textChild
  self.content = Addon.Theme:Text(textChild, "GameFontHighlight")
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
  self.pageLabel = Addon.Theme:Text(frame, "GameFontDisable")
  safeMethod(self.pageLabel, "SetPoint", "LEFT", nextPage, "RIGHT", 14, 0)
  local versionText = Addon.Theme:Text(frame, "GameFontDisableSmall")
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
  self.details = Addon.Theme:Text(panel, "GameFontHighlightSmall")
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
  if Addon.Medals then self:BuildMedalsPage(frame) end

  safeMethod(frame, "SetScript", "OnSizeChanged", function(_, width, height)
    if Addon:InCombat() then
      local first = not UI.layoutPending
      UI.layoutPending = { width, height }
      if first then Addon:AfterCombat(function() local size = UI.layoutPending; UI.layoutPending = nil; if size then UI:ApplyLayout(size[1], size[2]) end end) end
    else UI:ApplyLayout(width, height) end
  end)
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
  if self.medalsArea then self.medalsArea:Hide() end
  self:SetDiagBarVisible(false)
end

function UI:Refresh()
  self:Create(); self:HideAllViews(); self:UpdateTabStates()
  local chronicle = self.activeTab == "Chronicle"
  self:SetToolbarVisible(chronicle); if not chronicle then self:CloseMenu() end
  self:PlaceContent(chronicle or self.activeTab == "Diagnostics")
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
    local halls = Addon.Statistics:DescribeHighlights(Addon.Statistics:BuildHighlights())
    local text = Addon.Export:BuildHumanSummary(stats.fromTime, stats.toTime) .. (halls and "\n\n" .. halls or "") .. (Addon.AchievementStats and "\n\n" .. Addon.AchievementStats:BuildText(Addon.characterKey) or "")
    safeMethod(self.content, "SetText", self:ColouriseStatistics(text)); self:ShowTextArea(false)
  elseif self.activeTab == "Characters" then
    safeMethod(self.content, "SetText", self:ColouriseCharacters(Addon.Statistics:DescribeCharacters())); self:ShowTextArea(false)
  elseif self.activeTab == "Medals" then
    if self.medalsArea then self:ShowMedalsPage() end
  elseif self.activeTab == "Settings" then
    self:ShowSettingsPage()
  else
    self.copyText = Addon.Export:BuildDiagnosticReport(); safeMethod(self.copyBox, "SetText", self.copyText); safeMethod(self.copyBox, "Show"); self:ShowTextArea(true); self:SetDiagBarVisible(true)
  end
end

function UI:Show()
  if self:DeferForCombat() then return end
  self:Create()
  local wasShown = self.frame.IsShown and self.frame:IsShown()
  self:Refresh(); safeMethod(self.frame,"Show")
  if not wasShown then Addon.Theme:FadeIn(self.frame, 0.15) end
  if Addon.Launcher then Addon.Launcher:SetAttention(false) end
end

-- Fades the page that is now showing (Chronicle rows are left alone: they are many small frames).
function UI:FadeActivePage()
  local T = Addon.Theme; local tab = self.activeTab
  local page = (tab == "Home" and self.dashboard and self.dashboard.frame) or (tab == "Medals" and self.medalsArea and self.medalsArea.scroll)
    or (tab == "Settings" and self.settingsArea and self.settingsArea.scroll) or ((tab == "Statistics" or tab == "Characters" or tab == "Diagnostics") and self.textScroll) or nil
  if T and page then T:FadeIn(page, 0.12) end
end

function UI:AnimateMedalBars()
  local T = Addon.Theme
  if not (T and self.medalRows) then return end
  for _, row in ipairs(self.medalRows) do if row.entry and row.bar then T:GrowBar(row.bar, 0.35) end end
end
function UI:Hide() if self.frame then safeMethod(self.frame,"Hide") end end
function UI:ShowCopy(text, diagnostics)
  if Addon:InCombat() then self.pendingDiagnostics = diagnostics; self:DeferForCombat(text or ""); return end
  self:Create(); self:HideAllViews(); self:CloseMenu(); self:SetToolbarVisible(false); self:PlaceContent(diagnostics and true or false)
  self:SetDiagBarVisible(diagnostics)
  self.copyText = text or ""; self.textOffset = 0
  safeMethod(self.copyBox, "SetText", self.copyText); safeMethod(self.copyBox, "Show"); self:ShowTextArea(true)
  safeMethod(self.copyBox, "SetFocus"); safeMethod(self.copyBox, "HighlightText"); safeMethod(self.frame, "Show")
end

UI.helpLines={
  "/mam - open or close the Chronicle",
  "/mam remember <text> - pin a memory to your Chronicle",
  "/mam stats - open the Statistics tab",
  "/mam medals - open the Mom Medals tab",
  "/mam settings - open the Settings tab",
  "/mam recap - show a shareable summary of this month to copy (/mam recap week for the last 7 days)",
  "/mam book - open your Memory Book of firsts, milestones, memories and close calls",
  "/mam export - show the Courier export text to copy",
  "/mam diag - show the diagnostics report to paste into a bug report",
  "/mam quests - show this week's Mom Quests and your progress",
  "/mam toast - show a sample toast (test alerts)",
  "/mam help - show this list",
}

function UI:PrintHelp()
  self.lastMessage="Commands: /mam, remember, stats, medals, settings, recap, export, diag, toast, help"
  Addon:Print("Commands:")
  for _,line in ipairs(self.helpLines) do Addon:Print(line) end
end

function UI:HandleSlash(command)
  command=(command or ""):match("^%s*(.-)%s*$"); local verb,rest=command:match("^(%S+)%s*(.-)$"); verb=string.lower(verb or "")
  if verb=="" then self:Toggle()
  elseif verb=="remember" then local event,err=Addon.Collectors:RecordManualMemory(rest); self.lastMessage=event and "Memory saved." or err; Addon:Print(self.lastMessage)
  elseif verb=="stats" then self.activeTab="Statistics"; Addon.db.settings.ui.activeTab="Statistics"; self:Show()
  elseif verb=="medals" then self.activeTab="Medals"; Addon.db.settings.ui.activeTab="Medals"; self:Show()
  elseif verb=="settings" then self.activeTab="Settings"; Addon.db.settings.ui.activeTab="Settings"; self:Show()
  elseif verb=="export" then local value,err=Addon.Export:BuildCourierPayload(0,Addon:Now()); self:ShowCopy(value or err)
  elseif verb=="recap" then
    if string.lower(rest or "")=="week" then self:ShowCopy(Addon.Export:BuildWeeklyRecap())
    else local from,to=self:GetCurrentMonthRange(); self:ShowCopy(Addon.Export:BuildMonthlyRecap(from,to)) end
  elseif verb=="book" then self:ShowCopy(Addon.Statistics:DescribeMemoryBook())
  elseif verb=="quests" then
    local week,questLines=Addon.Medals:DescribeQuests()
    Addon:Print("Week "..tostring(week).." Mom Quests (extra Mom Money, new ones every week):")
    for _,questLine in ipairs(questLines) do Addon:Print(questLine) end
  elseif verb=="toast" then if Addon.Toast then Addon.Toast:SendTest() end
  elseif verb=="diag" then self.activeTab="Diagnostics"; Addon.db.settings.ui.activeTab="Diagnostics"; self:ShowCopy(Addon.Export:BuildDiagnosticReport(), true)
  elseif verb=="help" then self:PrintHelp()
  else self.lastMessage='Unknown command "'..verb..'". Type /mam help for the list.'; Addon:Print(self.lastMessage) end
end

function UI:InitialiseSlashCommands()
  SLASH_MAMCHRONICLES1="/mam"; SlashCmdList.MAMCHRONICLES=function(message) UI:HandleSlash(message) end
end
