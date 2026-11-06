import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
// Compile the pure queue in memory; no browser, files or new dependencies.
const compiled=ts.transpileModule(readFileSync(new URL('../src/draftQueue.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createDraftQueue}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

test('保存中の連続編集を最新値にまとめ、切り替え時は全書き込みの完了を待つ',async()=>{
  const sent=[],release=[],statuses=[];
  const queue=createDraftQueue(job=>new Promise(resolve=>{sent.push(job);release.push(resolve);}),status=>statuses.push(status));
  queue.update({target:'A',traits:['論理的']});
  const first=queue.flush();
  await Promise.resolve();
  queue.update({target:'A',traits:['論理的','慎重']});
  queue.update({target:'A',traits:[]});
  const navigation=queue.flush();
  assert.equal(sent.length,1);
  release[0]();
  for(let i=0;i<10&&sent.length<2;i++)await Promise.resolve();
  assert.equal(sent.length,2);
  assert.deepEqual(sent[1].traits,[]);
  assert.equal(queue.hasPending(),true);
  release[1]();
  await Promise.all([first,navigation]);
  assert.equal(queue.hasPending(),false);
  assert.equal(statuses.at(-1),'saved');
  queue.cancelTimer();
});
test('通信失敗でも最新入力を残し、復帰後に再送できる',async()=>{
  let fail=true;const sent=[],statuses=[];
  const queue=createDraftQueue(async job=>{if(fail)throw Error('offline');sent.push(job);},status=>statuses.push(status));
  queue.update({target:'A',notes:'通信中の記述'});
  await assert.rejects(queue.flush(),/offline/);
  assert.equal(queue.hasPending(),true);assert.equal(statuses.at(-1),'error');
  queue.update({target:'A',notes:'復帰前の最新記述'});
  fail=false;await queue.flush();
  assert.deepEqual(sent,[{target:'A',notes:'復帰前の最新記述'}]);
  assert.equal(queue.hasPending(),false);assert.equal(statuses.at(-1),'saved');
  queue.cancelTimer();
});
test('認証失効で破棄した下書きを再送しない',async()=>{
  let calls=0;const queue=createDraftQueue(async()=>{calls++;},()=>{});
  queue.update({target:'expired'});queue.discard();await queue.flush();
  assert.equal(calls,0);assert.equal(queue.hasPending(),false);
});
