local Addon=MAMChronicles
Addon.UI=Addon.UI or {}
local UI=Addon.UI

UI.tabs={"Chronicle","Statistics","Settings","Diagnostics"}
UI.filters={"All","Deaths","Quests","World","Instances","Loot","Memories"}
UI.activeTab="Chronicle"; UI.activeFilter="All"; UI.search=""; UI.rowPool={}

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

function UI:BuildTimeline(options)
  options=options or {}; local filter=options.filter or self.activeFilter or "All"
  local source=Addon.EventStore:Query({text=options.search or self.search,fromTime=options.fromTime,toTime=options.toTime}); if filter=="All" then return source end
  local result={}; for _,event in ipairs(source) do if groups[filter] and groups[filter][event.type] then table.insert(result,event) end end return result
end

function UI:SetSetting(key,value)
  local allowed={enabled=true,recordCoordinates=true,recordQuestAccepts=true,notableQuality=true,maxEvents=true}
  if not allowed[key] then return false end
  if key=="notableQuality" then value=math.max(4,math.min(5,tonumber(value) or 4))
  elseif key=="maxEvents" then value=math.max(100,math.min(10000,math.floor(tonumber(value) or 10000)))
  else value=value==true end
  Addon.db.settings[key]=value; Addon.db.meta.updatedAt=Addon:Now(); return true
end

function UI:Create()
  if self.frame then return self.frame end
  local frame=CreateFrame("Frame","MAMChroniclesFrame",UIParent,"BackdropTemplate")
  self.frame=frame; safeMethod(frame,"SetSize",780,560); safeMethod(frame,"SetPoint","CENTER"); safeMethod(frame,"SetMovable",true); safeMethod(frame,"EnableMouse",true); safeMethod(frame,"RegisterForDrag","LeftButton"); safeMethod(frame,"SetClampedToScreen",true); safeMethod(frame,"SetResizable",true); safeMethod(frame,"SetMinResize",620,440)
  safeMethod(frame,"SetBackdrop",{bgFile="Interface\\DialogFrame\\UI-DialogBox-Background",edgeFile="Interface\\DialogFrame\\UI-DialogBox-Border",tile=true,tileSize=32,edgeSize=32,insets={left=11,right=12,top=12,bottom=11}})
  safeMethod(frame,"SetScript","OnDragStart",function(f) safeMethod(f,"StartMoving") end); safeMethod(frame,"SetScript","OnDragStop",function(f) safeMethod(f,"StopMovingOrSizing") end)
  local title=frame:CreateFontString(nil,"OVERLAY","GameFontNormalLarge"); safeMethod(title,"SetPoint","TOP",0,-18); safeMethod(title,"SetText","Moms Against Magic Chronicles")
  self.title=title
  local close=CreateFrame("Button",nil,frame,"UIPanelCloseButton"); safeMethod(close,"SetPoint","TOPRIGHT",-7,-7)
  self.tabButtons={}
  for index,name in ipairs(self.tabs) do
    local button=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(button,"SetSize",120,24); safeMethod(button,"SetPoint","TOPLEFT",20+(index-1)*125,-48); safeMethod(button,"SetText",name)
    safeMethod(button,"SetScript","OnClick",function() UI.activeTab=name; UI:Refresh() end); self.tabButtons[index]=button
  end
  local search=CreateFrame("EditBox",nil,frame,"InputBoxTemplate"); safeMethod(search,"SetSize",230,28); safeMethod(search,"SetPoint","TOPLEFT",24,-82); safeMethod(search,"SetAutoFocus",false)
  safeMethod(search,"SetScript","OnTextChanged",function(box) if box.GetText then UI.search=box:GetText() or ""; UI:Refresh() end end); self.searchBox=search
  local filter=CreateFrame("Button",nil,frame,"UIPanelButtonTemplate"); safeMethod(filter,"SetSize",120,24); safeMethod(filter,"SetPoint","LEFT",search,"RIGHT",12,0); safeMethod(filter,"SetText","Filter: All")
  safeMethod(filter,"SetScript","OnClick",function(button) local nextIndex=1; for i,v in ipairs(UI.filters) do if v==UI.activeFilter then nextIndex=i%#UI.filters+1 end end; UI.activeFilter=UI.filters[nextIndex]; safeMethod(button,"SetText","Filter: "..UI.activeFilter); UI:Refresh() end); self.filterButton=filter
  self.content=frame:CreateFontString(nil,"OVERLAY","GameFontHighlight"); safeMethod(self.content,"SetPoint","TOPLEFT",24,-120); safeMethod(self.content,"SetWidth",730); safeMethod(self.content,"SetJustifyH","LEFT")
  for index=1,30 do local row=frame:CreateFontString(nil,"OVERLAY","GameFontHighlightSmall"); safeMethod(row,"SetPoint","TOPLEFT",30,-115-index*14); safeMethod(row,"SetWidth",710); safeMethod(row,"SetJustifyH","LEFT"); self.rowPool[index]=row end
  local copy=CreateFrame("EditBox",nil,frame,"InputBoxTemplate"); safeMethod(copy,"SetMultiLine",true); safeMethod(copy,"SetAutoFocus",false); safeMethod(copy,"SetSize",720,360); safeMethod(copy,"SetPoint","TOPLEFT",26,-140); safeMethod(copy,"Hide"); self.copyBox=copy
  safeMethod(frame,"Hide"); return frame
end

function UI:Refresh()
  self:Create(); for _,row in ipairs(self.rowPool) do safeMethod(row,"Hide") end; safeMethod(self.copyBox,"Hide"); safeMethod(self.content,"SetText","")
  if self.activeTab=="Chronicle" then
    local events=self:BuildTimeline(); if #events==0 then safeMethod(self.content,"SetText","No Chronicle entries match this view yet.") end
    for index=1,math.min(30,#events) do local event=events[index]; local stamp=date and date("%d %b %H:%M",event.occurredAt) or tostring(event.occurredAt); safeMethod(self.rowPool[index],"SetText",stamp.."  "..event.type.." — "..tostring(label(event))); safeMethod(self.rowPool[index],"Show") end
  elseif self.activeTab=="Statistics" then
    local stats=Addon.Statistics:Build(Addon:Now()-2678400,Addon:Now()); safeMethod(self.content,"SetText",Addon.Export:BuildHumanSummary(stats.fromTime,stats.toTime))
  elseif self.activeTab=="Settings" then
    local s=Addon.db.settings; safeMethod(self.content,"SetText","Recording: "..tostring(s.enabled).."\nQuest accepts: "..tostring(s.recordQuestAccepts).."\nEvent coordinates: "..tostring(s.recordCoordinates).."\nNotable quality: "..(s.notableQuality==5 and "Legendary" or "Epic and above").."\nMaximum history: "..tostring(s.maxEvents).."\n\nUse /mam help for commands. Settings controls will expand during the tester pass.")
  else self.copyText=Addon.Export:BuildDiagnosticReport(); safeMethod(self.copyBox,"SetText",self.copyText); safeMethod(self.copyBox,"Show") end
end

function UI:Show() self:Create(); self:Refresh(); safeMethod(self.frame,"Show") end
function UI:Hide() if self.frame then safeMethod(self.frame,"Hide") end end
function UI:ShowCopy(text) self:Create(); self.copyText=text or ""; safeMethod(self.copyBox,"SetText",self.copyText); safeMethod(self.copyBox,"Show"); safeMethod(self.frame,"Show") end

function UI:HandleSlash(command)
  command=(command or ""):match("^%s*(.-)%s*$"); local verb,rest=command:match("^(%S+)%s*(.-)$"); verb=string.lower(verb or "")
  if verb=="" then self.activeTab="Chronicle"; self:Show()
  elseif verb=="remember" then local event,err=Addon.Collectors:RecordManualMemory(rest); self.lastMessage=event and "Memory saved." or err; Addon:Print(self.lastMessage)
  elseif verb=="stats" then self.activeTab="Statistics"; self:Show()
  elseif verb=="export" then local value,err=Addon.Export:BuildCourierPayload(0,Addon:Now()); self:ShowCopy(value or err)
  elseif verb=="diag" then self.activeTab="Diagnostics"; self:ShowCopy(Addon.Export:BuildDiagnosticReport())
  else self.lastMessage="Commands: /mam, remember, stats, export, diag, help"; Addon:Print(self.lastMessage) end
end

function UI:InitialiseSlashCommands()
  SLASH_MAMCHRONICLES1="/mam"; SlashCmdList.MAMCHRONICLES=function(message) UI:HandleSlash(message) end
end
