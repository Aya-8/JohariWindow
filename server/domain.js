export const traits = ['論理的','慎重','行動力がある','共感力が高い','責任感が強い','好奇心旺盛','協調的','独創的','心配性','負けず嫌い','誠実','柔軟','計画的','楽観的','粘り強い','聞き上手','話し上手','冷静','情熱的','観察力がある','決断が早い','気配りができる','自立している','几帳面','挑戦を楽しむ','ユーモアがある','率直','控えめ','集中力がある','面倒見がよい','完璧を求める','考えすぎる','遠慮しやすい','急ぎがち','人に頼るのが苦手','気分に左右されやすい','競争を楽しむ','調整が得意','探究心がある','変化を好む'];
export const questions=['この人の強みは何だと思いますか？','この人が自覚していなさそうな特徴はありますか？','この人が力を発揮しているのはどんな場面ですか？','この人が改善できそうな行動はありますか？','そう感じた具体的なエピソードはありますか？'];
// 既存の特徴を残し、対として比較できる選択肢を追加する。両方の選択も許可する。
traits.push('直感的','堅実','大胆','人に頼る','自分でやる');
export const traitGroups=[
  {label:'考え方',traits:['論理的','直感的']},
  {label:'進め方',traits:['計画的','柔軟']},
  {label:'取り組み方',traits:['堅実','大胆']},
  {label:'人との関わり方',traits:['人に頼る','自分でやる']},
];
export const participantLimits={min:2,max:10};
export const defaultSelectionLimits={min:3,max:8};
export function validateSelectionLimits(limits){return !!limits&&Number.isInteger(limits.min)&&Number.isInteger(limits.max)&&limits.min>=1&&limits.max<=traits.length&&limits.min<=limits.max;}
export function aggregate(self, others){return traits.map(trait=>{const count=others.filter(a=>a.traits.includes(trait)).length;const selected=self.includes(trait),known=count>others.length/2;return {trait,self:selected,count,total:others.length,minority:count>0&&!known,category:selected?(known?'開放':'秘密'):(known?'盲点':count>0?'一部の他者が選択':'未選択')};});}
function validateEvaluation(a,min,max){return a && Array.isArray(a.traits)&&a.traits.length>=min&&a.traits.length<=max&&new Set(a.traits).size===a.traits.length&&a.traits.every(t=>traits.includes(t))&&(a.notes===undefined||(a.notes!==null&&typeof a.notes==='object'&&!Array.isArray(a.notes)&&Object.entries(a.notes).every(([trait,note])=>a.traits.includes(trait)&&typeof note==='string'&&note.length<=1000)))&&Array.isArray(a.text)&&a.text.length===5&&a.text.every(t=>typeof t==='string'&&t.length<=1000);}
export function validateDraft(a,limits=defaultSelectionLimits){return validateSelectionLimits(limits)&&validateEvaluation(a,0,limits.max);}
export function validateAnswer(a,limits=defaultSelectionLimits){return validateSelectionLimits(limits)&&validateEvaluation(a,limits.min,limits.max);}
export function canReadResult(phase,viewer,target){return phase==='results'&&viewer===target;}
