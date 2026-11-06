import React from 'react';
type TraitGroup={label:string,traits:string[]};
export function TraitPicker({traits,groups,selection,onChoose,disabled,limits={min:3,max:8}}:{traits:string[],groups:TraitGroup[],selection:string[],onChoose:(trait:string)=>void,disabled:boolean,limits?:{min:number,max:number}}){
  const paired=groups.flatMap(group=>group.traits);
  const others=traits.filter(trait=>!paired.includes(trait));
  const option=(trait:string)=><button type="button" aria-pressed={selection.includes(trait)} disabled={disabled||(!selection.includes(trait)&&selection.length>=limits.max)} className="trait-option" key={trait} onClick={()=>onChoose(trait)}>{trait}</button>;
  return <div className="trait-picker"><div className="count-row"><span>全{traits.length}項目から{limits.min===limits.max?`${limits.min}個`:`${limits.min}〜${limits.max}個`}選んでください</span><output aria-live="polite" aria-label="選択した特徴の数">{selection.length} / {limits.max}</output></div><p className="muted pair-note">各組で両方選ぶことも、どちらも選ばないこともできます。</p>{groups.map(group=><fieldset className="trait-pair" key={group.label} aria-label={group.label}><div className="traits">{group.traits.map(option)}</div></fieldset>)}<div className="traits" id="other-traits">{others.map(option)}</div><p className="muted selection-hint">{selection.length>=limits.max?`${limits.max}個選択中です。入れ替えるときは、選択をひとつ外してください。`:'いくつもの一面が、あなたの中にあっても大丈夫です。'}</p></div>;
}
