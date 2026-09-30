local Addon=MAMChronicles
Addon.Collectors=Addon.Collectors or {}
local Collectors=Addon.Collectors

local events={"PLAYER_LOGIN","PLAYER_LOGOUT","PLAYER_LEVEL_UP","PLAYER_DEAD","PLAYER_ALIVE","PLAYER_UNGHOST","QUEST_ACCEPTED","QUEST_TURNED_IN","ZONE_CHANGED","ZONE_CHANGED_INDOORS","ZONE_CHANGED_NEW_AREA","PLAYER_ENTERING_WORLD","CHAT_MSG_LOOT","GET_ITEM_INFO_RECEIVED","SKILL_LINES_CHANGED","TRADE_SKILL_SHOW","ACHIEVEMENT_EARNED"}
local function safe(fn,...) return Addon:SafeCall(fn,...) end

function Collectors:Register()
  if self.registered then return end
  self.status={registered={},unavailable={},errors={}}; self.pendingItems={}
  for _,eventName in ipairs(events) do
    local ok=pcall(function() Addon.eventFrame:RegisterEvent(eventName) end)
    if ok then self.status.registered[eventName]=true else self.status.unavailable[eventName]=true end
  end
  self.registered=true
end

function Collectors:GetCollectorStatus() return self.status end

function Collectors:CaptureLocation()
  local payload={zone=safe(GetZoneText),subzone=safe(GetSubZoneText)}
  if C_Map and C_Map.GetBestMapForUnit then payload.mapID=safe(C_Map.GetBestMapForUnit,"player") end
  if Addon.db.settings.recordCoordinates and payload.mapID and C_Map and C_Map.GetPlayerMapPosition then
    local position=safe(C_Map.GetPlayerMapPosition,payload.mapID,"player")
    if position and position.GetXY then payload.x,payload.y=safe(position.GetXY,position) end
  end
  return payload
end

function Collectors:QuestName(questID)
  if C_QuestLog and C_QuestLog.GetTitleForQuestID then return safe(C_QuestLog.GetTitleForQuestID,questID) end
  return nil
end

function Collectors:CaptureInstance()
  local inInstance,instanceType=safe(IsInInstance); inInstance=inInstance==true
  if inInstance==self.inInstance then return end
  local name,_,difficultyID,_,_,_,_,mapID=safe(GetInstanceInfo)
  if inInstance then
    Addon.EventStore:Append("instance.entered",{instanceName=name,instanceType=instanceType,difficultyID=difficultyID,mapID=mapID})
  elseif self.inInstance then
    local previous=self.lastInstance or {}
    Addon.EventStore:Append("instance.exited",previous)
  end
  self.inInstance=inInstance
  if inInstance then self.lastInstance={instanceName=name,instanceType=instanceType,difficultyID=difficultyID,mapID=mapID} end
end

function Collectors:ResolveItem(itemID,itemLink,quantity)
  if not GetItemInfo then return false end
  local name,link,quality=safe(GetItemInfo,itemLink or itemID)
  if not name then self.pendingItems[itemID]={itemID=itemID,itemLink=itemLink,quantity=quantity}; return false end
  if tonumber(quality) and quality>=(tonumber(Addon.db.settings.notableQuality) or 4) then
    Addon.EventStore:Append("loot.notable",{itemID=itemID,itemName=name,itemLink=link or itemLink,quality=quality,quantity=quantity or 1})
  end
  self.pendingItems[itemID]=nil; return true
end

function Collectors:CaptureLoot(message)
  if type(message)~="string" then return end
  local link=string.match(message,"(|c%x+|Hitem:.-|h%[.-%]|h|r)") or string.match(message,"(|Hitem:.-|h%[.-%]|h)")
  if not link then return end
  local quantity=1; local isSelf=type(LOOT_ITEM_SELF)=="string" and string.format(LOOT_ITEM_SELF,link)==message
  if not isSelf and type(LOOT_ITEM_SELF_MULTIPLE)=="string" then
    local pattern=LOOT_ITEM_SELF_MULTIPLE:gsub("%%s","\001"):gsub("%%d","\002"):gsub("([%(%)%.%%%+%-%*%?%[%]%^%$])","%%%1"):gsub("\001","(.+)"):gsub("\002","(%%d+)")
    local capturedLink,capturedQuantity=string.match(message,"^"..pattern.."$")
    if capturedLink==link then isSelf=true; quantity=tonumber(capturedQuantity) or 1 end
  end
  if not isSelf then return end
  local id=link and tonumber(string.match(link,"item:(%d+)"))
  if not id and GetItemInfoInstant then id=safe(GetItemInfoInstant,link) end
  if id then self:ResolveItem(id,link,quantity) end
end

function Collectors:CaptureProfessionSnapshot()
  if not GetProfessions or not GetProfessionInfo then return end
  local first,second,archaeology,fishing,cooking=safe(GetProfessions)
  local indices={first,second,archaeology,fishing,cooking}
  for slot=1,5 do local index=indices[slot]; if type(index)=="number" then
    local name,_,skill,maxSkill,_,_,skillLineID=safe(GetProfessionInfo,index)
    local key=tostring(skillLineID or name or index); local old=Addon.db.professionSnapshots[key]
    if name and (not old or old.skillLevel~=skill or old.maxSkillLevel~=maxSkill) then
      local snapshot={professionID=skillLineID,professionName=name,skillLevel=skill,maxSkillLevel=maxSkill,skillLineID=skillLineID}
      Addon.db.professionSnapshots[key]=snapshot; Addon.EventStore:Append("profession.changed",snapshot)
    end
  end end
end

function Collectors:RecordManualMemory(text)
  text=type(text)=="string" and text:match("^%s*(.-)%s*$") or nil
  if not text or text=="" then return nil,"Memory text is required." end
  if #text>500 then text=string.sub(text,1,500) end
  local payload=self:CaptureLocation(); payload.text=text
  return Addon.EventStore:Append("memory.manual",payload,{pinned=true})
end

function Collectors:HandleEvent(eventName,...)
  if not Addon.db.settings.enabled and eventName~="PLAYER_LOGOUT" then return end
  local args={...}
  local ok,err=pcall(function()
    if eventName=="PLAYER_LOGIN" then Addon.Database:BeginSession(); Addon.EventStore:Append("session.login",{})
    elseif eventName=="PLAYER_LOGOUT" then Addon.EventStore:Append("session.logout",{}); Addon.Database:EndSession()
    elseif eventName=="PLAYER_LEVEL_UP" then Addon.EventStore:Append("character.level_up",{level=args[1]})
    elseif eventName=="PLAYER_DEAD" then
      local payload=self:CaptureLocation()
      if UnitCanAttack and safe(UnitCanAttack,"player","target") then payload.lastHostileTarget=safe(UnitName,"target") end
      Addon.EventStore:Append("character.death",payload); self.isDeadObserved=true
    elseif (eventName=="PLAYER_ALIVE" or eventName=="PLAYER_UNGHOST") and self.isDeadObserved then Addon.EventStore:Append("character.resurrected",self:CaptureLocation()); self.isDeadObserved=false
    elseif eventName=="QUEST_ACCEPTED" and Addon.db.settings.recordQuestAccepts then local questID=args[2]; Addon.EventStore:Append("quest.accepted",{questID=questID,questName=self:QuestName(questID)})
    elseif eventName=="QUEST_TURNED_IN" then local questID=args[1]; Addon.EventStore:Append("quest.completed",{questID=questID,questName=self:QuestName(questID)}); Addon.db.questCompletion[questID]=Addon:Now()
    elseif eventName=="ZONE_CHANGED" or eventName=="ZONE_CHANGED_INDOORS" or eventName=="ZONE_CHANGED_NEW_AREA" then Addon.EventStore:Append("world.zone_discovered",self:CaptureLocation())
    elseif eventName=="PLAYER_ENTERING_WORLD" then self:CaptureInstance()
    elseif eventName=="CHAT_MSG_LOOT" then self:CaptureLoot(args[1])
    elseif eventName=="GET_ITEM_INFO_RECEIVED" then local itemID,success=args[1],args[2]; if success and self.pendingItems[itemID] then local p=self.pendingItems[itemID]; self:ResolveItem(itemID,p.itemLink,p.quantity) end
    elseif eventName=="SKILL_LINES_CHANGED" or eventName=="TRADE_SKILL_SHOW" then self:CaptureProfessionSnapshot()
    elseif eventName=="ACHIEVEMENT_EARNED" then local id,name,points=args[1],nil,nil; if GetAchievementInfo then local ignored; ignored,name,points=safe(GetAchievementInfo,id) end; Addon.EventStore:Append("achievement.earned",{achievementID=id,achievementName=name,points=points}) end
  end)
  if not ok then table.insert(self.status.errors,{event=eventName,message=tostring(err),at=Addon:Now()}) end
end
