import test from "node:test";
import assert from "node:assert/strict";
import { createFarm } from "./farm.ts";
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
