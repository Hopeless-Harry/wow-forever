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


-- Hall of Shame and Fame: fun facts worked out from the events still in the journal (older history may be compacted).
local function dayLabel(timestamp)
  local dateFn=date or (os and os.date)
  return dateFn and dateFn("%d %b %Y",timestamp) or tostring(math.floor(timestamp/86400))
end
local function dayKey(timestamp) return math.floor(timestamp/86400) end
local function topOf(counts)
  local bestKey,bestCount
  for key,count in pairs(counts) do
    if not bestCount or count>bestCount or (count==bestCount and tostring(key)<tostring(bestKey)) then bestKey,bestCount=key,count end
  end
  return bestKey,bestCount
end

function Statistics:BuildHighlights(characterKey)
  characterKey=characterKey or Addon.characterKey
  local result={deaths=0,falls=0,timePlayed=0,longestSession=0,highestLevel=0}
  local deathZones,deathDays,eventDays,discoveryZones={}, {}, {}, {}
  for _,event in ipairs(Addon.EventStore:Query({characterKey=characterKey})) do
    local kind,payload,at=event.type,event.payload or {},event.occurredAt
    if not result.firstAt or at<result.firstAt then result.firstAt=at end
    if not kind:match("^session%.") and kind~="medal.earned" then eventDays[dayKey(at)]=(eventDays[dayKey(at)] or 0)+1 end
    if kind=="character.death" then
      result.deaths=result.deaths+1
      if payload.zone then deathZones[payload.zone]=(deathZones[payload.zone] or 0)+1 end
      deathDays[dayKey(at)]=(deathDays[dayKey(at)] or 0)+1
      if string.find(string.lower(tostring(payload.deathKind or "")),"fall",1,true) then result.falls=result.falls+1 end
    elseif kind=="world.zone_discovered" and payload.zone then discoveryZones[payload.zone]=(discoveryZones[payload.zone] or 0)+1
    elseif kind=="session.logout" and tonumber(payload.duration) then
      result.timePlayed=result.timePlayed+payload.duration
      if payload.duration>result.longestSession then result.longestSession=payload.duration end
    elseif kind=="character.level_up" and tonumber(payload.level) and payload.level>result.highestLevel then result.highestLevel=payload.level end
  end
  result.deathZone,result.deathZoneCount=topOf(deathZones)
  local worstDay,worstCount=topOf(deathDays)
  if worstDay then result.worstDayAt,result.worstDayDeaths=worstDay*86400+43200,worstCount end
  local busiest,busiestCount=topOf(eventDays)
  if busiest then result.busiestDayAt,result.busiestDayEvents=busiest*86400+43200,busiestCount end
  result.favouriteZone,result.favouriteZoneCount=topOf(discoveryZones)
  return result
end

local function span(seconds)
  if seconds>=3600 then return math.floor(seconds/3600).."h "..math.floor((seconds%3600)/60).."m" end
  return math.max(1,math.floor(seconds/60)).."m"
end

function Statistics:DescribeHighlights(h)
  if not h then return nil end
  local shame,fame={}, {}
  if h.deathZone then table.insert(shame,"Most dangerous place: "..h.deathZone.." ("..h.deathZoneCount.." death"..(h.deathZoneCount==1 and "" or "s")..")") end
  if h.worstDayDeaths then table.insert(shame,"Worst day: "..dayLabel(h.worstDayAt).." ("..h.worstDayDeaths.." death"..(h.worstDayDeaths==1 and "" or "s")..")") end
  if h.falls>0 then table.insert(shame,"Falls: "..h.falls) end
  if h.busiestDayEvents then table.insert(fame,"Busiest day: "..dayLabel(h.busiestDayAt).." ("..h.busiestDayEvents.." entries)") end
  if h.longestSession>0 then table.insert(fame,"Longest session: "..span(h.longestSession)) end
  if h.timePlayed>0 then table.insert(fame,"Time played: "..span(h.timePlayed).." (recorded sessions)") end
  if h.favouriteZone then table.insert(fame,"Favourite place: "..h.favouriteZone.." ("..h.favouriteZoneCount.." discover"..(h.favouriteZoneCount==1 and "y" or "ies")..")") end
  if h.highestLevel>0 then table.insert(fame,"Highest level: "..h.highestLevel) end
  if h.firstAt then table.insert(fame,"Chronicle started: "..dayLabel(h.firstAt)) end
  local lines={}
  if #shame>0 then table.insert(lines,"Hall of Shame"); for _,line in ipairs(shame) do table.insert(lines,"  "..line) end end
  if #fame>0 then table.insert(lines,"Hall of Fame"); for _,line in ipairs(fame) do table.insert(lines,"  "..line) end end
  if #lines==0 then return nil end
  return table.concat(lines,"\n")
end


-- Every character of this account that has used the addon, from our own saved data (local only, nothing is shared).
function Statistics:BuildCharacters()
  local database=Addon.db
  local list={}
  for key,record in pairs(database and database.characters or {}) do
    if type(record)=="table" then
      local entry={key=key,name=tostring(record.name or "Unknown"),realm=record.realm,className=record.className,level=tonumber(record.level),
        lastSeenAt=tonumber(record.lastSeenAt) or 0,isCurrent=key==Addon.characterKey,professions={}}
      if Addon.Medals then
        entry.title=Addon.Medals:GetTitle(key); entry.money=Addon.Medals:GetMoneyFor(key); entry.medals=Addon.Medals:GetSummary(key).count
      end
      local snapshots=database.professionSnapshots and database.professionSnapshots[key]
      if type(snapshots)=="table" then
        for _,snapshot in pairs(snapshots) do
          if type(snapshot)=="table" and snapshot.professionName then table.insert(entry.professions,{name=tostring(snapshot.professionName),level=tonumber(snapshot.skillLevel),max=tonumber(snapshot.maxSkillLevel)}) end
        end
        table.sort(entry.professions,function(a,b) return a.name<b.name end)
      end
      table.insert(list,entry)
    end
  end
  table.sort(list,function(a,b) if a.lastSeenAt~=b.lastSeenAt then return a.lastSeenAt>b.lastSeenAt end return a.name<b.name end)
  return list
end

function Statistics:DescribeCharacters(list)
  list=list or self:BuildCharacters()
  local lines={"Characters on this account ("..#list..")"}
  for _,entry in ipairs(list) do
    table.insert(lines,entry.name..(entry.realm and (" - "..tostring(entry.realm)) or "")..(entry.isCurrent and "  (this character)" or ""))
    local facts={}
    if entry.level then table.insert(facts,"Level "..entry.level..(entry.className and (" "..entry.className) or ""))
    elseif entry.className then table.insert(facts,entry.className) end
    if entry.title then table.insert(facts,entry.title) end
    if entry.medals then table.insert(facts,entry.medals.." medals") end
    if entry.money then table.insert(facts,entry.money.." Mom Money") end
    if #facts>0 then table.insert(lines,"  "..table.concat(facts,"  \194\183  ")) end
    if #entry.professions>0 then
      local parts={}
      for _,profession in ipairs(entry.professions) do table.insert(parts,profession.name.." "..tostring(profession.level or "?")..(profession.max and ("/"..profession.max) or "")) end
      table.insert(lines,"  "..table.concat(parts,", "))
    end
    if not entry.isCurrent and entry.lastSeenAt>0 then table.insert(lines,"  Last played "..ago(math.max(0,Addon:Now()-entry.lastSeenAt))) end
  end
  return table.concat(lines,"\n")
end
