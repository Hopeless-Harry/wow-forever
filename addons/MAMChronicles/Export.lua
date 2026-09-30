local Addon=MAMChronicles
Addon.Export=Addon.Export or {}
local Export=Addon.Export

local safeFields={
  duration=true,level=true,zone=true,subzone=true,mapID=true,x=true,y=true,instanceName=true,instanceType=true,difficultyID=true,lastHostileTarget=true,deathKind=true,
  questID=true,questName=true,itemID=true,itemName=true,itemLink=true,quality=true,quantity=true,professionID=true,professionName=true,skillLevel=true,maxSkillLevel=true,skillLineID=true,
  achievementID=true,achievementName=true,points=true,text=true,medalId=true,medalName=true,
}
local function escape(value)
  return tostring(value):gsub("\\","\\\\"):gsub("\r","\\r"):gsub("\n","\\n"):gsub("\t","\\t")
end
local function sortedPayload(payload)
  local keys={}; for key,value in pairs(payload or {}) do
    if safeFields[key] and (Addon.db.settings.recordCoordinates or (key~="x" and key~="y")) and (type(value)=="string" or type(value)=="number" or type(value)=="boolean") then table.insert(keys,key) end
  end
  table.sort(keys); local fields={}; for _,key in ipairs(keys) do table.insert(fields,escape(key).."="..escape(payload[key])) end return table.concat(fields,"\t")
end

function Export:BuildCourierPayload(fromTime,toTime)
  local events=Addon.EventStore:Query({fromTime=fromTime,toTime=toTime}); local lines={"MAMCHRONICLES/1"}
  table.sort(events,function(a,b) if a.occurredAt==b.occurredAt then return a.id<b.id end return a.occurredAt<b.occurredAt end)
  for _,event in ipairs(events) do
    local line=table.concat({"EVENT",escape(event.id),escape(event.type),tostring(event.occurredAt),escape(event.characterKey),sortedPayload(event.payload)},"\t")
    table.insert(lines,line)
  end
  table.insert(lines,"COUNT\t"..tostring(#events)); local output=table.concat(lines,"\n")
  if #output>2097152 then return nil,"Export exceeds 2 MiB; narrow the date range." end
  return output
end

function Export.FormatDate(timestamp)
  local dateFn=date or (os and os.date)
  return dateFn and dateFn("%d %b %Y",timestamp) or tostring(timestamp)
end

function Export:BuildHumanSummary(fromTime,toTime)
  local stats=Addon.Statistics:Build(fromTime,toTime)
  local lines={"Moms Against Magic Chronicles","Reporting window: "..Export.FormatDate(stats.fromTime).." to "..Export.FormatDate(stats.toTime),"Events recorded: "..tostring(stats.eventCount),"Sessions: "..tostring(stats.sessionCount),"Deaths: "..tostring(stats.totals.deaths),"Quests completed: "..tostring(stats.totals.questsCompleted),"Discoveries: "..tostring(stats.totals.discoveries),"Notable loot: "..tostring(stats.totals.notableLoot)}
  if #stats.awards>0 then table.insert(lines,"Awards:"); for _,award in ipairs(stats.awards) do table.insert(lines,"- "..award.name..": "..tostring(award.count)) end end
  table.insert(lines,"Coverage: "..tostring(stats.coverage.sourceEventCount).." source events in this local journal.")
  if stats.coverage.compactedRangeIncomplete then table.insert(lines,"Coverage warning: compacted history overlaps only part of this range; shown totals are a known minimum.") end
  return table.concat(lines,"\n")
end

function Export:CountEarnedMedals()
  local summary=Addon.Medals and Addon.Medals.GetSummary and Addon:SafeCall(Addon.Medals.GetSummary,Addon.Medals)
  return summary and summary.count or 0
end

-- A short, shareable summary of the month. It never includes the character name, realm or gold.
function Export:BuildRecap(fromTime,toTime,options)
  options=options or {}
  local stats=Addon.Statistics:Build(fromTime,toTime)
  local dateFn=date or (os and os.date)
  local title=options.title or (dateFn and dateFn("%B %Y",fromTime) or "This month")
  local lines={"Moms Against Magic Chronicles - "..title.." recap"}
  if Addon.Medals then table.insert(lines,"Title: "..Addon.Medals:GetTitle()) end
  local medals=Addon.EventStore:Query({type="medal.earned",fromTime=fromTime,toTime=toTime})
  table.sort(medals,function(a,b) if a.occurredAt==b.occurredAt then return a.id<b.id end return a.occurredAt<b.occurredAt end)
  local changes={}
  if Addon.AchievementStats and options.statChanges~=false then
    for _,change in ipairs(Addon.AchievementStats:GetTopChanges(Addon.characterKey,50)) do
      if change.group~=Addon.AchievementStats.goldGroup and #changes<3 then table.insert(changes,change.name.." +"..tostring(change.delta)) end
    end
  end
  if stats.eventCount==0 and #medals==0 and #changes==0 then table.insert(lines,options.quiet or "Quiet month: nothing recorded yet."); return table.concat(lines,"\n") end
  table.insert(lines,tostring(stats.sessionCount).." sessions, "..tostring(stats.eventCount).." events")
  table.insert(lines,"Deaths "..tostring(stats.totals.deaths).."  Quests "..tostring(stats.totals.questsCompleted).."  Discoveries "..tostring(stats.totals.discoveries).."  Notable loot "..tostring(stats.totals.notableLoot))
  if #medals>0 then
    local points,names=0,{}
    for index,event in ipairs(medals) do points=points+(tonumber(event.payload.points) or 0); if index<=5 then table.insert(names,tostring(event.payload.medalName or event.payload.medalId)) end end
    local text="Medals earned: "..#medals.." (+"..points.." Mom Money): "..table.concat(names,", ")
    if #medals>5 then text=text..", and "..(#medals-5).." more" end
    table.insert(lines,text)
  end
  if #changes>0 then table.insert(lines,"Top changes: "..table.concat(changes,", ")) end
  local summary=Addon.Medals and Addon.Medals:GetSummary()
  if summary then table.insert(lines,"Mom Money total: "..tostring(summary.total).." ("..tostring(summary.count).." of "..tostring(summary.possible).." medals)") end
  return table.concat(lines,"\n")
end

function Export:BuildMonthlyRecap(fromTime,toTime) return self:BuildRecap(fromTime,toTime) end

-- Last seven days. Statistic changes are only tracked per month, so the weekly recap leaves them out.
function Export:BuildWeeklyRecap()
  local now=Addon:Now(); local from=now-7*86400
  local dateFn=date or (os and os.date)
  return self:BuildRecap(from,now,{title="Week of "..(dateFn and dateFn("%d %b",from) or tostring(from)),quiet="Quiet week: nothing recorded yet.",statChanges=false})
end

function Export:BuildDiagnosticReport()
  local _,build,_,interface=Addon:SafeCall(GetBuildInfo); local status=Addon.Collectors and Addon.Collectors:GetCollectorStatus() or nil
  local registered,errors=0,0; local unavailable={}
  if status then for _ in pairs(status.registered or {}) do registered=registered+1 end errors=#(status.errors or {}) end
  if status then for eventName in pairs(status.unavailable or {}) do table.insert(unavailable,eventName) end; table.sort(unavailable) end
  local lines={"Moms Against Magic Chronicles Diagnostics","Addon version: "..Addon.version,"Client build: "..tostring(build or "unknown"),"Interface: "..tostring(interface or "unknown"),"Schema: "..tostring(Addon.db.schemaVersion),"Events: "..tostring(#Addon.db.events),"Sessions: "..tostring(#Addon.db.sessions),"Collectors registered: "..tostring(registered),"Collector errors: "..tostring(errors)}
  local es=Addon.errorStats or {count=0}
  table.insert(lines,"Handler errors: "..tostring(es.count)..(es.last and ", last: "..es.last or ""))
  table.insert(lines,"SavedVariables: events "..tostring(#Addon.db.events)..", medals "..tostring(Export:CountEarnedMedals())..", feed "..tostring(#(Addon.db.guildFeed or {})))
  table.insert(lines,"Unavailable collectors: "..(#unavailable>0 and table.concat(unavailable,", ") or "none"))
  if status and errors>0 then for index=math.max(1,errors-2),errors do local item=status.errors[index]; table.insert(lines,"Recent collector error: "..tostring(item.event or "unknown").." ("..tostring(item.message or "handler failed")..")") end end
  if Addon.AchievementStats then local st=Addon.AchievementStats.status; table.insert(lines,"Statistics: "..(st and (st.state..(st.state=="ok" and ", "..tostring(st.statCount or 0).." read, "..tostring(st.unparsed or 0).." unreadable"..(st.scanMs and ", scan "..st.scanMs.." ms" or "") or (st.reason and " ("..st.reason..")" or ""))) or "not scanned yet")) end
  if Addon.Comms then local cs=Addon.Comms.status; table.insert(lines,"Guild sharing: "..tostring(cs.state)..", sent "..tostring(cs.sent)..", received "..tostring(cs.received)..", dropped "..tostring(cs.dropped)..", unknown "..tostring(cs.unknown or 0)..", other version "..tostring(cs.otherVersion or 0)) end
  if Addon.Medals then
    local raceToken = select(2, Addon:SafeCall(UnitRace, "player"))
    local hooks = Addon.Counters and Addon.Counters.hooked and table.concat(Addon.Counters.hooked, ", ") or "none"
    table.insert(lines,"Level cap: "..tostring(Addon.Medals:LevelCap()))
    table.insert(lines,"Medals: client "..tostring(Addon.Medals:Client())..", level cap "..tostring(Addon.Medals:LevelCap())..", race "..tostring(raceToken or "unknown")..", hooks "..hooks)
    local js=Addon.Counters and Addon.Counters.jumpSources
    if js then table.insert(lines,"Jumps counted: "..tostring(js.hook).." by the hook, "..tostring(js.ticker).." by the ground check") end
    local camp=Addon.Counters and Addon.Counters.campSpellNames or {}
    if #camp>0 then table.insert(lines,"Camp spells seen: "..table.concat(camp,", ")) end
  end
  local st2=Addon.AchievementStats and Addon.AchievementStats.status
  if st2 and st2.unparsedSamples then for index=1,math.min(5,#st2.unparsedSamples) do local sample=st2.unparsedSamples[index]; table.insert(lines,"Unreadable sample: "..sample.name.." = "..sample.raw) end end
  if st2 and st2.otherRoots then local names={}; for title,n in pairs(st2.otherRoots) do table.insert(names,{title=title,n=n}) end; table.sort(names,function(a,b) if a.n~=b.n then return a.n>b.n end return a.title<b.title end); local parts={}; for index=1,math.min(6,#names) do parts[index]=names[index].title.." ("..names[index].n..")" end; if #parts>0 then table.insert(lines,"Uncategorised: "..table.concat(parts,", ")) end end
  if Addon.db.diagnostics.recovery then table.insert(lines,"Recovery: "..tostring(Addon.db.diagnostics.recovery.reason)) end
  return table.concat(lines,"\n")
end
