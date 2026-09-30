import test from 'node:test'; import assert from 'node:assert/strict';
import { readAddonFile } from './harness.js';
test('manifest declares the tester build and exact load order', () => {
  const toc=readAddonFile('MAMChronicles.toc');
  assert.match(toc,/## Interface: 120100, 120105, 16001/); assert.match(toc,/## SavedVariables: MAMChroniclesDB/);
  assert.match(toc,/## Version: 0\.2\.0-alpha1/);
  const files=toc.split(/\r?\n/).filter(x=>x.endsWith('.lua'));
  assert.deepEqual(files,['Core.lua','Database.lua','EventStore.lua','Collectors.lua','Statistics.lua','Export.lua','UI.lua']);
});
