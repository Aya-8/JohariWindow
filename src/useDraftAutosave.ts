import {useEffect,useRef,useState} from 'react';
import {createDraftQueue,type SaveStatus} from './draftQueue';

export function useDraftAutosave<T>(send:(job:T)=>Promise<unknown>){
  const[status,setStatus]=useState<SaveStatus>('saved');
  const sendRef=useRef(send);
  sendRef.current=send;
  const queue=useRef<ReturnType<typeof createDraftQueue<T>>|null>(null);
  if(!queue.current)queue.current=createDraftQueue<T>(job=>sendRef.current(job),setStatus);
  const drafts=queue.current;
  useEffect(()=>{
    const retry=()=>{void drafts.flush().catch(()=>{});};
    const beforeUnload=(event:BeforeUnloadEvent)=>{
      if(drafts.hasPending()){event.preventDefault();event.returnValue='';}
    };
    const interval=setInterval(retry,15000);
    window.addEventListener('online',retry);
    window.addEventListener('beforeunload',beforeUnload);
    return()=>{
      drafts.cancelTimer();clearInterval(interval);
      window.removeEventListener('online',retry);
      window.removeEventListener('beforeunload',beforeUnload);
    };
  },[drafts]);
  return {...drafts,status};
}
