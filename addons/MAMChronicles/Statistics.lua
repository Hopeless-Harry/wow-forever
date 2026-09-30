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
    if not characterKey and type(bucket)=="table" and type(bucket.firstAt)=="number" and type(bucket.lastAt)=="number" and bucket.firstAt>=fromTime and bucket.lastAt<=toTime then
      compactedEvents=compactedEvents+(bucket.eventCount or 0); result.eventCount=result.eventCount+(bucket.eventCount or 0); result.coverage.sourceEventCount=result.coverage.sourceEventCount+(bucket.eventCount or 0)
      for eventType,count in pairs(bucket.byType or {}) do result.byType[eventType]=(result.byType[eventType] or 0)+count; result.sourceEventCounts.byType[eventType]=(result.sourceEventCounts.byType[eventType] or 0)+count; local totalKey=totalKeys[eventType]; if totalKey then result.totals[totalKey]=result.totals[totalKey]+count; result.sourceEventCounts.totals[totalKey]=result.sourceEventCounts.totals[totalKey]+count end; if eventType=="session.login" then result.sessionCount=result.sessionCount+count end end
      for zone,count in pairs(bucket.byZone or {}) do result.byZone[zone]=(result.byZone[zone] or 0)+count; result.sourceEventCounts.byZone[zone]=(result.sourceEventCounts.byZone[zone] or 0)+count; zones[zone]=true end
      falling=falling+((bucket.signals and bucket.signals.falling) or 0); murloc=murloc+((bucket.signals and bucket.signals.murloc) or 0)
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
