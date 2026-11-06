import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {traits,traitGroups} from '../server/domain.js';
import ts from 'typescript';

const compiled=ts.transpileModule(readFileSync(new URL('../src/TraitPicker.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText.replace("from 'react'",'from '+JSON.stringify(new URL('../node_modules/react/index.js',import.meta.url).href));
const {TraitPicker}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const render=selection=>renderToStaticMarkup(createElement(TraitPicker,{traits,groups:traitGroups,selection,onChoose:()=>{},disabled:false}));

test('自己評価・他者評価共通の初期描画で45個すべての選択肢を表示する',()=>{
  const html=render([]);
  assert.equal((html.match(/<button /g)||[]).length,45);
  for(const trait of traits)assert.ok(html.includes('>'+trait+'</button>'),trait);
  assert.ok(!html.includes('すべての特徴を見る'));
  assert.ok(!html.includes('<legend'));
  assert.ok(!html.includes('ほかの特徴'));
  assert.ok(!html.includes(' hidden'));
});
test('ホストが設定した上限と固定個数を案内・無効化条件に反映する',()=>{
  const custom=renderToStaticMarkup(createElement(TraitPicker,{traits,groups:traitGroups,selection:traits.slice(0,4),limits:{min:2,max:4},onChoose:()=>{},disabled:false}));
  assert.ok(custom.includes('2〜4個選んでください'));
  assert.ok(custom.includes('4個選択中です'));
  assert.equal((custom.match(/ disabled=""/g)||[]).length,41);
  const fixed=renderToStaticMarkup(createElement(TraitPicker,{traits,groups:traitGroups,selection:[],limits:{min:5,max:5},onChoose:()=>{},disabled:false}));
  assert.ok(fixed.includes('5個選んでください'));
  assert.ok(!fixed.includes('5〜5個'));
});
test('8個選択時も全項目を表示し、解除可能な選択済みボタンを残す',()=>{
  const html=render(traits.slice(0,8));
  assert.equal((html.match(/<button /g)||[]).length,45);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,8);
  assert.equal((html.match(/ disabled=""/g)||[]).length,37);
});
