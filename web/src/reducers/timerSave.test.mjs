import assert from 'node:assert/strict';
import test from 'node:test';
import { initialTimer, timerReducer } from './timer.ts';
import { clearTimerState, loadTimerState, saveTimerState } from './timerSave.ts';
import { completeFocus, createFarm } from '../game/farm.ts';

test('a running or paused focus timer survives reload without tick writes', () => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const entries=new Map();
  let writes=0;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem: key => entries.get(key) ?? null,
    setItem: (key,value) => { writes++; entries.set(key,value); },
    removeItem: key => entries.delete(key),
  }});
  try {
    const target={kind:'crop',cropId:'strawberry'};
    let timer=timerReducer(initialTimer,{type:'startFocus',id:'session-1',label:'Write',minutes:25,now:1000000,target});
    assert.equal(saveTimerState(timer),true);
    const ticked=timerReducer(timer,{type:'tick',now:1600000});
    assert.equal(ticked,timer);
    assert.equal(writes,1);
    timer=timerReducer(loadTimerState(),{type:'pause',now:1600000});
    assert.equal(timer.remainingMs,900000);
    saveTimerState(timer);
    assert.equal(loadTimerState().status,'paused');
    timer=timerReducer(loadTimerState(),{type:'resume',now:5000000});
    saveTimerState(timer);
    timer=timerReducer(loadTimerState(),{type:'tick',now:5900000});
    assert.equal(timer.lastCompletedFocus.durationMs,1500000);
    assert.deepEqual(timer.lastCompletedFocus.intervals,[{startMs:1000000,endMs:1600000},{startMs:5000000,endMs:5900000}]);
    saveTimerState(timer);
    assert.equal(loadTimerState().kind,'break');
    const restoredBreak=timerReducer(loadTimerState(),{type:'tick',now:6020000});
    assert.equal(restoredBreak.deadline-6020000,180000);
    const finished=timerReducer(restoredBreak,{type:'tick',now:6200000});
    saveTimerState(finished);
    assert.equal(loadTimerState().lastCompletedFocus.id,'session-1');
    clearTimerState();
    assert.equal(loadTimerState(),null);
    const midnight=Date.UTC(2026,0,1,23,55);
    saveTimerState(timerReducer(initialTimer,{type:'startFocus',id:'midnight',label:'Late work',minutes:15,now:midnight,target}));
    const overdue=timerReducer(loadTimerState(),{type:'tick',now:midnight+18*60000});
    const farm=completeFocus(createFarm(midnight,'UTC'),overdue.lastCompletedFocus);
    assert.deepEqual(farm.sessions[0].focusSecondsByDate,{'2026-01-01':300,'2026-01-02':600});
  } finally { if(previous) Object.defineProperty(globalThis,'localStorage',previous); else delete globalThis.localStorage; }
});

test('corrupt timer snapshots are ignored', () => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{bad json',setItem(){},removeItem(){}}});
  try { assert.equal(loadTimerState(),null); }
  finally { if(previous) Object.defineProperty(globalThis,'localStorage',previous); else delete globalThis.localStorage; }
});
