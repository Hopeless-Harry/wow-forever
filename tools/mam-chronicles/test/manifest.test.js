import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { addonPath, readAddonFile } from './harness.js';
test('manifest declares the tester build and exact load order', () => {
  const toc=readAddonFile('MAMChronicles.toc');
  assert.match(toc,/## Interface: 120100, 120105, 16001/); assert.match(toc,/## SavedVariables: MAMChroniclesDB/);
  assert.match(toc,/## Version: 0.2.0-alpha21/);
  const files=toc.split(/\r?\n/).filter(x=>x.endsWith('.lua'));
  assert.deepEqual(files,['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','AchievementStats.lua','Medals.lua','Counters.lua','Export.lua','Theme.lua','Toast.lua','Comms.lua','Map.lua','Tracker.lua','Dashboard.lua','UI.lua','Launcher.lua','SettingsPanel.lua']);
});
test('manifest declares icon and Addon Compartment metadata',()=>{
  const toc=readAddonFile('MAMChronicles.toc');
  assert.match(toc,/## IconTexture: Interface\\AddOns\\MAMChronicles\\MAMChroniclesIcon/);
  for(const key of ['AddonCompartmentFunc: MAMChronicles_AddonCompartmentClick','AddonCompartmentFuncOnEnter: MAMChronicles_AddonCompartmentEnter','AddonCompartmentFuncOnLeave: MAMChronicles_AddonCompartmentLeave'])assert.match(toc,new RegExp('## '+key));
  assert.doesNotMatch(toc,/## X-Website/);
  assert.match(readAddonFile('Core.lua'),/Addon\.version = "0.2.0-alpha21"/);
});
test('icon is a square power-of-two uncompressed 32-bit TGA',()=>{
  const data=readFileSync(addonPath('MAMChroniclesIcon.tga'));
  assert.equal(data[2],2);assert.equal(data[16],32);
  const width=data.readUInt16LE(12),height=data.readUInt16LE(14);
  assert.equal(width,height);assert.equal(width>=32&&(width&(width-1))===0,true);
  assert.equal(data.length,18+width*height*4+(data.length-18-width*height*4));
  assert.equal(data.length>=18+width*height*4,true);
  let opaque=0;for(let i=18+3;i<18+width*height*4;i+=4)if(data[i]>0)opaque++;
  assert.equal(opaque>width*height*0.3,true);
});
test('licence file is present and names the owner and scope',()=>{
  const text=readAddonFile('LICENSE.txt');
  assert.equal(statSync(addonPath('LICENSE.txt')).size>200,true);
  assert.match(text,/Moms Against Magic/);assert.match(text,/private/i);
});
