import assert from 'node:assert/strict';
import test from 'node:test';
import { activeBed, bonusSeconds, clearPenProduce, penProduceCount, spendBonus, completeFocus, createFarm, growthStage, openFarmDay, previewFocus } from './farm.ts';
import { inventoryStats } from './inventory.ts';
const at = Date.parse('2026-04-01T10:00:00Z');
const crop = cropId => ({ kind: 'crop', cropId });
function task(farm, minutes, target = crop('strawberry'), start = farm.sessions.at(-1)?.endMs + 60000 || at) {
  return { id: `task-${farm.sessions.length}`, label: `Task ${farm.sessions.length + 1}`, target, durationMs: minutes * 60000, intervals: [{ startMs: start, endMs: start + minutes * 60000 }] };
}

test('crop timers discard unused growth; selected focus time remains attributed to its crop', () => {
  const original = createFarm(at, 'UTC');
  let farm = completeFocus(original, task(original, 25));
  assert.equal(original.inventory['crop:strawberry'], undefined);
  assert.equal(farm.inventory['crop:strawberry'], 4);
  assert.deepEqual(activeBed(farm), {areaId:0,tileId:1});
  assert.equal('cropCreditSeconds' in farm,false);
  assert.equal(farm.farmDay.tiles.some(t => !t.harvested),false);
  farm = completeFocus(farm, task(farm, 15, crop('peas')));
  assert.equal(farm.inventory['crop:strawberry'], 4);
  assert.equal(farm.inventory['crop:peas'], 4);
  assert.equal('cropCreditSeconds' in farm,false);
  assert.equal(inventoryStats(farm,'month','2026-04-01','crop:strawberry').minutes,25);
  assert.equal(inventoryStats(farm,'month','2026-04-01','crop:peas').minutes,15);
  assert.deepEqual(farm.sessions[1].target,crop('peas'));
  assert.deepEqual([0,299,300,600,900].map(focusSeconds => growthStage({focusSeconds})), [0,0,1,2,3]);
});

test('50-minute crop task harvests one bed, discards excess growth and earns two bonus minutes', () => {
  const original = createFarm(at,'UTC'), focus = task(original,50);
  const farm = completeFocus(original,focus);
  assert.equal(bonusSeconds(1499),0); assert.equal(bonusSeconds(1500),60); assert.equal(bonusSeconds(3000),120);
  assert.equal(farm.inventory['crop:strawberry'],4);
  assert.equal(farm.progress.unlockedAreaCount,1);
  assert.deepEqual(farm.progress.unlockedAnimals,[]);
  assert.deepEqual(activeBed(farm),{areaId:0,tileId:1});
  assert.equal('cropCreditSeconds' in farm,false);
  assert.equal(farm.bonusBankSeconds,120);
  assert.ok(farm.farmDay.tiles.every(t => t.harvested));
  assert.equal(farm.sessions[0].focusSeconds,3000);
  assert.equal(farm.sessions[0].bonusSeconds,120);
  assert.equal(completeFocus(farm,focus),farm);
  assert.throws(() => completeFocus(farm,{...focus,label:'Different'}));
  const stats=inventoryStats(farm,'week','2026-04-01');
  assert.equal(stats.minutes,50); assert.equal(stats.completions,1);
});

test('long custom crop tasks grow one bed and discard excess growth', () => {
  const original=createFarm(at,'UTC');
  const farm=completeFocus(original,task(original,240));
  assert.equal(farm.progress.unlockedAreaCount,1);
  assert.equal(farm.progress.totalHarvests,1);
  assert.equal(farm.inventory['crop:strawberry'],4);
  assert.deepEqual(activeBed(farm),{areaId:0,tileId:1});
  assert.equal('cropCreditSeconds' in farm,false);
  assert.equal(farm.bonusBankSeconds,540);
  assert.equal(farm.farmDay.tiles.length,1);
  assert.deepEqual(farm.progress.unlockedAnimals,[]);
});

test('only selected pen progresses; timer leftovers are discarded overnight', () => {
  let farm=createFarm(at,'UTC'); farm.progress.unlockedAnimals=['chicken','rabbit'];
  farm=completeFocus(farm,task(farm,50,{kind:'animal',animalId:'chicken'}));
  assert.equal(farm.inventory['animal:chicken'],12);
  assert.equal(farm.farmDay.tiles.length,0);
  assert.equal(farm.progress.totalHarvests,3);
  assert.equal(farm.bonusBankSeconds,120);
  farm=completeFocus(farm,task(farm,25,{kind:'animal',animalId:'rabbit'}));
  assert.equal(farm.inventory['animal:rabbit'],4);
  assert.equal(farm.pens.rabbit.focusSeconds,0);
  const next=openFarmDay(farm,Date.parse('2026-04-02T00:00:00Z'));
  assert.equal(next.pens.rabbit.focusSeconds,0);
  assert.deepEqual(next.inventory,farm.inventory);
  assert.equal(next.farmDay.completedSessions,0);
  assert.equal(next.sessions.length,2);
});

test('midnight splits actual statistics, discards growth leftovers and counts one completion', () => {
  const start=Date.parse('2026-04-01T23:50:00Z'), original=createFarm(start,'UTC');
  const focus=task(original,25,crop('strawberry'),start);
  const farm=completeFocus(original,focus);
  assert.deepEqual(farm.sessions[0].focusSecondsByDate,{'2026-04-01':600,'2026-04-02':900});
  assert.equal(farm.farmDay.date,'2026-04-02');
  assert.equal(farm.inventory['crop:strawberry'],4);
  assert.equal('cropCreditSeconds' in farm,false);
  assert.equal(farm.progress.totalActiveDays,1);
  const stats=inventoryStats(farm,'week','2026-04-01','crop:strawberry');
  assert.equal(stats.completions,1);
  assert.equal(stats.values[2].minutes,10);
  assert.equal(stats.values[3].minutes,15);
  assert.equal(openFarmDay(farm,Date.parse('2026-04-03T12:00:00Z')).bonusBankSeconds,60);
});

test('timezone/DST and paused intervals count only running time', () => {
  const start=Date.parse('2026-03-08T04:50:00Z');
  const farm=createFarm(start,'America/New_York');
  const focus=task(farm,50,crop('strawberry'),start);
  focus.intervals=[{startMs:start,endMs:start+600000},{startMs:Date.parse('2026-03-08T06:50:00Z'),endMs:Date.parse('2026-03-08T07:30:00Z')}];
  const result=completeFocus(farm,focus);
  assert.deepEqual(result.sessions[0].focusSecondsByDate,{'2026-03-07':600,'2026-03-08':2400});
  assert.equal(result.sessions[0].bonusSeconds,120);
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
  assert.equal(preview.progress.totalHarvests,1);
  assert.equal(preview.farmDay.tiles.length,1);
  assert.deepEqual(activeBed(preview),{areaId:0,tileId:1});
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


test('crop and pen cycles share unlock progress without advancing or planting crop beds', () => {
  let farm = createFarm(at, 'UTC');
  for (let i = 0; i < 4; i++) farm = completeFocus(farm, task(farm, 15));
  const bed = activeBed(farm), tiles = structuredClone(farm.farmDay.tiles);
  const chicken = {kind:'animal', animalId:'chicken'};
  const before = structuredClone(farm);
  const preview = previewFocus(farm, chicken, [{startMs:at, endMs:at+3600000}]);
  assert.equal(preview.progress.unlockedAreaCount,3);
  assert.ok(preview.progress.unlockedAnimals.includes('rabbit'));
  assert.deepEqual(farm,before);
  assert.deepEqual(preview.inventory,before.inventory);
  const focus = task(farm,60,chicken);
  farm = completeFocus(farm,focus);
  assert.equal(farm.progress.totalHarvests,8);
  assert.equal(farm.progress.seasonHarvests,8);
  assert.equal(farm.progress.unlockedAreaCount,3);
  assert.deepEqual(farm.progress.unlockedAnimals,['chicken','rabbit']);
  assert.deepEqual(activeBed(farm),bed);
  assert.deepEqual(farm.farmDay.tiles,tiles);
  assert.equal(completeFocus(farm,focus),farm);
  farm = completeFocus(farm,task(farm,60,{kind:'animal',animalId:'rabbit'}));
  assert.equal(farm.progress.unlockedAreaCount,4);
  farm = completeFocus(farm,task(farm,240,chicken));
  assert.equal(farm.progress.unlockedAreaCount,4);
});

test('pen display clears on a new task, keeps inventory, and returns only on completion', () => {
  let farm=createFarm(at,'UTC');
  farm.progress.unlockedAnimals=['chicken','rabbit'];
  const chicken={kind:'animal',animalId:'chicken'};
  farm=completeFocus(farm,task(farm,25,chicken));
  assert.equal(penProduceCount(farm,'chicken'),4);
  farm=completeFocus(farm,task(farm,15,{kind:'animal',animalId:'rabbit'}));
  const original=structuredClone(farm);
  farm=clearPenProduce(farm,'chicken');
  assert.equal(penProduceCount(farm,'chicken'),0);
  assert.equal(penProduceCount(farm,'rabbit'),4);
  assert.deepEqual(farm.inventory,original.inventory);
  assert.equal(farm.pens.chicken.focusSeconds,0);
  const preview=previewFocus(farm,chicken,[{startMs:at,endMs:at+900000}]);
  assert.equal(penProduceCount(preview,'chicken'),0);
  assert.equal(penProduceCount(farm,'chicken'),0);
  assert.equal(farm.inventory['animal:chicken'],4);
  farm=completeFocus(farm,task(farm,15,chicken));
  assert.equal(penProduceCount(farm,'chicken'),4);
  assert.equal(farm.inventory['animal:chicken'],8);
  assert.equal(farm.pens.chicken.focusSeconds,0);
  assert.equal(penProduceCount(original,'chicken'),4);
  delete original.pens.chicken.visibleProduce;
  assert.equal(penProduceCount(original,'chicken'),4);
});


test('no focus growth crosses tasks or seasons; bonus thresholds do', () => {
  let farm=createFarm(at,'UTC');
  farm=completeFocus(farm,task(farm,15,crop('strawberry')));
  assert.equal(farm.bonusBankSeconds,0);
  assert.equal(farm.bonusRemainderSeconds,900);
  const before=structuredClone(farm);
  assert.equal(previewFocus(farm,crop('peas'),[]),farm);
  const preview=previewFocus(farm,crop('peas'),[{startMs:at,endMs:at}]);
  assert.equal(preview.farmDay.tiles[1].focusSeconds,0);
  assert.deepEqual(farm,before);
  farm.progress.unlockedAnimals=['chicken'];
  farm=completeFocus(farm,task(farm,15,{kind:'animal',animalId:'chicken'}));
  assert.equal(farm.bonusBankSeconds,60);
  assert.equal(farm.bonusRemainderSeconds,300);
  farm.progress.activeDaysInSeason=7;
  farm=openFarmDay(farm,at+86400000);
  assert.equal(farm.progress.season,'summer');
  assert.equal(farm.bonusBankSeconds,60);
  farm=completeFocus(farm,task(farm,20,crop('tomato'),at+86400000));
  assert.equal(farm.inventory['crop:tomato'],4);
  assert.equal(farm.bonusBankSeconds,120);
  assert.equal(farm.bonusRemainderSeconds,0);
  assert.equal(farm.farmDay.tiles.some(tile=>!tile.harvested),false);
});

test('two 25-minute crop tasks fill two selected beds without carrying growth', () => {
  let farm=createFarm(at,'UTC');
  farm=completeFocus(farm,task(farm,25,crop('strawberry')));
  assert.equal(farm.bonusBankSeconds,60);
  assert.equal(previewFocus(farm,null,[]),farm);
  farm=completeFocus(farm,task(farm,25,crop('peas')));
  assert.deepEqual(farm.farmDay.tiles.map(tile=>[tile.tileId,tile.cropId]),[[0,'strawberry'],[1,'peas']]);
  assert.equal(farm.bonusBankSeconds,120);
  assert.deepEqual(activeBed(farm),{areaId:0,tileId:2});
  assert.equal(farm.farmDay.tiles.some(tile=>!tile.harvested),false);
  const next=previewFocus(farm,crop('radish'),[{startMs:at,endMs:at}]);
  assert.equal(next.farmDay.tiles[2].focusSeconds,0);
  assert.equal(farm.farmDay.tiles.length,2);
});

test('bonus bank earns only on completion, caps at 15 minutes, and persists across days', () => {
  let farm=createFarm(at,'UTC');
  for(let i=0;i<17;i++) farm=completeFocus(farm,task(farm,25,crop('strawberry')));
  assert.equal(farm.bonusBankSeconds,900);
  assert.equal(farm.sessions.at(-1).bonusSeconds,60);
  assert.equal(farm.sessions.length,17);
  assert.equal(openFarmDay(farm,at+86400000).bonusBankSeconds,900);
  const before=structuredClone(farm);
  previewFocus(farm,crop('peas'),[{startMs:at,endMs:at+1500000}]);
  assert.deepEqual(farm,before);
});


test('manual bonus spending grows only the chosen target and creates no focus log', () => {
  const original=createFarm(at,'UTC');
  original.bonusBankSeconds=900;
  let farm=spendBonus(original,crop('strawberry'),5);
  assert.equal(farm.bonusBankSeconds,600);
  assert.equal(farm.farmDay.tiles[0].focusSeconds,300);
  assert.deepEqual(farm.sessions,[]);
  assert.deepEqual(original.farmDay.tiles,[]);
  const partial=createFarm(at,'UTC');
  partial.bonusBankSeconds=900;
  partial.farmDay.tiles.push({areaId:0,tileId:0,cropId:'strawberry',focusSeconds:300,harvested:false});
  assert.throws(()=>spendBonus(partial,crop('strawberry'),11),/remaining growth/);
  farm=spendBonus(farm,crop('strawberry'),10);
  assert.equal(farm.bonusBankSeconds,0);
  assert.equal(farm.inventory['crop:strawberry'],4);
  assert.deepEqual(activeBed(farm),{areaId:0,tileId:1});
  assert.equal(farm.farmDay.tiles.length,1);
  assert.deepEqual(farm.sessions,[]);
  assert.throws(()=>spendBonus(farm,crop('peas'),1),/available whole bonus minutes/);
  assert.throws(()=>spendBonus(original,{kind:'animal',animalId:'chicken'},15),/unlocked animal/);
  assert.throws(()=>spendBonus(original,crop('peas'),1.5),/whole bonus minutes/);
  const penFarm=createFarm(at,'UTC');
  penFarm.bonusBankSeconds=900;
  penFarm.progress.unlockedAnimals=['chicken'];
  const produced=spendBonus(penFarm,{kind:'animal',animalId:'chicken'},15);
  assert.equal(produced.bonusBankSeconds,0);
  assert.equal(produced.inventory['animal:chicken'],4);
  assert.equal(produced.farmDay.tiles.length,0);
  assert.equal(produced.sessions.length,0);
  assert.equal(penFarm.inventory['animal:chicken'],undefined);
});


test('completed focus minutes earn one bonus per cumulative 25, across task targets and days', () => {
  let farm=createFarm(at,'UTC');
  farm=completeFocus(farm,task(farm,15,crop('strawberry')));
  assert.equal(farm.sessions[0].bonusSeconds,0);
  assert.equal(farm.bonusBankSeconds,0);
  farm=openFarmDay(farm,at+86400000);
  delete farm.bonusRemainderSeconds; // Existing saves derive the remainder from completed sessions.
  farm.progress.unlockedAnimals=['chicken'];
  farm=completeFocus(farm,task(farm,15,{kind:'animal',animalId:'chicken'},at+86400000));
  assert.equal(farm.sessions[1].bonusSeconds,60);
  assert.equal(farm.bonusBankSeconds,60);
  assert.equal(farm.bonusRemainderSeconds,300);
  farm=completeFocus(farm,task(farm,20,crop('peas')));
  assert.equal(farm.sessions[2].bonusSeconds,60);
  assert.equal(farm.bonusBankSeconds,120);
  assert.equal(farm.bonusRemainderSeconds,0);
  assert.equal(farm.pens.chicken.focusSeconds,0);
});
