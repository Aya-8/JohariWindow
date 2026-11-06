import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

for(const count of [2,10])test(`${count}人で開始から結果公開まで進み、人数境界と過半数を守る`,async()=>{
  const dir=mkdtempSync(join(tmpdir(),'johari-participants-'));
  const port=31990+count;
  const child=spawn(process.execPath,['server/index.js'],{
    env:{...process.env,PORT:String(port),DB_PATH:join(dir,'db.sqlite')},
    stdio:['ignore','pipe','pipe'],
  });
  async function call(path,body,token){
    const response=await fetch(`http://127.0.0.1:${port}/api${path}`,{
      method:body?'POST':'GET',
      headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
      body:body?JSON.stringify(body):undefined,
    });
    return {status:response.status,data:await response.json()};
  }
  try{
    await new Promise((resolve,reject)=>{
      child.stdout.once('data',resolve);
      child.once('error',reject);
      child.once('exit',code=>reject(Error(`server exited ${code}`)));
    });
    assert.deepEqual((await call('/config')).data.participantLimits,{min:2,max:10});
    const host=(await call('/sessions',{displayName:'ホスト'})).data;
    const path=`/s/${host.code}`;
    assert.equal((await call(path+'/start',{},host.token)).status,403);
    const credentials=[host];
    for(let i=1;i<count;i++){
      const joined=await call('/join',{code:host.code,name:`参加者${i}`});
      assert.equal(joined.status,200);
      credentials.push(joined.data);
    }
    const people=(await call(path+'/state',undefined,host.token)).data.participants;
    assert.equal(people.length,count);
    if(count===10)assert.equal((await call('/join',{code:host.code,name:'11人目'})).status,400);
    assert.equal((await call(path+'/start',{},host.token)).status,200);
    assert.equal((await call('/join',{code:host.code,name:'開始後の参加者'})).status,400);
    for(const person of credentials){
      assert.equal((await call(path+'/self',{traits:['論理的','計画的','好奇心旺盛'],submit:true},person.token)).status,200);
    }
    assert.equal((await call(path+'/state',undefined,host.token)).data.phase,'others');
    const reviewers=count-1,majority=Math.floor(reviewers/2)+1;
    for(let target=0;target<count;target++){
      let ordinal=0;
      for(let reviewer=0;reviewer<count;reviewer++){
        if(reviewer===target)continue;
        const traits=['論理的','共感力が高い',ordinal++<majority?'慎重':'誠実'];
        assert.equal((await call(path+'/answer/'+people[target].id,{traits,text:['','','','','']},credentials[reviewer].token)).status,200);
      }
    }
    for(const person of credentials.slice(0,-1)){
      assert.equal((await call(path+'/answers/submit',{},person.token)).status,200);
    }
    assert.equal((await call(path+'/state',undefined,host.token)).data.phase,'others');
    assert.equal((await call(path+'/publish',{},host.token)).status,403);
    assert.equal((await call(path+'/result',undefined,host.token)).status,403);
    assert.equal((await call(path+'/answers/submit',{},credentials.at(-1).token)).status,200);
    assert.equal((await call(path+'/state',undefined,host.token)).data.phase,'waiting');
    assert.equal((await call(path+'/publish',{},host.token)).status,200);
    for(const person of credentials){
      const result=(await call(path+'/result',undefined,person.token)).data;
      assert.ok(result.comparison.every(row=>row.total===reviewers));
      assert.equal(result.comparison.find(row=>row.trait==='論理的').category,'開放');
      assert.equal(result.comparison.find(row=>row.trait==='計画的').category,'秘密');
      const blind=result.comparison.find(row=>row.trait==='慎重');
      assert.equal(blind.count,majority);
      assert.equal(blind.category,'盲点');
      if(count===10){
        const minority=result.comparison.find(row=>row.trait==='誠実');
        assert.equal(minority.count,4);
        assert.equal(minority.category,'一部の他者が選択');
      }
    }
  }finally{
    if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()});
    assert.ok(dir.startsWith(join(tmpdir(),'johari-participants-')));
    rmSync(dir,{recursive:true,force:true});
  }
});
