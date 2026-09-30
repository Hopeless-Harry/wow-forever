local Addon=MAMChronicles
Addon.UI=Addon.UI or {}
local UI=Addon.UI

UI.tabs={"Chronicle","Statistics","Settings","Diagnostics"}
UI.filters={"All","Deaths","Quests","World","Instances","Loot","Memories"}
UI.dateRanges={"All","30 Days","This Month"}
UI.activeTab="Chronicle"; UI.activeFilter="All"; UI.activeRange="All"; UI.search=""; UI.rowPool={}

local validTabs={Chronicle=true,Statistics=true,Settings=true,Diagnostics=true}
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
local function safeMethod(object,method,...)
  if object and type(object[method])=="function" then pcall(object[method],object,...) end
end
local function finite(value) return type(value)=="number" and value==value and value~=math.huge and value~=-math.huge end
local function clamp(value,minimum,maximum) return math.max(minimum,math.min(maximum,value)) end

function UI:SetActiveTab(name)
  if not validTabs[name] then return false end
  self.activeTab=name
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
  safeMethod(self.previousButton,"SetEnabled",offset>0); safeMethod(self.nextButton,"SetEnabled",offset<maximum)
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
  safeMethod(control,"SetScript","OnEnter",function(owner)
    if not GameTooltip then return end
    safeMethod(GameTooltip,"SetOwner",owner,"ANCHOR_RIGHT"); safeMethod(GameTooltip,"SetText",title); safeMethod(GameTooltip,"AddLine",instruction); safeMethod(GameTooltip,"Show")
  end)
  safeMethod(control,"SetScript","OnLeave",function() if GameTooltip then safeMethod(GameTooltip,"Hide") end end)
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
  self.activeTab="Chronicle"; self:RestoreWindowState(); self:Refresh()
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

function UI:SetSetting(key,value)
  local allowed={enabled=true,recordCoordinates=true,recordQuestAccepts=true,notableQuality=true,maxEvents=true,recordStatistics=true,recordGoldStatistics=true}
  if key=="showMinimapButton" and Addon.SettingsPanel then return Addon.SettingsPanel:ApplySetting(key,value==true) end
  if not allowed[key] then return false end
  if key=="notableQuality" then value=math.max(4,math.min(5,tonumber(value) or 4))
  elseif key=="maxEvents" then value=math.max(100,math.min(10000,math.floor(tonumber(value) or 10000)))
  else value=value==true end
  Addon.db.settings[key]=value; Addon.db.meta.updatedAt=Addon:Now()
  if key=="recordGoldStatistics" and not value and Addon.AchievementStats then Addon.AchievementStats:PurgeGold() end
  return true
end

function UI:Create()
  if self.frame then return self.frame end
  local frame=CreateFrame("Frame","MAMChroniclesFrame",UIParent,"BackdropTemplate")
  self.frame=frame; self:RestoreWindowState(); safeMethod(frame,"SetMovable",true); safeMethod(frame,"EnableMouse",true); safeMethod(frame,"RegisterForDrag","LeftButton"); safeMethod(frame,"SetClampedToScreen",true); safeMethod(frame,"SetResizable",true); safeMethod(frame,"SetMinResize",620,440)
  safeMethod(frame,"SetBackdrop",{bgFile="Interface\\DialogFrame\\UI-DialogBox-Background",edgeFile="Interface\\DialogFrame\\UI-DialogBox-Border",tile=true,tileSize=32,edgeSize=32,insets={left=11,right=12,top=12,bottom=11}})
  safeMethod(frame,"SetScript","OnDragStart",function(f) safeMethod(f,"StartMoving") end); safeMethod(frame,"SetScript","OnDragStop",function(f) safeMethod(f,"StopMovingOrSizing"); UI:SaveWindowState() end)
  if type(UISpecialFrames)=="table" then local found=false; for _,name in ipairs(UISpecialFrames) do if name=="MAMChroniclesFrame" then found=true; break end end; if not found then table.insert(UISpecialFrames,"MAMChroniclesFrame") end end
  local title=frame:CreateFontString(nil,"OVERLAY","GameFontNormalLarge"); safeMethod(title,"SetPoint","TOP",0,-18); safeMethod(title,"SetText","Moms Against Magic Chronicles")
  self.title=title
  local close=CreateFrame("Button",nil,frame,"UIPanelCloseButton"); safeMethod(close,"SetPoint","TOPRIGHT",-7,-7)
  local resize=CreateFrame("Button",nil,frame); safeMethod(resize,"SetSize",18,18); safeMethod(resize,"SetPoint","BOTTOMRIGHT",-8,8)
  safeMethod(resize,"SetNormalTexture","Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Up"); safeMethod(resize,"SetPushedTexture","Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Down"); safeMethod(resize,"SetHighlightTexture","Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Highlight")
  safeMethod(resize,"SetScript","OnMouseDown",function(_,button) if button=="LeftButton" then safeMethod(frame,"StartSizing","BOTTOMRIGHT") end end); safeMethod(resize,"SetScript","OnMouseUp",function() safeMethod(frame,"StopMovingOrSizing"); UI:SaveWindowState() end); self.resizeHandle=resize
  self.tabButtons={}
  for index,name in ipairs(self.tabs) do
    local button=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(button,"SetSize",120,24); safeMethod(button,"SetPoint","TOPLEFT",20+(index-1)*125,-48); safeMethod(button,"SetText",name)
    safeMethod(button,"SetScript","OnClick",function() UI:SetActiveTab(name) end); self.tabButtons[index]=button
  end
  local search=CreateFrame("EditBox",nil,frame,"InputBoxTemplate"); safeMethod(search,"SetSize",230,28); safeMethod(search,"SetPoint","TOPLEFT",24,-82); safeMethod(search,"SetAutoFocus",false)
  safeMethod(search,"SetScript","OnTextChanged",function(box) if box.GetText then UI.search=box:GetText() or ""; UI.timelineOffset=0; UI:Refresh() end end); self.searchBox=search; attachTooltip(search,"Search","Type words to find matching Chronicle entries.")
  local filter=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(filter,"SetSize",120,24); safeMethod(filter,"SetPoint","LEFT",search,"RIGHT",12,0); safeMethod(filter,"SetText","Filter: All")
  safeMethod(filter,"SetScript","OnClick",function(button) UI:OpenFilterMenu(button) end); self.filterButton=filter; attachTooltip(filter,"Filter","Choose which kind of entry to show.")
  local range=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(range,"SetSize",120,24); safeMethod(range,"SetPoint","LEFT",filter,"RIGHT",12,0); safeMethod(range,"SetText","Range: All")
  safeMethod(range,"SetScript","OnClick",function(button) UI:OpenRangeMenu(button) end); self.rangeButton=range; attachTooltip(range,"Date range","Choose how far back to look.")
  self.content=frame:CreateFontString(nil,"OVERLAY","GameFontHighlight"); safeMethod(self.content,"SetPoint","TOPLEFT",24,-120); safeMethod(self.content,"SetWidth",730); safeMethod(self.content,"SetJustifyH","LEFT")
  for index=1,30 do local row=frame:CreateFontString(nil,"OVERLAY","GameFontHighlightSmall"); safeMethod(row,"SetPoint","TOPLEFT",30,-115-index*14); safeMethod(row,"SetWidth",710); safeMethod(row,"SetJustifyH","LEFT"); self.rowPool[index]=row end
  local previous=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(previous,"SetSize",90,22); safeMethod(previous,"SetPoint","BOTTOMLEFT",28,24); safeMethod(previous,"SetText","Previous"); safeMethod(previous,"SetScript","OnClick",function() UI:SetTimelineOffset((UI.timelineOffset or 0)-30,UI.timelineTotal); UI:Refresh() end); self.previousButton=previous; attachTooltip(previous,"Previous page","Show newer entries.")
  local nextPage=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(nextPage,"SetSize",90,22); safeMethod(nextPage,"SetPoint","LEFT",previous,"RIGHT",8,0); safeMethod(nextPage,"SetText","Next"); safeMethod(nextPage,"SetScript","OnClick",function() UI:SetTimelineOffset((UI.timelineOffset or 0)+30,UI.timelineTotal); UI:Refresh() end); self.nextButton=nextPage; attachTooltip(nextPage,"Next page","Show older entries.")
  local scroll=CreateFrame("ScrollFrame",nil,frame); safeMethod(scroll,"SetPoint","TOPLEFT",24,-112); safeMethod(scroll,"SetPoint","BOTTOMRIGHT",-24,58); safeMethod(scroll,"EnableMouseWheel",true); safeMethod(scroll,"SetScript","OnMouseWheel",function(_,delta) UI:SetTimelineOffset((UI.timelineOffset or 0)-(delta*5),UI.timelineTotal); UI:Refresh() end); self.scrollFrame=scroll
  local slider=CreateFrame("Slider",nil,frame); safeMethod(slider,"SetOrientation","VERTICAL"); safeMethod(slider,"SetSize",16,300); safeMethod(slider,"SetPoint","TOPRIGHT",-10,-120); safeMethod(slider,"SetMinMaxValues",0,0); safeMethod(slider,"SetValueStep",1); safeMethod(slider,"SetObeyStepOnDrag",true)
  safeMethod(slider,"SetThumbTexture","Interface\\Buttons\\UI-ScrollBar-Knob"); safeMethod(slider,"SetBackdrop",{bgFile="Interface\\Buttons\\UI-SliderBar-Background",tile=true,tileSize=8})
  safeMethod(slider,"SetScript","OnValueChanged",function(_,value) if UI.updatingSlider then return end; UI:SetTimelineOffset(value,UI.timelineTotal); UI:Refresh() end); self.slider=slider; attachTooltip(slider,"Timeline position","Drag or use the mouse wheel to scroll.")
  local menu=CreateFrame("Frame",nil,frame,"BackdropTemplate"); safeMethod(menu,"SetFrameStrata","DIALOG"); safeMethod(menu,"SetBackdrop",{bgFile="Interface\\DialogFrame\\UI-DialogBox-Background",edgeFile="Interface\\Tooltips\\UI-Tooltip-Border",tile=true,tileSize=16,edgeSize=12,insets={left=3,right=3,top=3,bottom=3}}); safeMethod(menu,"Hide")
  self.menu=menu; self.menuButtons={}
  for index=1,math.max(#self.filters,#self.dateRanges) do local b=CreateFrame("Button",nil,menu,"UIPanelButtonTemplate"); safeMethod(b,"SetSize",120,20); safeMethod(b,"SetPoint","TOPLEFT",5,-4-(index-1)*22); safeMethod(b,"Hide"); self.menuButtons[index]=b end
  local copy=CreateFrame("EditBox",nil,frame,"InputBoxTemplate"); safeMethod(copy,"SetMultiLine",true); safeMethod(copy,"SetAutoFocus",false); safeMethod(copy,"SetSize",720,360); safeMethod(copy,"SetPoint","TOPLEFT",26,-140); safeMethod(copy,"Hide"); self.copyBox=copy
  self.details=frame:CreateFontString(nil,"OVERLAY","GameFontHighlightSmall"); safeMethod(self.details,"SetPoint","TOPRIGHT",-28,-138); safeMethod(self.details,"SetWidth",260); safeMethod(self.details,"SetJustifyH","LEFT"); safeMethod(self.details,"SetText","Select an entry to inspect its details.")
  self.rowButtons={}
  for index=1,30 do local button=CreateFrame("Button",nil,frame); safeMethod(button,"SetPoint","TOPLEFT",26,-115-index*14); safeMethod(button,"SetSize",430,14); safeMethod(button,"SetScript","OnClick",function(clicked) UI.selectedEvent=clicked.event; safeMethod(UI.details,"SetText",UI:FormatEventDetails(clicked.event)) end); self.rowButtons[index]=button end
  self.settingControls={}
  local settingDefs={{"enabled","Record Chronicle"},{"recordQuestAccepts","Record quest accepts"},{"recordCoordinates","Attach coordinates to events"},{"showMinimapButton","Show minimap button"},{"recordStatistics","Collect achievement statistics"},{"recordGoldStatistics","Include gold statistics (stays on this computer)"}}
  for index,definition in ipairs(settingDefs) do
    local key,text=definition[1],definition[2]; local check=CreateFrame("CheckButton",nil,frame,"UICheckButtonTemplate"); safeMethod(check,"SetPoint","TOPLEFT",index>3 and 360 or 28,-145-((index-1)%3)*30); safeMethod(check,"SetChecked",Addon.db.settings[key]); local caption=check:CreateFontString(nil,"OVERLAY","GameFontHighlight"); safeMethod(caption,"SetPoint","LEFT",check,"RIGHT",4,0); safeMethod(caption,"SetText",text)
    safeMethod(check,"SetScript","OnClick",function(button) local checked=button.GetChecked and button:GetChecked() or not Addon.db.settings[key]; UI:SetSetting(key,checked); UI:Refresh() end); self.settingControls[#self.settingControls+1]=check; self.settingControls[#self.settingControls+1]=caption
  end
  local quality=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(quality,"SetSize",210,24); safeMethod(quality,"SetPoint","TOPLEFT",30,-250); safeMethod(quality,"SetText",Addon.db.settings.notableQuality==5 and "Loot: Legendary only" or "Loot: Epic and above"); safeMethod(quality,"SetScript","OnClick",function(button) local nextValue=Addon.db.settings.notableQuality==4 and 5 or 4; UI:SetSetting("notableQuality",nextValue); safeMethod(button,"SetText",nextValue==5 and "Loot: Legendary only" or "Loot: Epic and above") end); self.qualityButton=quality; self.settingControls[#self.settingControls+1]=quality
  local history=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(history,"SetSize",210,24); safeMethod(history,"SetPoint","TOPLEFT",30,-282); safeMethod(history,"SetText","History: "..tostring(Addon.db.settings.maxEvents)); safeMethod(history,"SetScript","OnClick",function(button) local current=Addon.db.settings.maxEvents; local nextValue=current>=10000 and 1000 or (current>=5000 and 10000 or 5000); UI:SetSetting("maxEvents",nextValue); safeMethod(button,"SetText","History: "..tostring(nextValue)); Addon.Database:Compact() end); self.historyButton=history; self.settingControls[#self.settingControls+1]=history
  local actions={{"Reset Window",-314,"ResetWindow"},{"Reset Minimap Button",-346,"ResetMinimap"},{"Erase Chronicle Data...",-378,"RequestEraseHistory"}}
  for _,action in ipairs(actions) do
    local button=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(button,"SetSize",210,24); safeMethod(button,"SetPoint","TOPLEFT",30,action[2]); safeMethod(button,"SetText",action[1])
    safeMethod(button,"SetScript","OnClick",function() if Addon.SettingsPanel then Addon.SettingsPanel[action[3]](Addon.SettingsPanel) end end); self.settingControls[#self.settingControls+1]=button
    if action[3]=="RequestEraseHistory" then self.eraseButton=button; attachTooltip(button,"Erase Chronicle Data","Permanently deletes recorded history. Settings are kept.")
    elseif action[3]=="ResetWindow" then attachTooltip(button,"Reset Window","Restore the window size and position.")
    else attachTooltip(button,"Reset Minimap Button","Put the minimap button back in its default place.") end
  end
  for _,control in ipairs(self.settingControls) do safeMethod(control,"Hide") end
  safeMethod(frame,"Hide"); return frame
end

function UI:Refresh()
  self:Create(); for _,row in ipairs(self.rowPool) do safeMethod(row,"Hide") end; for _,button in ipairs(self.rowButtons) do button.event=nil; safeMethod(button,"Hide") end; for _,control in ipairs(self.settingControls) do safeMethod(control,"Hide") end; safeMethod(self.previousButton,"Hide"); safeMethod(self.nextButton,"Hide"); safeMethod(self.scrollFrame,"Hide"); safeMethod(self.slider,"Hide"); safeMethod(self.details,"Hide"); safeMethod(self.copyBox,"Hide"); safeMethod(self.content,"SetText",""); self:UpdateTabStates()
  if self.activeTab=="Chronicle" then
    safeMethod(self.previousButton,"Show"); safeMethod(self.nextButton,"Show"); safeMethod(self.scrollFrame,"Show"); safeMethod(self.slider,"Show"); safeMethod(self.details,"Show")
    local events,total=self:GetVisibleTimeline(); if total==0 then local unfiltered=self.activeFilter=="All" and self.activeRange=="All" and (self.search or "")==""; safeMethod(self.content,"SetText",unfiltered and "No Chronicle entries yet. Play for a while, or use /mam remember to add a memory." or "No entries match this filter, range, or search. Try widening them.") else safeMethod(self.content,"SetText","Showing "..tostring(self.timelineOffset+1).."-"..tostring(self.timelineOffset+#events).." of "..tostring(total)) end
    for index=1,#events do local event=events[index]; local stamp=date and date("%d %b %H:%M",event.occurredAt) or tostring(event.occurredAt); safeMethod(self.rowPool[index],"SetWidth",420); safeMethod(self.rowPool[index],"SetText",stamp.."  "..event.type.." — "..tostring(label(event))); safeMethod(self.rowPool[index],"Show"); self.rowButtons[index].event=event; safeMethod(self.rowButtons[index],"Show") end
  elseif self.activeTab=="Statistics" then
    local fromTime,toTime=self:GetCurrentMonthRange(); local stats=Addon.Statistics:Build(fromTime,toTime); safeMethod(self.content,"SetText",Addon.Export:BuildHumanSummary(stats.fromTime,stats.toTime)..(Addon.AchievementStats and "\n\n"..Addon.AchievementStats:BuildText(Addon.characterKey) or ""))
  elseif self.activeTab=="Settings" then
    safeMethod(self.content,"SetText","Privacy and recording controls"); for _,control in ipairs(self.settingControls) do safeMethod(control,"Show") end
  else self.copyText=Addon.Export:BuildDiagnosticReport(); safeMethod(self.copyBox,"SetText",self.copyText); safeMethod(self.copyBox,"Show") end
end

function UI:Show() self:Create(); self:Refresh(); safeMethod(self.frame,"Show") end
function UI:Hide() if self.frame then safeMethod(self.frame,"Hide") end end
function UI:ShowCopy(text)
  self:Create(); for _,row in ipairs(self.rowPool) do safeMethod(row,"Hide") end; for _,button in ipairs(self.rowButtons) do button.event=nil; safeMethod(button,"Hide") end; for _,control in ipairs(self.settingControls) do safeMethod(control,"Hide") end
  safeMethod(self.previousButton,"Hide"); safeMethod(self.nextButton,"Hide"); safeMethod(self.scrollFrame,"Hide"); safeMethod(self.slider,"Hide"); self:CloseMenu(); safeMethod(self.details,"Hide"); safeMethod(self.content,"SetText","")
  self.copyText=text or ""; safeMethod(self.copyBox,"SetText",self.copyText); safeMethod(self.copyBox,"Show"); safeMethod(self.copyBox,"SetFocus"); safeMethod(self.copyBox,"HighlightText"); safeMethod(self.frame,"Show")
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
