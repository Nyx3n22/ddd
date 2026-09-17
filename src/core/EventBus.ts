type Listener = (payload:any)=>void;
export class EventBus {
  private listeners = new Map<string, Set<Listener>>();
  on(event:string, fn:Listener){ if(!this.listeners.has(event)) this.listeners.set(event,new Set()); this.listeners.get(event)!.add(fn); return ()=>this.off(event,fn); }
  off(event:string, fn:Listener){ this.listeners.get(event)?.delete(fn); }
  emit(event:string, payload?:any){
    const set = this.listeners.get(event);
    if(set) for(const fn of set) try{ fn(payload); }catch(e){ console.error('EventBus error',event,e); }
    const wild = this.listeners.get('*');
    if(wild) for(const fn of wild) try{ fn({event,payload}); }catch{}
  }
  clear(){ this.listeners.clear(); }
}
export const eventBus = new EventBus();
