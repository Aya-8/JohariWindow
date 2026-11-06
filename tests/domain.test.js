import {test} from 'node:test';import assert from 'node:assert/strict';import{aggregate,validateAnswer,validateDraft,validateSelectionLimits,canReadResult,traits,traitGroups}from'../server/domain.js';
test('過半数、同数、未選択を正しく分類する',()=>{const r=aggregate(['論理的','慎重'],[{traits:['論理的','行動力がある','慎重']},{traits:['論理的','行動力がある']}]);assert.equal(r[0].category,'開放');assert.equal(r[1].category,'秘密');assert.equal(r[2].category,'盲点');assert.equal(r[3].category,'未選択');assert.equal(r[0].count,2);assert.ok(r.every(x=>x.category!=='未知'));});
test('結果は公開後かつ本人のみ',()=>{assert.equal(canReadResult('others','a','a'),false);assert.equal(canReadResult('waiting','a','a'),false);assert.equal(canReadResult('results','a','b'),false);assert.equal(canReadResult('results','a','a'),true)});
test('セッションの選択数に従い、下書きと確定の境界を検証する',()=>{
  for(const limits of [{min:1,max:1},{min:2,max:4},{min:12,max:20},{min:45,max:45}]){
    assert.ok(validateSelectionLimits(limits));
    const answer={traits:traits.slice(0,limits.min),text:['','','','','']};
    assert.ok(validateAnswer(answer,limits));
    assert.ok(!validateAnswer({...answer,traits:traits.slice(0,limits.min-1)},limits));
    assert.ok(validateDraft({...answer,traits:[]},limits));
    if(limits.max<45)assert.ok(!validateDraft({...answer,traits:traits.slice(0,limits.max+1)},limits));
  }
  for(const limits of [null,{},[],{min:0,max:8},{min:4,max:3},{min:1,max:46},{min:1.5,max:8},{min:1,max:'8'}]){
    assert.ok(!validateSelectionLimits(limits));
    assert.ok(!validateAnswer({traits:['論理的'],text:['','','','','']},limits));
  }
});
test('他者の少数・同数の選択は未選択と区別し、自己選択時は秘密を維持する',()=>{
  for(const total of [2,3,9]){
    const others=Array.from({length:total},(_,i)=>({traits:i<Math.floor(total/2)?['慎重']:[]}));
    const row=aggregate([],others).find(r=>r.trait==='慎重');
    assert.equal(row.category,'一部の他者が選択');
    assert.equal(row.minority,true);
    const self=aggregate(['慎重'],others).find(r=>r.trait==='慎重');
    assert.equal(self.category,'秘密');assert.equal(self.minority,true);
    const absent=aggregate([],others).find(r=>r.trait==='論理的');
    assert.equal(absent.category,'未選択');assert.equal(absent.minority,false);
  }
  assert.equal(aggregate([],[{traits:['慎重']}]).find(r=>r.trait==='慎重').category,'盲点');
});
test('下書きだけは0〜2個も許可し、入力制約と確定時の最低数は維持する',()=>{
  for(const selected of [[],['論理的'],['論理的','慎重']]){
    const answer={traits:selected,text:['','','','',''],notes:{}};
    assert.ok(validateDraft(answer));assert.ok(!validateAnswer(answer));
  }
  for(const answer of [
    {traits:traits.slice(0,9),text:['','','','','']},
    {traits:['論理的','論理的'],text:['','','','','']},
    {traits:['不明'],text:['','','','','']},
    {traits:[],notes:{慎重:'未選択'},text:['','','','','']},
    {traits:['慎重'],notes:{慎重:'x'.repeat(1001)},text:['','','','','']},
    {traits:[],text:['x'.repeat(1001),'','','','']},
  ])assert.ok(!validateDraft(answer));
});
test('対の特徴も独立して選択・集計できる',()=>{
  assert.equal(traits.length,45);
  assert.equal(new Set(traits).size,45);
  for(const group of traitGroups){
    assert.ok(group.traits.every(trait=>traits.includes(trait)));
    const selected=[...group.traits,'共感力が高い'];
    assert.ok(validateAnswer({traits:selected,text:['','','','','']}));
    const result=aggregate(selected,[{traits:group.traits},{traits:group.traits}]);
    assert.ok(result.filter(row=>group.traits.includes(row.trait)).every(row=>row.category==='開放'&&row.count===2));
  }
});
test('選択数、重複、未知の特徴、自由記述を検証する',()=>{const a={traits:['論理的','慎重','行動力がある'],text:['','','','','']};assert.ok(validateAnswer(a));assert.ok(validateAnswer({...a,traits:traits.slice(0,8)}));for(const selectedTraits of [[],['論理的'],['論理的','慎重'],['論理的','論理的','慎重'],['論理的','慎重','不明'],traits.slice(0,9)])assert.ok(!validateAnswer({...a,traits:selectedTraits}));assert.ok(!validateAnswer({...a,text:['x'.repeat(1001),'','','','']}));});



test('理由・エピソードは省略可能で選択した特徴だけに付けられる',()=>{
  const a={traits:['論理的','慎重','行動力がある'],text:['','','','','']};
  assert.ok(validateAnswer({...a,notes:{}}));
  assert.ok(validateAnswer({...a,notes:{論理的:'',慎重:'x'.repeat(1000)}}));
  for(const notes of [null,[],{慎重:7},{慎重:'x'.repeat(1001)},{共感力が高い:'未選択の特徴'}])assert.ok(!validateAnswer({...a,notes}));
});
