import assert from 'node:assert/strict';
import test from 'node:test';
import { chartRange, inventoryStats } from './inventory.ts';
import { createFarm } from './farm.ts';

test('fixed chart periods include month tails, leap days, year boundaries and selected targets', () => {
  const farm = createFarm(Date.parse('2024-01-01'), 'UTC');
  const session = (date, minutes, cropId='peas') => ({target:{kind:'crop',cropId},completionDate:date,focusSecondsByDate:{[date]:minutes*60}});
  farm.sessions = [session('2024-02-01',10),session('2024-02-07',20),session('2024-02-08',30),session('2024-02-14',40),session('2024-02-15',50),session('2024-02-21',60),session('2024-02-22',70),session('2024-02-29',80),session('2024-03-31',90),session('2024-02-29',5,'radish')];
  const month = inventoryStats(farm,'month','2024-02-29','crop:peas');
  assert.deepEqual(month.values.map(v=>v.minutes),[30,70,110,150]);
  assert.equal(month.to,'2024-02-29');
  assert.equal(month.completions,8);
  assert.equal(inventoryStats(farm,'month','2024-03-01').values[3].minutes,90);
  const year = inventoryStats(farm,'year','2024-08-15');
  assert.equal(year.values.length,12); assert.equal(year.minutes,455);
  assert.equal(year.values[1].minutes,365); assert.equal(year.values[2].minutes,90);
  assert.equal(inventoryStats(farm,'week','2024-02-29').values.length,7);
  assert.deepEqual(chartRange('week','2025-01-01'),{from:'2024-12-30',to:'2025-01-05'});
  assert.equal(chartRange('month','2024-01-31',1).from,'2024-02-01');
  assert.equal(chartRange('year','2024-02-29',1).from,'2025-01-01');
  assert.equal(chartRange('week','2025-01-01',-1).from,'2024-12-23');
  farm.sessions = [session('2024-12-31',10),session('2025-01-01',15)];
  assert.deepEqual(inventoryStats(farm,'week','2025-01-01').values.map(v=>v.minutes),[0,10,15,0,0,0,0]);
  assert.throws(()=>chartRange('day','2024-01-01'));
  assert.throws(()=>chartRange('month','2024-02-30'));
});
