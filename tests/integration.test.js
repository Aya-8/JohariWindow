import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('3人の診断・一括確定・権限・サーバー停止後の消去',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'johari-test-'));
  let child;
  async function start(){
    child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'31987',DB_PATH:join(dir,'db.sqlite')},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(Error('server exited '+c)))});
  }
  async function stop(){if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}
  async function call(path,body,token){
    const r=await fetch('http://127.0.0.1:31987/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  }
  try{
    await start();
    const a=(await call('/sessions',{displayName:'A'})).data;
    const code=a.code,path=`/s/${code}`;
    const b=(await call('/join',{code,name:'B'})).data,c=(await call('/join',{code,name:'C'})).data;
    const credentials=[a,b,c];
    assert.equal((await call(path+'/state',undefined,'invalid')).status,401);
    assert.equal((await call(path+'/start',{},b.token)).status,403);
    await call(path+'/start',{},a.token);
    assert.equal((await call('/join',{code,name:'D'})).status,400);
    assert.equal((await call(path+'/result',undefined,a.token)).status,403);
    const self={traits:['論理的','共感力が高い','責任感が強い'],notes:{論理的:'自分のエピソード'}};
    assert.equal((await call(path+'/self',self,a.token)).status,200);

    assert.equal((await call(path+'/state',undefined,a.token)).data.me.selfNotes.論理的,'自分のエピソード');
    assert.ok(!JSON.stringify((await call(path+'/state',undefined,b.token)).data).includes('自分のエピソード'));
    for(const p of credentials)assert.equal((await call(path+'/self',{...self,submit:true},p.token)).status,200);
    const people=(await call(path+'/state',undefined,a.token)).data.participants;
    const draft={traits:['慎重','行動力がある','好奇心旺盛'],text:['秘密の回答','','','',''],notes:{慎重:'保存されたエピソード'}};
    assert.equal((await call(path+'/answers/submit',{},a.token)).status,400);
    assert.equal((await call(path+'/answer/'+people[1].id,{...draft,submit:true},a.token)).status,400);
    assert.equal((await call(path+'/answer/'+people[1].id,draft,a.token)).status,200);
    assert.equal((await call(path+'/answers/submit',{},a.token)).status,400);
    assert.equal((await call(path+'/state',undefined,a.token)).data.me.answers[people[1].id].submitted,false);
    assert.ok(!JSON.stringify((await call(path+'/state',undefined,b.token)).data).includes('保存されたエピソード'));
    for(const [i,p] of credentials.entries()){
      for(const [j,target] of people.entries()){
        if(i===j)continue;
        const body={...draft,traits:[...draft.traits,...(i===2?['探究心がある']:[])],notes:{慎重:'他者のエピソード'+i}};
        assert.equal((await call(path+'/answer/'+target.id,body,p.token)).status,200);
      }
    }
    let state=(await call(path+'/state',undefined,a.token)).data;
    assert.equal(state.phase,'others');
    assert.ok(state.participants.every(p=>!p.done));
    assert.ok(Object.values(state.me.answers).every(answer=>!answer.submitted));

    state=(await call(path+'/state',undefined,a.token)).data;
    assert.equal(state.me.answers[people[1].id].notes.慎重,'他者のエピソード0');
    assert.equal((await call(path+'/answer/'+people[1].id,{...draft,notes:{慎重:'修正できたエピソード'}},a.token)).status,200);
    assert.equal((await call(path+'/answers/submit',{},a.token)).status,200);
    state=(await call(path+'/state',undefined,a.token)).data;
    assert.ok(Object.values(state.me.answers).every(answer=>answer.submitted));
    assert.equal(state.phase,'others');
    assert.equal((await call(path+'/answers/submit',{},a.token)).status,400);
    assert.equal((await call(path+'/answer/'+people[1].id,draft,a.token)).status,400);
    assert.equal((await call(path+'/result',undefined,a.token)).status,403);
    for(const p of [b,c])assert.equal((await call(path+'/answers/submit',{},p.token)).status,200);
    state=(await call(path+'/state',undefined,a.token)).data;
    assert.equal(state.phase,'waiting');
    assert.ok(!JSON.stringify(state).includes('token'));
    assert.equal((await call(path+'/result',undefined,b.token)).status,403);
    assert.equal((await call(path+'/publish',{},b.token)).status,403);
    assert.equal((await call(path+'/publish',{},a.token)).status,200);
    const result=(await call(path+'/result',undefined,a.token)).data;
    assert.equal(result.name,'A');
    assert.ok(result.comparison.every(t=>t.self||t.count>0));
    assert.ok(!result.comparison.some(t=>t.trait==='協調的'));
    assert.equal(result.comparison.find(t=>t.trait==='探究心がある').count,1);
    assert.equal(result.comparison.find(t=>t.trait==='探究心がある').category,'一部の他者が選択');
    assert.equal(result.traitFeedback.find(f=>f.trait==='論理的').selfNote,'自分のエピソード');
    assert.deepEqual(result.traitFeedback.find(f=>f.trait==='慎重').answers.slice().sort(),['他者のエピソード1','他者のエピソード2']);
    assert.equal(result.comparison.find(t=>t.trait==='慎重').category,'盲点');
    assert.ok(people.every(p=>!JSON.stringify(result).includes(p.id)));
    assert.equal((await call(path+'/memo',{memo:['保存メモ','','','']},a.token)).status,200);

    const restored=(await call(path+'/result',undefined,a.token)).data;
    assert.equal(restored.memo[0],'保存メモ');
    assert.ok(restored.comparison.every(t=>t.self||t.count>0));
    assert.equal(restored.traitFeedback.find(f=>f.trait==='慎重').answers.length,2);
    await stop();await start();
    assert.equal((await call(path+'/result',undefined,a.token)).status,401);
  }finally{await stop();rmSync(dir,{recursive:true,force:true})}
});
