import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

test('0〜2個の下書きを本人だけが復元でき、切り替え・消去・確定条件を守る',async()=>{
  const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'31994'},stdio:['ignore','pipe','pipe']});
  async function call(path,body,token){
    const r=await fetch('http://127.0.0.1:31994/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  }
  try{
    await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('server exited '+code)))});
    const a=(await call('/sessions',{displayName:'A'})).data;
    const b=(await call('/join',{code:a.code,name:'B'})).data;
    const c=(await call('/join',{code:a.code,name:'C'})).data;
    const path=`/s/${a.code}`;
    await call(path+'/start',{},a.token);
    assert.equal((await call(path+'/self',{traits:['慎重'],notes:{慎重:'途中の記述'}},a.token)).status,200);
    let restored=(await call(path+'/state',undefined,a.token)).data;
    assert.deepEqual(restored.me.self,['慎重']);assert.equal(restored.me.selfNotes.慎重,'途中の記述');
    assert.ok(!JSON.stringify((await call(path+'/state',undefined,b.token)).data).includes('途中の記述'));
    assert.equal((await call(path+'/self',{traits:['慎重'],submit:true},a.token)).status,400);
    assert.equal((await call(path+'/self',{traits:[],notes:{}},a.token)).status,200);
    assert.deepEqual((await call(path+'/state',undefined,a.token)).data.me.self,[]);
    for(const p of [a,b,c])assert.equal((await call(path+'/self',{traits:['慎重','論理的','堅実'],submit:true},p.token)).status,200);
    assert.equal((await call(path+'/self',{traits:[]},a.token)).status,400);
    const people=(await call(path+'/state',undefined,a.token)).data.participants;
    const [target1,target2]=people.filter(p=>p.name!=='A');
    const draft={traits:['慎重','論理的'],notes:{慎重:'二つだけ選択'},text:['記入途中','','','','']};
    assert.equal((await call(path+'/answer/'+target1.id,draft,a.token)).status,200);
    assert.equal((await call(path+'/answer/'+target2.id,{...draft,traits:['堅実'],notes:{}},a.token)).status,200);
    restored=(await call(path+'/state',undefined,a.token)).data;
    assert.deepEqual(restored.me.answers[target1.id].traits,draft.traits);
    assert.deepEqual(restored.me.answers[target1.id].text,draft.text);
    assert.equal(restored.me.answers[target1.id].notes.慎重,'二つだけ選択');
    assert.deepEqual(restored.me.answers[target2.id].traits,['堅実']);
    assert.ok(!JSON.stringify((await call(path+'/state',undefined,b.token)).data).includes('二つだけ選択'));
    assert.equal((await call(path+'/answers/submit',{},a.token)).status,400);
    assert.equal((await call(path+'/answer/'+target1.id,{traits:[],notes:{},text:['','','','','']},a.token)).status,200);
    assert.deepEqual((await call(path+'/state',undefined,a.token)).data.me.answers[target1.id].traits,[]);
    for(const target of [target1,target2])assert.equal((await call(path+'/answer/'+target.id,{traits:['慎重','論理的','堅実'],text:['','','','','']},a.token)).status,200);
    assert.equal((await call(path+'/answers/submit',{},a.token)).status,200);
    assert.equal((await call(path+'/answer/'+target1.id,draft,a.token)).status,400);
  }finally{
    if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()});
  }
});
