import test from "node:test";
import assert from "node:assert/strict";
import { completeFocus, createFarm } from "./farm.ts";
import { readFarmFile } from "./save.ts";

const fileFor = value => new Blob([JSON.stringify(value)]);

test("save file round-trips a valid farm", async () => {
  const farm = createFarm(Date.UTC(2026, 0, 1), "UTC");
  assert.deepEqual(await readFarmFile(fileFor({ version: 1, farm })), farm);
});

test("save file rejects unsupported versions and malformed farm state", async () => {
  const farm = createFarm(Date.UTC(2026, 0, 1), "UTC");
  await assert.rejects(readFarmFile(fileFor({ version: 2, farm })), /valid Focus Valley save/);
  await assert.rejects(readFarmFile(fileFor({ version: 1, farm: { ...farm, avatar: {} } })), /valid Focus Valley save/);
  await assert.rejects(readFarmFile(fileFor({ version: 1, farm: { ...farm, farmDay: { ...farm.farmDay, tiles: [{ cropId: "invalid" }] } } })), /valid Focus Valley save/);
  await assert.rejects(readFarmFile(fileFor({ version: 1, farm: { ...farm, farmDay: { ...farm.farmDay, date: "2026-02-31" } } })), /valid Focus Valley save/);
});

test("save file rejects invalid JSON", async () => {
  await assert.rejects(readFarmFile(new Blob(["{"])), /valid Focus Valley save/);
});


test('pen display state survives backups, accepts old saves, and rejects invalid counts', async () => {
  const farm=createFarm(Date.UTC(2026,0,1),'UTC');
  farm.pens.chicken={focusSeconds:600};
  farm.inventory['animal:chicken']=8;
  assert.deepEqual(await readFarmFile(fileFor({version:1,farm})),farm);
  for (const visibleProduce of [0,4]) {
    farm.pens.chicken.visibleProduce=visibleProduce;
    assert.deepEqual(await readFarmFile(fileFor({version:1,farm})),farm);
  }
  for (const visibleProduce of [-1,5,1.5,'4',null]) {
    farm.pens.chicken.visibleProduce=visibleProduce;
    await assert.rejects(readFarmFile(fileFor({version:1,farm})),/valid Focus Valley save/);
  }
});


test('old crop credit is discarded on import; cumulative bonus remainder is validated', async () => {
  const farm=createFarm(Date.UTC(2026,0,1),'UTC');
  const legacy={...farm,cropCreditSeconds:600};
  assert.deepEqual(await readFarmFile(fileFor({version:1,farm:legacy})),farm);
  for (const seconds of [0,300,900,1440]) {
    farm.bonusRemainderSeconds=seconds;
    assert.deepEqual(await readFarmFile(fileFor({version:1,farm})),farm);
  }
  for (const seconds of [-60,30,1500,'300',null]) {
    farm.bonusRemainderSeconds=seconds;
    await assert.rejects(readFarmFile(fileFor({version:1,farm})),/valid Focus Valley save/);
  }
});

test('bonus bank accepts old saves and validates the fifteen-minute cap', async () => {
  const farm=createFarm(Date.UTC(2026,0,1),'UTC');
  assert.deepEqual(await readFarmFile(fileFor({version:1,farm})),farm);
  for (const seconds of [0,60,900]) {
    farm.bonusBankSeconds=seconds;
    assert.deepEqual(await readFarmFile(fileFor({version:1,farm})),farm);
  }
  for (const seconds of [-60,30,901,'60',null]) {
    farm.bonusBankSeconds=seconds;
    await assert.rejects(readFarmFile(fileFor({version:1,farm})),/valid Focus Valley save/);
  }
});

test('save files retain a pending long break and reject an invalid cycle marker', async () => {
  let farm=createFarm(Date.UTC(2026,0,1),'UTC');
  for(let index=0;index<4;index++) {
    const start=Date.UTC(2026,0,1)+index*1200000;
    farm=completeFocus(farm,{id:`focus-${index}`,label:'Work',durationMs:900000,target:{kind:'crop',cropId:'strawberry'},intervals:[{startMs:start,endMs:start+900000}]});
  }
  farm.breakCycleStart=0;
  assert.deepEqual(await readFarmFile(fileFor({version:1,farm})),farm);
  assert.deepEqual(await readFarmFile(fileFor({version:1,farm:{...farm,breakCycleStart:4}})),{...farm,breakCycleStart:4});
  await assert.rejects(readFarmFile(fileFor({version:1,farm:{...farm,breakCycleStart:5}})),/valid Focus Valley save/);
});
