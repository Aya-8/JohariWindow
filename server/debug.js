import {randomBytes} from 'node:crypto';
import {traits,defaultSelectionLimits} from './domain.js';

function fitSelection(preferred,limits){
  const selected=[...new Set(preferred.filter(t=>traits.includes(t)))].slice(0,limits.max);
  for(const trait of traits){if(selected.length>=limits.min)break;if(!selected.includes(trait))selected.push(trait);}
  return selected;
}
export function prepareSamples(session){
  if(session.debug)for(const person of session.people.filter(p=>p.sample))person.self=fitSelection(person.self,session.selectionLimits||defaultSelectionLimits);
}

export function createSamples(){
  return ['サンプル参加者A','サンプル参加者B'].map((name,i)=>({
    id:randomBytes(8).toString('hex'),name,host:false,sample:true,token:null,
    self:i===0?['論理的','慎重','責任感が強い']:['共感力が高い','好奇心旺盛','協調的'],
    answers:{},memo:['','','','']
  }));
}

export function fillSampleAnswers(session){
  if(!session.debug)return;
  session.people.filter(p=>p.sample).forEach((person,i)=>{
    for(const target of session.people.filter(p=>p.id!==person.id)){
      const unseen=traits.filter(t=>!target.self.includes(t)).slice(0,2);
      const selected=fitSelection([target.self[0],...(i===0?[target.self[1]]:[]),...unseen],session.selectionLimits||defaultSelectionLimits);
      person.answers[target.id]={
        traits:selected,
        notes:{[selected[0]]:i===0?'【サンプル】話し合いで考えを整理してくれた場面が印象に残っています。':'【サンプル】一緒に準備を進めたときに、この特徴を感じました。'},
        text:['【サンプル】周りの人と協力して物事を進めるところです。','','【サンプル】みんなで計画を立てる場面です。','',''],
        submitted:true
      };
    }
  });
}
