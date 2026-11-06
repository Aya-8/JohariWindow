import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {traits} from '../server/domain.js';

test('ホストだけが開始前に選択数を設定でき、セッションごとの条件で最後まで進む',async()=>{
  const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'31995'},stdio:['ignore','pipe','pipe']});
  async function call(path,body,token){
    const r=await fetch('http://127.0.0.1:31995/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  }
  try{
    await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('server exited '+code)))});
    const a=(await call('/sessions',{displayName:'A'})).data;
    const b=(await call('/join',{code:a.code,name:'B'})).data;
    const path=`/s/${a.code}`;
    assert.deepEqual((await call(path+'/state',undefined,a.token)).data.selectionLimits,{min:3,max:8});
    assert.equal((await call(path+'/settings',{selectionLimits:{min:1,max:2}})).status,401);
    assert.equal((await call(path+'/settings',{selectionLimits:{min:1,max:2}},b.token)).status,403);
    for(const limits of [null,{min:0,max:2},{min:3,max:2},{min:1,max:46},{min:1.2,max:4},{min:'1',max:2}])assert.equal((await call(path+'/settings',{selectionLimits:limits},a.token)).status,400);
    assert.equal((await call(path+'/settings',{selectionLimits:{min:1,max:2}},a.token)).status,200);
    assert.deepEqual((await call(path+'/state',undefined,b.token)).data.selectionLimits,{min:1,max:2});
    const other=(await call('/sessions',{displayName:'別の回',debug:true})).data;
    assert.deepEqual((await call(`/s/${other.code}/state`,undefined,other.token)).data.selectionLimits,{min:3,max:8});
    assert.equal((await call(path+'/start',{selectionLimits:{min:3,max:2}},a.token)).status,400);
    assert.equal((await call(path+'/state',undefined,a.token)).data.phase,'lobby');
    assert.equal((await call(path+'/start',{selectionLimits:{min:1,max:1}},b.token)).status,403);
    // Starting commits the host's current unsaved settings atomically.
    assert.equal((await call(path+'/start',{selectionLimits:{min:2,max:2}},a.token)).status,200);
    assert.equal((await call(path+'/settings',{selectionLimits:{min:1,max:3}},a.token)).status,403);
    const state=(await call(path+'/state',undefined,a.token)).data;
    assert.deepEqual(state.selectionLimits,{min:2,max:2});
    assert.equal((await call(path+'/self',{traits:['論理的']},a.token)).status,200);
    assert.equal((await call(path+'/self',{traits:['論理的'],submit:true},a.token)).status,400);
    assert.equal((await call(path+'/self',{traits:traits.slice(0,3)},a.token)).status,400);
    for(const p of [a,b])assert.equal((await call(path+'/self',{traits:traits.slice(0,2),submit:true},p.token)).status,200);
    for(const [i,p] of [a,b].entries()){
      const target=state.participants[1-i];
      assert.equal((await call(path+'/answer/'+target.id,{traits:['論理的'],text:['','','','','']},p.token)).status,200);
      assert.equal((await call(path+'/answers/submit',{},p.token)).status,400);
      assert.equal((await call(path+'/answer/'+target.id,{traits:traits.slice(0,3),text:['','','','','']},p.token)).status,400);
      assert.equal((await call(path+'/answer/'+target.id,{traits:traits.slice(0,2),text:['','','','','']},p.token)).status,200);
      assert.equal((await call(path+'/answers/submit',{},p.token)).status,200);
    }
    assert.equal((await call(path+'/publish',{},a.token)).status,200);
    assert.deepEqual((await call(path+'/result',undefined,b.token)).data.selectionLimits,{min:2,max:2});
    // Debug participants also obey narrow, wide and all-trait limits.
    for(const limits of [{min:1,max:1},{min:12,max:14},{min:45,max:45}]){
      const host=(await call('/sessions',{displayName:'デバッグ',debug:true})).data;
      const root=`/s/${host.code}`;
      assert.equal((await call(root+'/start',{selectionLimits:limits},host.token)).status,200);
      const chosen=traits.slice(0,limits.min);
      const notes=Object.fromEntries(chosen.map(trait=>[trait,'あ'.repeat(1000)]));
      assert.equal((await call(root+'/self',{traits:chosen,notes,submit:true},host.token)).status,200);
      const debugState=(await call(root+'/state',undefined,host.token)).data;
      assert.equal(debugState.phase,'others');
      assert.ok(debugState.participants.filter(p=>p.sample).every(p=>p.selfDone&&p.done));
      for(const person of debugState.participants.filter(p=>p.sample))assert.equal((await call(root+'/answer/'+person.id,{traits:chosen,notes,text:['','','','','']},host.token)).status,200);
      assert.equal((await call(root+'/answers/submit',{},host.token)).status,200);
      assert.equal((await call(root+'/publish',{},host.token)).status,200);
      const result=(await call(root+'/result',undefined,host.token)).data;
      assert.deepEqual(result.selectionLimits,limits);
      assert.ok(result.comparison.every(row=>row.count<=2));
    }
  }finally{
    if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()});
  }
});
