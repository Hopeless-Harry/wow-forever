local Addon=MAMChronicles
Addon.Statistics=Addon.Statistics or {}
local Statistics=Addon.Statistics

local totalKeys={
  ["character.level_up"]="levels",["character.death"]="deaths",["character.resurrected"]="resurrections",
  ["quest.accepted"]="questsAccepted",["quest.completed"]="questsCompleted",["world.zone_discovered"]="discoveries",
  ["instance.entered"]="instances",["loot.notable"]="notableLoot",["profession.changed"]="professionChanges",
  ["achievement.earned"]="achievements",["memory.manual"]="memories",
}
local function addAward(list,name,count,evidence)
  if count and count>0 then table.insert(list,{name=name,count=count,sourceEventCount=evidence or count}) end
end

function Statistics:Build(fromTime,toTime,characterKey)
  fromTime=tonumber(fromTime) or 0; toTime=tonumber(toTime) or Addon:Now()
  local result={fromTime=fromTime,toTime=toTime,eventCount=0,sessionCount=0,totals={},byZone={},byType={},awards={},coverage={sourceEventCount=0},sourceEventCounts={totals={},byZone={},byType={}}}
  for _,key in pairs(totalKeys) do result.totals[key]=0; result.sourceEventCounts.totals[key]=0 end
  local zones,falling,murloc= {},0,0
  local compactedEvents=0
  for _,bucket in pairs((Addon.db.aggregates and Addon.db.aggregates.monthly) or {}) do
    local candidate=characterKey and bucket.byCharacter and bucket.byCharacter[characterKey] or (not characterKey and bucket or nil)
    if type(candidate)=="table" and type(candidate.firstAt)=="number" and type(candidate.lastAt)=="number" then
      if candidate.firstAt>=fromTime and candidate.lastAt<=toTime then
        compactedEvents=compactedEvents+(candidate.eventCount or 0); result.eventCount=result.eventCount+(candidate.eventCount or 0); result.coverage.sourceEventCount=result.coverage.sourceEventCount+(candidate.eventCount or 0)
        for eventType,count in pairs(candidate.byType or {}) do result.byType[eventType]=(result.byType[eventType] or 0)+count; result.sourceEventCounts.byType[eventType]=(result.sourceEventCounts.byType[eventType] or 0)+count; local totalKey=totalKeys[eventType]; if totalKey then result.totals[totalKey]=result.totals[totalKey]+count; result.sourceEventCounts.totals[totalKey]=result.sourceEventCounts.totals[totalKey]+count end; if eventType=="session.login" then result.sessionCount=result.sessionCount+count end end
        for zone,count in pairs(candidate.byZone or {}) do result.byZone[zone]=(result.byZone[zone] or 0)+count; result.sourceEventCounts.byZone[zone]=(result.sourceEventCounts.byZone[zone] or 0)+count; zones[zone]=true end
        falling=falling+((candidate.signals and candidate.signals.falling) or 0); murloc=murloc+((candidate.signals and candidate.signals.murloc) or 0)
      elseif candidate.firstAt<=toTime and candidate.lastAt>=fromTime then result.coverage.compactedRangeIncomplete=true; result.coverage.excludedCompactedEventCount=(result.coverage.excludedCompactedEventCount or 0)+(candidate.eventCount or 0) end
    end
  end
  for _,event in ipairs(Addon.db.events) do
    if event.occurredAt>=fromTime and event.occurredAt<=toTime and (not characterKey or event.characterKey==characterKey) then
      result.eventCount=result.eventCount+1; result.coverage.sourceEventCount=result.coverage.sourceEventCount+1
      result.byType[event.type]=(result.byType[event.type] or 0)+1; result.sourceEventCounts.byType[event.type]=(result.sourceEventCounts.byType[event.type] or 0)+1
      if event.type=="session.login" then result.sessionCount=result.sessionCount+1 end
      local totalKey=totalKeys[event.type]; if totalKey then result.totals[totalKey]=result.totals[totalKey]+1; result.sourceEventCounts.totals[totalKey]=result.sourceEventCounts.totals[totalKey]+1 end
      local zone=event.payload and event.payload.zone
      if zone and zone~="" then result.byZone[zone]=(result.byZone[zone] or 0)+1; result.sourceEventCounts.byZone[zone]=(result.sourceEventCounts.byZone[zone] or 0)+1; zones[zone]=true end
      if event.type=="character.death" then
        local kind=string.lower(tostring(event.payload.deathKind or "")); if string.find(kind,"fall",1,true) then falling=falling+1 end
        local context=string.lower(tostring(event.payload.lastHostileTarget or "").." "..tostring(zone or "")); if string.find(context,"murloc",1,true) then murloc=murloc+1 end
      end
    end
  end
  local distinct=0; for _ in pairs(zones) do distinct=distinct+1 end
  addAward(result.awards,"Gravity's Favourite",falling, result.totals.deaths)
  addAward(result.awards,"Murloc Magnet",murloc,result.totals.deaths)
  addAward(result.awards,"Explorer",distinct,result.totals.discoveries)
  addAward(result.awards,"Quest Machine",result.totals.questsCompleted,result.totals.questsCompleted)
  addAward(result.awards,"Shiny Collector",result.totals.notableLoot,result.totals.notableLoot)
  addAward(result.awards,"Comeback Kid",result.totals.resurrections,result.totals.resurrections)
  result.coverage.compactedEventCount=compactedEvents
  return result
end

function Statistics:FormatDuration(seconds)
  seconds=math.max(0,math.floor(tonumber(seconds) or 0)); local hours=math.floor(seconds/3600); local minutes=math.floor((seconds%3600)/60)
  if hours>0 then return tostring(hours).."h "..tostring(minutes).."m" end
  if minutes>0 then return tostring(minutes).."m" end
  return tostring(seconds).."s"
end


-- What the previous session of this character did. Events only exist while playing, so "since you last played" is
-- really "last time you played". Quick relogs (under five minutes) are ignored.
local function ago(seconds)
  if seconds>=2*86400 then return math.floor(seconds/86400).." days ago" end
  if seconds>=86400 then return "yesterday" end
  if seconds>=7200 then return math.floor(seconds/3600).." hours ago" end
  if seconds>=3600 then return "an hour ago" end
  return math.max(1,math.floor(seconds/60)).." minutes ago"
end
local function played(seconds)
  if seconds>=3600 then return math.floor(seconds/3600).."h "..math.floor((seconds%3600)/60).."m" end
  return math.max(1,math.floor(seconds/60)).."m"
end

function Statistics:BuildSinceLastLogin()
  local key=Addon.characterKey; local sessions=Addon.db and Addon.db.sessions
  if not key or type(sessions)~="table" then return nil end
  local currentId=Addon.sessionId
  local index
  for position=#sessions,1,-1 do
    local session=sessions[position]
    if session.characterKey==key and session.id~=currentId and session.startedAt then index=position; break end
  end
  if not index then return nil end
  local previous=sessions[index]
  local currentStart=Addon.Database and Addon.Database.currentSession and Addon.Database.currentSession.startedAt or Addon:Now()
  local from=previous.startedAt
  local to=previous.endedAt
  if not to then
    to=currentStart
    for position=index+1,#sessions do if sessions[position].startedAt then to=math.min(to,sessions[position].startedAt) end end
  end
  local result={away=0,played=previous.endedAt and (previous.endedAt-previous.startedAt) or nil,levels=0,quests=0,deaths=0,discoveries=0,medals=0,points=0,loot=0}
  local any=false
  local lastAt=previous.endedAt
  for _,event in ipairs(Addon.EventStore:Query({characterKey=key,fromTime=from,toTime=to-(previous.endedAt and 0 or 1)})) do
    local kind=event.type
    if not previous.endedAt and event.occurredAt>(lastAt or 0) then lastAt=event.occurredAt end
    if kind=="character.level_up" then result.levels=result.levels+1; any=true
    elseif kind=="quest.completed" then result.quests=result.quests+1; any=true
    elseif kind=="character.death" then result.deaths=result.deaths+1; any=true
    elseif kind=="world.zone_discovered" then result.discoveries=result.discoveries+1; any=true
    elseif kind=="loot.notable" then result.loot=result.loot+1; any=true
    elseif kind=="medal.earned" then result.medals=result.medals+1; result.points=result.points+(tonumber(event.payload.points) or 0); any=true end
  end
  if not any then return nil end
  -- A session that never logged out cleanly ends at its last recorded event.
  result.away=currentStart-(lastAt or to)
  if result.away<300 then return nil end
  return result
end

function Statistics:DescribeSinceLastLogin(summary)
  if not summary then return nil end
  local parts={}
  local function add(count,singular,plural,prefix) if count>0 then table.insert(parts,(prefix or "")..count.." "..(count==1 and singular or plural)) end end
  add(summary.levels,"level","levels","+"); add(summary.quests,"quest","quests"); add(summary.discoveries,"discovery","discoveries")
  add(summary.deaths,"death","deaths"); add(summary.loot,"notable item","notable items")
  if summary.medals>0 then table.insert(parts,summary.medals.." medal"..(summary.medals==1 and "" or "s").." (+"..summary.points.." Mom Money)") end
  local header="Last session ("..ago(summary.away)..(summary.played and (", "..played(summary.played).." played") or "").."): "
  return header..table.concat(parts,", ")
end
