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
  local result={fromTime=fromTime,toTime=toTime,eventCount=0,sessionCount=0,totals={},byZone={},byType={},awards={},coverage={sourceEventCount=0}}
  for _,key in pairs(totalKeys) do result.totals[key]=0 end
  local zones,falling,murloc= {},0,0
  for _,event in ipairs(Addon.db.events) do
    if event.occurredAt>=fromTime and event.occurredAt<=toTime and (not characterKey or event.characterKey==characterKey) then
      result.eventCount=result.eventCount+1; result.coverage.sourceEventCount=result.coverage.sourceEventCount+1
      result.byType[event.type]=(result.byType[event.type] or 0)+1
      if event.type=="session.login" then result.sessionCount=result.sessionCount+1 end
      local totalKey=totalKeys[event.type]; if totalKey then result.totals[totalKey]=result.totals[totalKey]+1 end
      local zone=event.payload and event.payload.zone
      if zone and zone~="" then result.byZone[zone]=(result.byZone[zone] or 0)+1; zones[zone]=true end
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
  return result
end

function Statistics:FormatDuration(seconds)
  seconds=math.max(0,math.floor(tonumber(seconds) or 0)); local hours=math.floor(seconds/3600); local minutes=math.floor((seconds%3600)/60)
  if hours>0 then return tostring(hours).."h "..tostring(minutes).."m" end
  if minutes>0 then return tostring(minutes).."m" end
  return tostring(seconds).."s"
end
