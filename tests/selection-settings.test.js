import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/SelectionSettings.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText.replace("from 'react'",'from '+JSON.stringify(new URL('../node_modules/react/index.js',import.meta.url).href));
const {SelectionSettings}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const render=(limits,dirty=true,busy=false)=>renderToStaticMarkup(createElement(SelectionSettings,{limits,dirty,busy,traitCount:45,onChange:()=>{},onSave:()=>{}}));
test('下限・上限の設定欄に1〜45個を表示し、保存前の設定と固定個数を案内する',()=>{
  const html=render({min:5,max:5});
  assert.equal((html.match(/<select(?:>| )/g)||[]).length,2);
  assert.equal((html.match(/<option /g)||[]).length,90);
  assert.equal((html.match(/selected=""/g)||[]).length,2);
  assert.ok(html.includes('固定できます'));
  assert.ok(html.includes('この設定で開始してください'));
  assert.ok(!html.includes('disabled=""'));
});
test('不正な範囲・未変更・通信中は設定保存を無効にする',()=>{
  assert.ok(render({min:8,max:3}).includes('role="alert"'));
  assert.ok(render({min:8,max:3}).includes('disabled=""'));
  assert.ok(render({min:3,max:8},false).includes('disabled=""'));
  assert.match(render({min:3,max:8},true,true),/<fieldset[^>]*disabled=""/);
});
