import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('ホスト1人でデバッグを完走でき、通常の人数・閲覧制限を維持する',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'johari-debug-'));
  let child;
  async function start(){
    child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'31989',DB_PATH:join(dir,'db.sqlite')},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(Error('server exited '+c)))});
  }
  async function stop(){if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}
  async function call(path,body,token){
    const r=await fetch('http://127.0.0.1:31989/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  }
  try{
    await start();
    const normal=(await call('/sessions',{displayName:'通常ホスト'})).data;
    assert.equal((await call(`/s/${normal.code}/start`,{debug:true},normal.token)).status,403);
    const host=(await call('/sessions',{displayName:'デバッグホスト',debug:true})).data;
    const path=`/s/${host.code}`;
    let state=(await call(path+'/state',undefined,host.token)).data;
    assert.equal(state.debug,true);
    assert.equal(state.participants.length,3);
    assert.equal(state.participants.filter(p=>p.sample).length,2);
    assert.equal((await call('/join',{code:host.code,name:'外部参加者'})).status,400);
    assert.equal((await call(path+'/state')).status,401);
    assert.equal((await call(path+'/start',{},host.token)).status,200);
    assert.equal((await call(path+'/self',{traits:['論理的','慎重','行動力がある']},host.token)).status,200);
    assert.equal((await call(path+'/state',undefined,host.token)).data.phase,'self');
    assert.equal((await call(path+'/self',{traits:['論理的','慎重','行動力がある'],submit:true},host.token)).status,200);
    state=(await call(path+'/state',undefined,host.token)).data;
    assert.equal(state.phase,'others');
    assert.ok(state.participants.filter(p=>p.sample).every(p=>p.done));
    assert.ok(!JSON.stringify(state).includes('【サンプル】'));
    assert.equal((await call(path+'/result',undefined,host.token)).status,403);

    assert.equal((await call(path+'/state',undefined,host.token)).data.debug,true);
    for(const person of state.participants.filter(p=>p.sample)){
      assert.equal((await call(path+'/answer/'+person.id,{traits:['論理的','慎重','行動力がある'],text:['','','','',''],submit:false},host.token)).status,200);
    }
    assert.equal((await call(path+'/state',undefined,host.token)).data.phase,'others');
    assert.equal((await call(path+'/answers/submit',{},host.token)).status,200);
    assert.equal((await call(path+'/state',undefined,host.token)).data.phase,'waiting');
    assert.equal((await call(path+'/publish',{},host.token)).status,200);
    const result=(await call(path+'/result',undefined,host.token)).data;
    assert.equal(result.debug,true);
    assert.ok(result.comparison.some(t=>t.category==='開放'));
    assert.ok(result.comparison.some(t=>t.category==='盲点'));
    assert.ok(result.comparison.some(t=>t.category==='秘密'));
    assert.ok(result.traitFeedback.some(f=>f.answers.some(a=>a.includes('【サンプル】'))));
    assert.ok(state.participants.every(p=>!JSON.stringify(result).includes(p.id)));
    assert.equal((await call(path+'/memo',{memo:['デバッグのメモ','','','']},host.token)).status,200);
    assert.equal((await call(path+'/result',undefined,host.token)).data.memo[0],'デバッグのメモ');
  }finally{await stop();rmSync(dir,{recursive:true,force:true})}
});
