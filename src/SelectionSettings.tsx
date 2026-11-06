import React from 'react';
type Limits={min:number,max:number};
export function SelectionSettings({limits,onChange,onSave,traitCount,busy,dirty}:{limits:Limits,onChange:(limits:Limits)=>void,onSave:()=>void,traitCount:number,busy:boolean,dirty:boolean}){
  const valid=Number.isInteger(limits.min)&&Number.isInteger(limits.max)&&limits.min>=1&&limits.max<=traitCount&&limits.min<=limits.max;
  const options=Array.from({length:traitCount},(_,i)=><option key={i+1} value={i+1}>{i+1}個</option>);
  return <fieldset className="selection-settings" disabled={busy}>
    <legend>特徴の選択数</legend>
    <div className="selection-settings-fields">
      <label>最低選択数<select value={limits.min} onChange={e=>onChange({...limits,min:Number(e.target.value)})}>{options}</select></label>
      <label>最大選択数<select value={limits.max} onChange={e=>onChange({...limits,max:Number(e.target.value)})}>{options}</select></label>
    </div>
    <p className="muted">自己評価・他者評価に共通です。同じ数にすると、選ぶ個数を固定できます。開始後は変更できません。</p>
    {!valid&&<p role="alert">最低選択数は最大選択数以下にしてください。</p>}
    <button type="button" className="secondary" disabled={!valid||!dirty||busy} onClick={onSave}>選択数の設定を保存</button>
    <p className="muted" role="status">{dirty?'変更があります。保存するか、この設定で開始してください。':'この設定が参加者に共有されています。'}</p>
  </fieldset>;
}
