local Addon = MAMChronicles
Addon.EventStore = Addon.EventStore or {}
local Store = Addon.EventStore

local types = {
  ["session.login"]={}, ["session.logout"]={duration=true},
  ["character.level_up"]={level=true},
  ["character.death"]={zone=true,subzone=true,mapID=true,x=true,y=true,instanceName=true,instanceType=true,lastHostileTarget=true,deathKind=true},
  ["character.resurrected"]={zone=true,mapID=true},
  ["quest.accepted"]={questID=true,questName=true}, ["quest.completed"]={questID=true,questName=true},
  ["world.zone_discovered"]={zone=true,subzone=true,mapID=true,x=true,y=true},
  ["instance.entered"]={instanceName=true,instanceType=true,difficultyID=true,mapID=true}, ["instance.exited"]={instanceName=true,instanceType=true,difficultyID=true,mapID=true},
  ["loot.notable"]={itemID=true,itemName=true,itemLink=true,quality=true,quantity=true},
  ["profession.changed"]={professionID=true,professionName=true,skillLevel=true,maxSkillLevel=true,skillLineID=true},
  ["achievement.earned"]={achievementID=true,achievementName=true,points=true},
  ["memory.manual"]={text=true,zone=true,subzone=true,mapID=true,x=true,y=true},
}

local function finite(value) return type(value)=="number" and value==value and value~=math.huge and value~=-math.huge end
local function cleanValue(key, value)
  if type(value)=="string" then if #value>512 then return string.sub(value,1,512) end return value end
  if type(value)=="number" then
    if not finite(value) then return nil end
    if (key=="x" or key=="y") and (value<0 or value>1) then return nil end
    return value
  end
  if type(value)=="boolean" then return value end
  return nil
end
local function payloadText(payload)
  local parts={}; for key,value in pairs(payload or {}) do table.insert(parts,string.lower(tostring(key).." "..tostring(value))) end
  return table.concat(parts," ")
end

function Store:Initialise()
  self.db=Addon.db; self.sequenceSecond=nil; self.sequence=0; self.recentSemantic={}
  local now=Addon:Now()
  for index=#self.db.events,math.max(1,#self.db.events-100),-1 do
    local event=self.db.events[index]
    if event and event.observedAt and now-event.observedAt<=5 then local key=self:BuildSemanticKey(event.type,event.payload or {}); if key then self.recentSemantic[key]=event.observedAt end end
  end
end

function Store:Sanitise(eventType, payload)
  local allowed=types[eventType]; if not allowed or type(payload)~="table" then return nil end
  local result={}; for key in pairs(allowed) do local value=cleanValue(key,payload[key]); if value~=nil then result[key]=value end end
  return result
end

function Store:BuildSemanticKey(eventType,payload)
  if eventType=="memory.manual" then return nil end
  local identity=payload.questID or payload.itemID or payload.achievementID or payload.mapID or payload.instanceName or payload.level or ""
  if eventType=="profession.changed" then identity=tostring(payload.professionID or payload.skillLineID or payload.professionName or "")..":"..tostring(payload.skillLevel or "") end
  return eventType..":"..tostring(identity)
end

function Store:NextId(eventType, occurredAt)
  if self.sequenceSecond~=occurredAt then self.sequenceSecond=occurredAt; self.sequence=0 end
  self.sequence=self.sequence+1
  return table.concat({Addon.characterKey,eventType,tostring(occurredAt),tostring(self.sequence)},":")
end

function Store:Append(eventType,payload,options)
  if not self.db then self:Initialise() end
  options=options or {}; if options.schemaVersion and options.schemaVersion~=1 then return nil,"future schema" end
  local clean=self:Sanitise(eventType,payload or {}); if not clean then return nil,"unsupported event" end
  local occurredAt=math.floor(tonumber(options.occurredAt) or Addon:Now()); local observedAt=Addon:Now()
  local id=options.id or self:NextId(eventType,occurredAt); if self.db.eventIds[id] then return nil,"duplicate id" end
  local semantic=self:BuildSemanticKey(eventType,clean)
  if semantic and self.recentSemantic[semantic] and observedAt-self.recentSemantic[semantic]<=5 then return nil,"duplicate signal" end
  local _,build=Addon:SafeCall(GetBuildInfo)
  local event={id=id,schemaVersion=1,type=eventType,occurredAt=occurredAt,observedAt=observedAt,characterKey=Addon.characterKey,sessionId=Addon.sessionId,provenance="self",clientBuild=build,addonVersion=Addon.version,payload=clean,pinned=options.pinned==true}
  table.insert(self.db.events,event); self.db.eventIds[id]=true; if semantic then self.recentSemantic[semantic]=observedAt end
  self.db.meta.updatedAt=observedAt
  if #self.db.events>(tonumber(self.db.settings.maxEvents) or 10000)+100 then Addon.Database:Compact() end
  return event
end

function Store:GetById(id)
  if not self.db.eventIds[id] then return nil end
  for _,event in ipairs(self.db.events) do if event.id==id then return event end end
end

function Store:Pin(id,pinned)
  local event=self:GetById(id); if not event then return false end event.pinned=pinned==true; return true
end

function Store:Count(eventType)
  local count=0; for _,event in ipairs(self.db.events) do if not eventType or event.type==eventType then count=count+1 end end return count
end

function Store:Query(filters)
  filters=filters or {}; local result={}; local needle=filters.text and string.lower(filters.text) or nil
  for _,event in ipairs(self.db.events) do
    local matches=(not filters.type or event.type==filters.type) and (not filters.characterKey or event.characterKey==filters.characterKey)
      and (not filters.fromTime or event.occurredAt>=filters.fromTime) and (not filters.toTime or event.occurredAt<=filters.toTime)
    if matches and needle then matches=string.find(string.lower(event.type).." "..payloadText(event.payload),needle,1,true)~=nil end
    if matches then table.insert(result,event) end
  end
  table.sort(result,function(a,b) if a.occurredAt==b.occurredAt then return a.id>b.id end return a.occurredAt>b.occurredAt end)
  return result
end
