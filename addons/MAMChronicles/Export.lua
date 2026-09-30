local Addon=MAMChronicles
Addon.Export=Addon.Export or {}
local Export=Addon.Export

local safeFields={
  duration=true,level=true,zone=true,subzone=true,mapID=true,x=true,y=true,instanceName=true,instanceType=true,difficultyID=true,lastHostileTarget=true,deathKind=true,
  questID=true,questName=true,itemID=true,itemName=true,itemLink=true,quality=true,quantity=true,professionID=true,professionName=true,skillLevel=true,maxSkillLevel=true,skillLineID=true,
  achievementID=true,achievementName=true,points=true,text=true,
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

function Export:BuildHumanSummary(fromTime,toTime)
  local stats=Addon.Statistics:Build(fromTime,toTime)
  local lines={"Moms Against Magic Chronicles","Reporting window: "..tostring(stats.fromTime).." to "..tostring(stats.toTime),"Events recorded: "..tostring(stats.eventCount),"Sessions: "..tostring(stats.sessionCount),"Deaths: "..tostring(stats.totals.deaths),"Quests completed: "..tostring(stats.totals.questsCompleted),"Discoveries: "..tostring(stats.totals.discoveries),"Notable loot: "..tostring(stats.totals.notableLoot)}
  if #stats.awards>0 then table.insert(lines,"Awards:"); for _,award in ipairs(stats.awards) do table.insert(lines,"- "..award.name..": "..tostring(award.count)) end end
  table.insert(lines,"Coverage: "..tostring(stats.coverage.sourceEventCount).." source events in this local journal.")
  return table.concat(lines,"\n")
end

function Export:BuildDiagnosticReport()
  local _,build,_,interface=Addon:SafeCall(GetBuildInfo); local status=Addon.Collectors and Addon.Collectors:GetCollectorStatus() or nil
  local registered,errors=0,0
  if status then for _ in pairs(status.registered or {}) do registered=registered+1 end errors=#(status.errors or {}) end
  local lines={"Moms Against Magic Chronicles Diagnostics","Addon version: "..Addon.version,"Client build: "..tostring(build or "unknown"),"Interface: "..tostring(interface or "unknown"),"Schema: "..tostring(Addon.db.schemaVersion),"Events: "..tostring(#Addon.db.events),"Sessions: "..tostring(#Addon.db.sessions),"Collectors registered: "..tostring(registered),"Collector errors: "..tostring(errors)}
  if Addon.db.diagnostics.recovery then table.insert(lines,"Recovery: "..tostring(Addon.db.diagnostics.recovery.reason)) end
  return table.concat(lines,"\n")
end
