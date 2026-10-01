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


-- Levelling pace. Time per level is time actually played (summed from login sessions), not wall-clock time, so days away
-- from the game do not count. Only levels reached while the addon was installed have a measured time.
local function playedUntil(sessions,characterKey,limit)
  local total,now=0,Addon:Now()
  for _,session in ipairs(sessions or {}) do
    if session.characterKey==characterKey and tonumber(session.startedAt) then
      local finish=tonumber(session.endedAt) or now
      local stop=math.min(finish,limit)
      if stop>session.startedAt then total=total+(stop-session.startedAt) end
    end
  end
  return total
end

function Statistics:BuildLevelPace(characterKey)
  characterKey=characterKey or Addon.characterKey
  local db=Addon.db; if not db then return nil end
  local ups={}
  for _,event in ipairs(db.events or {}) do
    if event.type=="character.level_up" and event.characterKey==characterKey and tonumber(event.payload and event.payload.level) then ups[#ups+1]={level=event.payload.level,at=event.occurredAt} end
  end
  table.sort(ups,function(a,b) return a.at<b.at end)
  local levels={}
  for index=2,#ups do
    local seconds=playedUntil(db.sessions,characterKey,ups[index].at)-playedUntil(db.sessions,characterKey,ups[index-1].at)
    if seconds>0 then levels[#levels+1]={level=ups[index].level,seconds=seconds} end
  end
  if #levels==0 then return nil end
  local recent,sum={},0
  for index=math.max(1,#levels-4),#levels do recent[#recent+1]=levels[index]; sum=sum+levels[index].seconds end
  local average=sum/#recent
  local current=tonumber(db.characters and db.characters[characterKey] and db.characters[characterKey].level) or levels[#levels].level
  local cap=Addon.Medals and Addon.Medals:LevelCap() or 60
  local remaining=math.max(0,cap-current)
  return {levels=levels,recent=recent,average=average,current=current,cap=cap,remaining=remaining,eta=remaining*average,last=levels[#levels]}
end

function Statistics:DescribeLevelPace(characterKey)
  local pace=self:BuildLevelPace(characterKey)
  if not pace then return nil end
  local lines={"Levelling pace"}
  for _,entry in ipairs(pace.recent) do table.insert(lines,"  Level "..entry.level.." took "..self:FormatDuration(entry.seconds).." of play") end
  table.insert(lines,"  Average of the last "..#pace.recent..": "..self:FormatDuration(pace.average).." per level")
  if pace.remaining>0 then table.insert(lines,"  About "..self:FormatDuration(pace.eta).." more play to reach level "..pace.cap.." at this pace ("..pace.remaining.." levels)")
  else table.insert(lines,"  You are at the level cap.") end
  return table.concat(lines,"\n")
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

-- Guild tab: a leaderboard from the totals guildmates shared (most Mom Money first) with you in it, then recent guild medals.
function Statistics:BuildGuild()
  local rows = {}
  local Comms, Medals = Addon.Comms, Addon.Medals
  for _,entry in ipairs(Comms and Comms:GetRoster() or {}) do rows[#rows+1]={name=entry.name,count=entry.count,points=entry.points,at=entry.at} end
  if Medals and Addon.db and Addon.db.medals and Addon.db.medals[Addon.characterKey] then
    local summary=Addon:SafeCall(Medals.GetSummary,Medals)
    if type(summary)=="table" then rows[#rows+1]={name=(Addon.character and Addon.character.name) or "You",count=summary.count,points=tonumber(Addon:SafeCall(Medals.GetMomMoney,Medals)) or 0,me=true} end
  end
  table.sort(rows,function(a,b) if a.points~=b.points then return a.points>b.points end return a.name<b.name end)
  return rows
end

function Statistics:DescribeGuild()
  if type(IsInGuild)=="function" and IsInGuild()~=true then
    return "Guild leaderboard\n  You are not in a guild. Join one to see a leaderboard of guildmates who use the addon and the medals they earn.\n\nYour own totals are on the Medals tab."
  end
  local rows=self:BuildGuild()
  local lines={"Guild leaderboard ("..#rows.." shown)"}
  if #rows<=1 then table.insert(lines,"  No guildmate totals yet. They arrive when guildmates log in with the addon and Announce my Mom Medals switched on.") end
  for index,row in ipairs(rows) do
    local line=string.format("  %d. %s%s  -  %d medals  \194\183  %d Mom Money",index,row.name,row.me and "  (you)" or "",row.count,row.points)
    if not row.me and row.at and row.at>0 then line=line.."  \194\183  "..ago(math.max(0,Addon:Now()-row.at)) end
    table.insert(lines,line)
  end
  local feed=Addon.db and Addon.db.guildFeed or {}
  table.insert(lines,"")
  table.insert(lines,"Recent guild medals")
  if #feed==0 then table.insert(lines,"  Nothing yet. Medals earned by guildmates while you are online appear here.") end
  for index=1,math.min(10,#feed) do
    local entry=feed[index]
    table.insert(lines,"  "..tostring(entry.sender):match("^[^-]+").." earned "..tostring(entry.name or entry.id).." (+"..tostring(entry.points or 0)..")  \194\183  "..ago(math.max(0,Addon:Now()-(tonumber(entry.at) or 0))))
  end
  table.insert(lines,"")
  table.insert(lines,"Tip: /mam guild send shares your own totals right now.")
  return table.concat(lines,"\n")
end

-- Memory Book: a scrapbook of firsts, milestones, pinned memories and close calls, built from this character's events.
local firstLabels = { { "quest", "First quest" }, { "death", "First death" }, { "dungeon", "First dungeon" }, { "loot", "First notable loot" }, { "medal", "First medal" } }

function Statistics:BuildMemoryBook(characterKey)
  characterKey=characterKey or Addon.characterKey
  local book={firsts={},levels={},memories={},deaths={},medals={},memoryCount=0}
  local events=Addon.EventStore:Query({characterKey=characterKey})
  local levelSeen={}
  for index=#events,1,-1 do
    local event=events[index]
    local kind,payload,at=event.type,event.payload or {},event.occurredAt
    local function first(key,text) if text and not book.firsts[key] then book.firsts[key]={text=tostring(text),at=at} end end
    if kind=="quest.completed" then first("quest",payload.questName or ("quest "..tostring(payload.questID)))
    elseif kind=="character.death" then first("death",payload.zone or "somewhere")
    elseif kind=="instance.entered" then first("dungeon",payload.instanceName)
    elseif kind=="loot.notable" then first("loot",payload.itemName)
    elseif kind=="medal.earned" then first("medal",payload.medalName or payload.medalId)
    elseif kind=="character.level_up" then
      local level=tonumber(payload.level)
      if level and level%10==0 and not levelSeen[level] then levelSeen[level]=true; table.insert(book.levels,{level=level,at=at}) end
    end
  end
  table.sort(book.levels,function(a,b) return a.level<b.level end)
  for _,event in ipairs(events) do
    local payload=event.payload or {}
    if event.type=="memory.manual" then
      book.memoryCount=book.memoryCount+1
      if #book.memories<30 then table.insert(book.memories,{text=tostring(payload.text or ""),zone=payload.zone,at=event.occurredAt}) end
    elseif event.type=="character.death" and #book.deaths<8 then
      table.insert(book.deaths,{zone=payload.zone or "somewhere",fell=string.find(string.lower(tostring(payload.deathKind or "")),"fall",1,true)~=nil,at=event.occurredAt})
    end
  end
  local row=Addon.db and Addon.db.medals and Addon.db.medals[characterKey]
  if row and Addon.Medals then
    for id,earned in pairs(row.earned or {}) do
      local def=Addon.Medals:GetDefinition(id)
      if def then table.insert(book.medals,{name=def.name,points=tonumber(earned.points) or def.points,at=tonumber(earned.at) or 0}) end
    end
    table.sort(book.medals,function(a,b) if a.points~=b.points then return a.points>b.points end if a.at~=b.at then return a.at<b.at end return a.name<b.name end)
    while #book.medals>5 do table.remove(book.medals) end
  end
  return book
end

function Statistics:DescribeMemoryBook(book)
  book=book or self:BuildMemoryBook()
  local lines={"Memory Book"}
  local empty=true
  local firstLines={}
  for _,entry in ipairs(firstLabels) do
    local first=book.firsts[entry[1]]
    if first then table.insert(firstLines,"  "..entry[2]..": "..first.text.." ("..dayLabel(first.at)..")") end
  end
  if #firstLines>0 then empty=false; table.insert(lines,"Firsts"); for _,line in ipairs(firstLines) do table.insert(lines,line) end end
  if #book.levels>0 or #book.medals>0 then
    empty=false; table.insert(lines,"Milestones")
    for _,entry in ipairs(book.levels) do table.insert(lines,"  Reached level "..entry.level.." ("..dayLabel(entry.at)..")") end
    if #book.medals>0 then
      table.insert(lines,"Best medals")
      for _,entry in ipairs(book.medals) do table.insert(lines,"  "..entry.name.." (+"..entry.points..")") end
    end
  end
  if #book.memories>0 then
    empty=false; table.insert(lines,"Memories ("..book.memoryCount..")")
    for _,entry in ipairs(book.memories) do table.insert(lines,"  "..dayLabel(entry.at).."  "..entry.text..(entry.zone and (" - "..entry.zone) or "")) end
  end
  if #book.deaths>0 then
    empty=false; table.insert(lines,"Close calls")
    for _,entry in ipairs(book.deaths) do table.insert(lines,"  "..dayLabel(entry.at).."  "..entry.zone..(entry.fell and " (fell)" or "")) end
  end
  if empty then table.insert(lines,"Nothing in the book yet. Play for a while, or pin a memory with /mam remember.") end
  return table.concat(lines,"\n")
end
