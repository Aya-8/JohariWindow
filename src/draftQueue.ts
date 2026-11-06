export type SaveStatus='saved'|'dirty'|'saving'|'error';

// Serialize writes so that an older response can never overwrite newer edits.
export function createDraftQueue<T>(send:(job:T)=>Promise<unknown>,onStatus:(status:SaveStatus)=>void,delay=500){
  let pending:T|null=null;
  let flight:Promise<void>|null=null;
  let timer:ReturnType<typeof setTimeout>|undefined;
  function cancelTimer(){clearTimeout(timer);}
  async function flush():Promise<void>{
    cancelTimer();
    if(flight){await flight;return flush();}
    if(pending===null)return;
    const job=pending;
    onStatus('saving');
    const request=Promise.resolve().then(()=>send(job)).then(()=>{
      if(pending===job)pending=null;
      onStatus(pending===null?'saved':'dirty');
    },error=>{onStatus(pending===null?'saved':'error');throw error;});
    flight=request;
    try{await request;}finally{flight=null;}
    if(pending!==null)await flush();
  }
  return {
    update(job:T){
      pending=job;onStatus('dirty');cancelTimer();
      timer=setTimeout(()=>{void flush().catch(()=>{});},delay);
    },
    flush,
    hasPending:()=>pending!==null||flight!==null,
    discard(){pending=null;cancelTimer();onStatus('saved');},
    cancelTimer,
  };
}
