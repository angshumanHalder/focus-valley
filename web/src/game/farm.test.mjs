import assert from 'node:assert/strict';
import test from 'node:test';
import { activeBed, bonusSeconds, completeFocus, createFarm, growthStage, openFarmDay, previewFocus } from './farm.ts';
import { inventoryStats } from './inventory.ts';
const at = Date.parse('2026-04-01T10:00:00Z');
const crop = cropId => ({ kind: 'crop', cropId });
function task(farm, minutes, target = crop('strawberry'), start = farm.sessions.at(-1)?.endMs + 60000 || at) {
  return { id: `task-${farm.sessions.length}`, label: `Task ${farm.sessions.length + 1}`, target, durationMs: minutes * 60000, intervals: [{ startMs: start, endMs: start + minutes * 60000 }] };
}

test('25 minutes carries 10 minutes forward; each task is attributed only to its selected crop', () => {
  const original = createFarm(at, 'UTC');
  let farm = completeFocus(original, task(original, 25));
  assert.equal(original.inventory['crop:strawberry'], undefined);
  assert.equal(farm.inventory['crop:strawberry'], 4);
  assert.deepEqual(activeBed(farm), {areaId:0,tileId:1});
  assert.equal(farm.farmDay.tiles[1].focusSeconds, 600);
  farm = completeFocus(farm, task(farm, 15, crop('peas')));
  assert.equal(farm.inventory['crop:strawberry'], 8);
  assert.equal(farm.farmDay.tiles[2].cropId, 'peas');
  assert.equal(farm.farmDay.tiles[2].focusSeconds, 600);
  assert.equal(inventoryStats(farm,'month','2026-04-01','crop:strawberry').minutes,25);
  assert.equal(inventoryStats(farm,'month','2026-04-01','crop:peas').minutes,15);
  assert.deepEqual(farm.sessions[1].target,crop('peas'));
  assert.deepEqual([0,299,300,600,900].map(focusSeconds => growthStage({focusSeconds})), [0,0,1,2,3]);
});

test('50-minute bonus harvests an area, unlocks next area and chicken; retry awards nothing twice', () => {
  const original = createFarm(at,'UTC'), focus = task(original,50);
  const farm = completeFocus(original,focus);
  assert.equal(bonusSeconds(2999),0); assert.equal(bonusSeconds(3000),600); assert.equal(bonusSeconds(6000),1200);
  assert.equal(farm.inventory['crop:strawberry'],16);
  assert.equal(farm.progress.unlockedAreaCount,2);
  assert.deepEqual(farm.progress.unlockedAnimals,['chicken']);
  assert.deepEqual(activeBed(farm),{areaId:1,tileId:0});
  assert.ok(farm.farmDay.tiles.every(t => t.harvested));
  assert.equal(farm.sessions[0].focusSeconds,3000);
  assert.equal(farm.sessions[0].bonusSeconds,600);
  assert.equal(completeFocus(farm,focus),farm);
  assert.throws(() => completeFocus(farm,{...focus,label:'Different'}));
  const stats=inventoryStats(farm,'week','2026-04-01');
  assert.equal(stats.minutes,50); assert.equal(stats.completions,1);
});

test('long custom tasks unlock all areas, wrap and replant without losing overflow', () => {
  const original=createFarm(at,'UTC');
  const farm=completeFocus(original,task(original,240));
  assert.equal(farm.progress.unlockedAreaCount,4);
  assert.equal(farm.progress.totalHarvests,18);
  assert.equal(farm.inventory['crop:strawberry'],72);
  assert.deepEqual(activeBed(farm),{areaId:0,tileId:2});
  assert.equal(farm.farmDay.tiles[2].focusSeconds,600);
  assert.equal(farm.farmDay.tiles[2].harvested,false);
  assert.equal(farm.farmDay.tiles.length,16);
  assert.deepEqual(farm.progress.unlockedAnimals,['chicken','rabbit']);
});

test('only selected pen progresses, repeats and collects automatically; partial production survives midnight', () => {
  let farm=createFarm(at,'UTC'); farm.progress.unlockedAnimals=['chicken','rabbit'];
  farm=completeFocus(farm,task(farm,50,{kind:'animal',animalId:'chicken'}));
  assert.equal(farm.inventory['animal:chicken'],16);
  assert.equal(farm.farmDay.tiles.length,0);
  assert.equal(farm.progress.totalHarvests,0);
  farm=completeFocus(farm,task(farm,25,{kind:'animal',animalId:'rabbit'}));
  assert.equal(farm.inventory['animal:rabbit'],4);
  assert.equal(farm.pens.rabbit.focusSeconds,600);
  const next=openFarmDay(farm,Date.parse('2026-04-02T00:00:00Z'));
  assert.equal(next.pens.rabbit.focusSeconds,600);
  assert.deepEqual(next.inventory,farm.inventory);
  assert.equal(next.farmDay.completedSessions,0);
  assert.equal(next.sessions.length,2);
});

test('midnight splits actual statistics, preserves crop overflow and counts one completion', () => {
  const start=Date.parse('2026-04-01T23:50:00Z'), original=createFarm(start,'UTC');
  const focus=task(original,25,crop('strawberry'),start);
  const farm=completeFocus(original,focus);
  assert.deepEqual(farm.sessions[0].focusSecondsByDate,{'2026-04-01':600,'2026-04-02':900});
  assert.equal(farm.farmDay.date,'2026-04-02');
  assert.equal(farm.inventory['crop:strawberry'],4);
  assert.equal(farm.farmDay.tiles[1].focusSeconds,600);
  assert.equal(farm.progress.totalActiveDays,1);
  const stats=inventoryStats(farm,'week','2026-04-01','crop:strawberry');
  assert.equal(stats.completions,1);
  assert.equal(stats.values[2].minutes,10);
  assert.equal(stats.values[3].minutes,15);
  assert.equal(openFarmDay(farm,Date.parse('2026-04-03T12:00:00Z')).farmDay.tiles[1].focusSeconds,600);
});

test('timezone/DST and paused intervals count only running time', () => {
  const start=Date.parse('2026-03-08T04:50:00Z');
  const farm=createFarm(start,'America/New_York');
  const focus=task(farm,50,crop('strawberry'),start);
  focus.intervals=[{startMs:start,endMs:start+600000},{startMs:Date.parse('2026-03-08T06:50:00Z'),endMs:Date.parse('2026-03-08T07:30:00Z')}];
  const result=completeFocus(farm,focus);
  assert.deepEqual(result.sessions[0].focusSecondsByDate,{'2026-03-07':600,'2026-03-08':2400});
  assert.equal(result.sessions[0].bonusSeconds,600);
});

test('season changes after seven active days; inactivity and overnight do not reset beds', () => {
  let farm=createFarm(at,'UTC');
  for(let day=0;day<7;day++) {
    farm=openFarmDay(farm,at+day*86400000);
    farm=completeFocus(farm,task(farm,25,crop('strawberry'),at+day*86400000));
  }
  const tiles=structuredClone(farm.farmDay.tiles);
  farm=openFarmDay(farm,at+10*86400000);
  assert.equal(farm.progress.season,'summer');
  assert.equal(farm.progress.totalActiveDays,7);
  assert.equal(farm.progress.activeDaysInSeason,0);
  assert.deepEqual(farm.farmDay.tiles,tiles);
  farm=completeFocus(farm,task(farm,15,crop('tomato'),at+10*86400000));
  assert.deepEqual(farm.sessions.at(-1).target,crop('tomato'));
});

test('live previews have no bonus, inventory or session commit and cancellation can discard them', () => {
  const farm=createFarm(at,'UTC'), before=structuredClone(farm);
  const preview=previewFocus(farm,crop('strawberry'),[{startMs:at,endMs:at+3000000}]);
  assert.equal(preview.progress.totalHarvests,3);
  assert.equal(preview.farmDay.tiles[3].focusSeconds,300);
  assert.deepEqual(preview.inventory,{}); assert.equal(preview.sessions.length,0);
  assert.deepEqual(farm,before); assert.equal(previewFocus(farm,null,[]),farm);
});

test('invalid or locked targets and invalid intervals are rejected without mutating state', () => {
  const farm=createFarm(at,'UTC'), before=structuredClone(farm);
  for(const target of [crop('tomato'),{kind:'animal',animalId:'chicken'},{kind:'animal',animalId:'nope'}]) assert.throws(()=>completeFocus(farm,task(farm,15,target)));
  assert.throws(()=>completeFocus(farm,task(farm,14)));
  assert.throws(()=>completeFocus(farm,{...task(farm,15),intervals:[{startMs:at,endMs:at}]}));
  assert.throws(()=>completeFocus(farm,{...task(farm,15),intervals:[{startMs:at,endMs:at+600000},{startMs:at,endMs:at+300000}]}));
  assert.deepEqual(farm,before);

});
