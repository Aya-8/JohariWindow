import {createSamples,prepareSamples,fillSampleAnswers} from './debug.js';
import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomBytes,createHash} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {resolve} from 'node:path';
import {traits,traitGroups,participantLimits,defaultSelectionLimits,validateSelectionLimits,questions,aggregate,validateAnswer,validateDraft,canReadResult} from './domain.js';
const app=express(), http=createServer(app),io=new Server(http);const port=Number(process.env.PORT||3000);
// Session contents exist only in this process. Never create or load a database.
const sessions=new Map();
const random=()=>randomBytes(24).toString('hex');const hash=t=>createHash('sha256').update(t).digest('hex');
function save(s){io.to(s.code).emit('refresh');}
function publicState(s){return {code:s.code,name:s.name,debug:!!s.debug,phase:s.phase,created:s.created,selectionLimits:s.selectionLimits,participants:s.people.map(p=>({id:p.id,name:p.name,host:p.host,sample:!!p.sample,selfDone:!!p.self,done:s.people.filter(x=>x.id!==p.id).every(x=>p.answers[x.id]?.submitted)}))};}
app.disable('etag');
app.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.use(express.json({limit:'256kb'}));
const counts=new Map();app.use('/api',(req,res,next)=>{const key=req.ip,now=Date.now(),v=counts.get(key);if(!v||now-v.at>60000)counts.set(key,{at:now,n:1});else if(++v.n>600)return res.status(429).json({error:'操作が多すぎます。少し待ってください。'});next();});
app.get('/api/config',(req,res)=>res.json({storage:'memory',traits,traitGroups,participantLimits,defaultSelectionLimits,questions,urls:Object.values(networkInterfaces()).flat().filter(x=>x&&x.family==='IPv4'&&!x.internal).map(x=>`http://${x.address}:${port}`)}));
function name(v,max=40){return typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;}
app.post('/api/sessions',(req,res)=>{if(!name(req.body.displayName))return res.status(400).json({error:'名前を入力してください。'});let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(sessions.has(code));const token=random();const p={id:randomBytes(8).toString('hex'),name:req.body.displayName.trim(),host:true,token:hash(token),answers:{},memo:['','','','']};const s={code,name:code,created:new Date().toISOString(),phase:'lobby',selectionLimits:{...defaultSelectionLimits},debug:req.body.debug===true,people:[p,...(req.body.debug===true?createSamples():[])]};sessions.set(code,s);save(s);res.json({code,token,debug:s.debug});});
app.post('/api/join',(req,res)=>{const s=sessions.get(String(req.body.code).toUpperCase());if(!s||s.debug||s.phase!=='lobby'||s.people.length>=participantLimits.max)return res.status(400).json({error:'入室できません。コード・人数・開始状況を確認してください。'});if(!name(req.body.name)||s.people.some(p=>p.name===req.body.name.trim()))return res.status(400).json({error:'別の表示名を入力してください。'});const token=random();s.people.push({id:randomBytes(8).toString('hex'),name:req.body.name.trim(),host:false,token:hash(token),answers:{},memo:['','','','']});save(s);res.json({code:s.code,token});});
app.use('/api/s/:code',(req,res,next)=>{const s=sessions.get(req.params.code);const token=req.headers.authorization?.replace(/^Bearer /,'');const p=s?.people.find(p=>p.token===hash(token||''));if(!p)return res.status(401).json({error:'参加キーを確認してください。サーバー再起動後のセッションは復元できません。'});req.session=s;req.person=p;next();});
app.get('/api/s/:code/state',(req,res)=>{const s=req.session,p=req.person;res.json({...publicState(s),me:{id:p.id,host:p.host,self:p.self||p.selfDraft||[],selfNotes:p.selfNotes||{},answers:p.answers,memo:p.memo}});});
app.post('/api/s/:code/settings',(req,res)=>{
  const s=req.session;
  if(!req.person.host||s.phase!=='lobby')return res.status(403).json({error:'選択数を変更できるのは開始前のホストだけです。'});
  if(!validateSelectionLimits(req.body.selectionLimits))return res.status(400).json({error:'選択数は1〜45個の整数で、最低選択数が最大選択数を超えないようにしてください。'});
  s.selectionLimits={min:req.body.selectionLimits.min,max:req.body.selectionLimits.max};save(s);res.json({ok:true});
});
app.post('/api/s/:code/start',(req,res)=>{
  const s=req.session;
  if(!req.person.host||s.phase!=='lobby'||s.people.length<participantLimits.min||s.people.length>participantLimits.max)return res.status(403).json({error:'ホストが2〜10人の入室後に開始できます。'});
  if(Object.hasOwn(req.body,'selectionLimits')){
    if(!validateSelectionLimits(req.body.selectionLimits))return res.status(400).json({error:'選択数は1〜45個の整数で、最低選択数が最大選択数を超えないようにしてください。'});
    s.selectionLimits={min:req.body.selectionLimits.min,max:req.body.selectionLimits.max};
  }
  prepareSamples(s);s.phase='self';save(s);res.json({ok:true});
});
app.post('/api/s/:code/self',(req,res)=>{const s=req.session,p=req.person;const a={traits:req.body.traits,notes:req.body.notes,text:['','','','','']};if(s.phase!=='self'||p.self||!(req.body.submit?validateAnswer(a,s.selectionLimits):validateDraft(a,s.selectionLimits)))return res.status(400).json({error:`確定には特徴を${s.selectionLimits.min}〜${s.selectionLimits.max}個選んでください。下書きは0〜${s.selectionLimits.max}個、理由・エピソードは各1000文字以内です。確定後の変更はできません。`});p.selfNotes=a.notes||{};if(req.body.submit)p.self=a.traits;else p.selfDraft=a.traits;if(s.people.every(p=>p.self)){s.phase='others';fillSampleAnswers(s);}save(s);res.json({ok:true});});
app.post('/api/s/:code/answer/:target',(req,res)=>{
  const s=req.session,p=req.person,target=req.params.target;
  if(s.phase!=='others'||req.body.submit||target===p.id||!s.people.some(x=>x.id===target)||p.answers[target]?.submitted||!validateDraft(req.body,s.selectionLimits))return res.status(400).json({error:`下書きを保存できません。特徴は0〜${s.selectionLimits.max}個、理由・エピソードは各1000文字以内です。全員分の確定は「回答を確定する」から行います。`});
  p.answers[target]={traits:req.body.traits,notes:req.body.notes||{},text:req.body.text,submitted:false};
  save(s);res.json({ok:true});
});
app.post('/api/s/:code/answers/submit',(req,res)=>{
  const s=req.session,p=req.person,targets=s.people.filter(x=>x.id!==p.id);
  if(s.phase!=='others'||targets.every(x=>p.answers[x.id]?.submitted))return res.status(400).json({error:'すでに確定済みか、他者評価の段階ではありません。'});
  if(!targets.every(x=>validateAnswer(p.answers[x.id],s.selectionLimits)))return res.status(400).json({error:`全員について特徴を${s.selectionLimits.min}〜${s.selectionLimits.max}個選び、保存してから確定してください。`});
  for(const target of targets)p.answers[target.id].submitted=true;
  if(s.people.every(person=>s.people.filter(x=>x.id!==person.id).every(x=>person.answers[x.id]?.submitted)))s.phase='waiting';
  save(s);res.json({ok:true});
});
app.post('/api/s/:code/publish',(req,res)=>{const s=req.session;if(!req.person.host||s.phase!=='waiting')return res.status(403).json({error:'全員の完了後にホストが公開できます。'});s.phase='results';s.completed=new Date().toISOString();for(const p of s.people){const others=s.people.filter(x=>x.id!==p.id).map(x=>x.answers[p.id]);p.result={name:p.name,session:s.name,debug:!!s.debug,date:s.completed,selectionLimits:{...s.selectionLimits},traitFeedback:traits.map(trait=>({trait,selfNote:p.selfNotes?.[trait]||'',answers:others.map(a=>a.notes?.[trait]?.trim()).filter(Boolean).sort(()=>0.5-Math.random())})).filter(f=>f.selfNote||f.answers.length),comparison:aggregate(p.self,others),feedback:questions.map((question,i)=>({question,answers:others.map(a=>a.text[i]).filter(Boolean).sort(()=>0.5-Math.random())}))};}save(s);res.json({ok:true});});
app.get('/api/s/:code/result',(req,res)=>{const s=req.session,p=req.person;if(!canReadResult(s.phase,p.id,p.id))return res.status(403).json({error:'結果はまだ公開されていません。'});res.json({...p.result,comparison:p.result.comparison.filter(t=>t.self||t.count>0),memo:p.memo});});
app.post('/api/s/:code/memo',(req,res)=>{if(req.session.phase!=='results'||!Array.isArray(req.body.memo)||req.body.memo.length!==4||!req.body.memo.every(t=>typeof t==='string'&&t.length<=3000))return res.status(400).json({error:'メモは各3000文字以内です。'});req.person.memo=req.body.memo;save(req.session);res.json({ok:true});});
io.use((socket,next)=>{const s=sessions.get(socket.handshake.auth.code),p=s?.people.find(p=>p.token===hash(socket.handshake.auth.token||''));if(!p)return next(new Error('認証エラー'));socket.sessionCode=s.code;next();});io.on('connection',socket=>socket.join(socket.sessionCode));
const assets=resolve(process.env.DIST_DIR||'dist');
app.use(express.static(assets,{etag:false,cacheControl:false}));app.get('/{*path}',(req,res)=>res.sendFile(resolve(assets,'index.html'),{cacheControl:false}));app.use((err,req,res,next)=>res.status(400).json({error:'リクエストを処理できませんでした。'}));
http.listen(port,'0.0.0.0',()=>console.log(`ジョハリの窓: http://localhost:${port}`));
