import assert from 'node:assert/strict';
import test from 'node:test';
import { initialTimer, timerReducer } from './timer.ts';

test('minimum focus duration is 15 minutes; target is fixed; pauses and cancellation earn nothing', () => {
  for(const minutes of [1,14,14.5,241,NaN]) assert.equal(timerReducer(initialTimer,{type:'startFocus',label:'Work',minutes,now:0}),initialTimer);
  let state=timerReducer(initialTimer,{type:'startFocus',id:'one',label:' Study ',minutes:15,now:0,target:{kind:'animal',animalId:'chicken'}});
  state=timerReducer(state,{type:'pause',now:300000});
  assert.equal(state.remainingMs,600000);
  state=timerReducer(state,{type:'resume',now:3600000});
  state=timerReducer(state,{type:'tick',now:4200000});
  assert.deepEqual(state.lastCompletedFocus,{id:'one',label:'Study',durationMs:900000,target:{kind:'animal',animalId:'chicken'},intervals:[{startMs:0,endMs:300000},{startMs:3600000,endMs:4200000}]});
  assert.equal(state.kind,'break'); assert.equal(state.remainingMs,300000);
  state=timerReducer(state,{type:'skipBreak',now:4200001});
  state=timerReducer(state,{type:'startFocus',id:'two',label:'Work',minutes:25,now:4300000});
  state=timerReducer(state,{type:'cancel',now:4300001});
  assert.equal(state.lastCompletedFocus,null); assert.equal(state.completedFocusDurationsMs.length,1);
});

test('automatic fourth break uses actual durations and is capped at 15 minutes; late tabs finish once', () => {
  let state=initialTimer;
  for(let i=0;i<4;i++) {
    const start=i*10000000;
    state=timerReducer(state,{type:'startFocus',label:'Work',minutes:50,now:start});
    state=timerReducer(state,{type:'tick',now:start+3000000});
    assert.equal(state.remainingMs,(i===3?15:5)*60000);
    assert.equal(state.completedFocusDurationsMs[i],3000000);
    state=timerReducer(state,{type:'skipBreak',now:state.deadline-1});
  }
  state=timerReducer(state,{type:'startFocus',label:'Late',minutes:15,now:50000000});
  state=timerReducer(state,{type:'tick',now:60000000});
  assert.equal(state.status,'idle'); assert.equal(state.completedFocusDurationsMs.length,5);
  state=timerReducer(state,{type:'tick',now:70000000});
  assert.equal(state.completedFocusDurationsMs.length,5);
});
