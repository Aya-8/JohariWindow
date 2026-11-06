import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

test('診断・結果・メモをファイルに書かず、再起動で全セッションが消える',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'johari-memory-'));
  const entry=resolve('server/index.js');
  let child,logs='';
  async function start(){
    child=spawn(process.execPath,[entry],{
      cwd:dir,env:{...process.env,PORT:'31993',DB_PATH:join(dir,'must-not-exist.sqlite')},
      stdio:['ignore','pipe','pipe'],
    });
    child.stdout.on('data',data=>{logs+=data});
    child.stderr.on('data',data=>{logs+=data});
    await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error(`server exited ${code}`)))});
  }
  async function stop(){if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}
  async function call(path,body,token){
    const response=await fetch('http://127.0.0.1:31993/api'+path,{
      method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
      body:body?JSON.stringify(body):undefined,
    });
    assert.equal(response.headers.get('cache-control'),'no-store');
    return {status:response.status,data:await response.json()};
  }
  try{
    await start();
    assert.equal((await call('/config')).data.storage,'memory');
    const host=(await call('/sessions',{displayName:'一時保存テスト',debug:true})).data;
    const path=`/s/${host.code}`;
    assert.equal((await call(path+'/start',{},host.token)).status,200);
    assert.equal((await call(path+'/self',{traits:['論理的','慎重','行動力がある'],notes:{論理的:'ディスクに残さない記述'},submit:true},host.token)).status,200);
    const state=(await call(path+'/state',undefined,host.token)).data;
    assert.equal(state.me.selfNotes.論理的,'ディスクに残さない記述');
    for(const person of state.participants.filter(p=>p.sample)){
      assert.equal((await call(path+'/answer/'+person.id,{traits:['論理的','慎重','行動力がある'],text:['','','','','']},host.token)).status,200);
    }
    assert.equal((await call(path+'/answers/submit',{},host.token)).status,200);
    assert.equal((await call(path+'/publish',{},host.token)).status,200);
    assert.equal((await call(path+'/memo',{memo:['ディスクに残さないメモ','','','']},host.token)).status,200);
    assert.equal((await call(path+'/result',undefined,host.token)).data.memo[0],'ディスクに残さないメモ');
    assert.deepEqual(readdirSync(dir),[]);
    assert.ok(!logs.includes('ディスクに残さない'));
    await stop();await start();
    assert.equal((await call(path+'/state',undefined,host.token)).status,401);
    assert.equal((await call(path+'/result',undefined,host.token)).status,401);
    assert.equal((await call('/join',{code:host.code,name:'再参加'})).status,400);
    assert.deepEqual(readdirSync(dir),[]);
  }finally{
    await stop();
    assert.ok(dir.startsWith(join(tmpdir(),'johari-memory-')));
    rmSync(dir,{recursive:true,force:true});
  }
});
