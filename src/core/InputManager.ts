export type Action = 'forward'|'back'|'left'|'right'|'jump'|'crouch'|'sprint'|'interact'|'grab'|'attack'|'block'|'quickwheel'|'torch'|'perspective'|'pause'|'map'|'skills'|'compendium'|'inventory'|'journal'|'clock'|'quickmenu'|'quicksave'|'quickload';
type Binding = { key:string, action:Action };

const DEFAULT_BINDS: Binding[] = [
  {key:'KeyW',action:'forward'},
  {key:'KeyS',action:'back'},
  {key:'KeyA',action:'left'},
  {key:'KeyD',action:'right'},
  {key:'Space',action:'jump'},
  {key:'ControlLeft',action:'crouch'},
  {key:'ShiftLeft',action:'sprint'},
  {key:'KeyE',action:'interact'},
  {key:'KeyF',action:'grab'},
  {key:'Mouse0',action:'attack'},
  {key:'Mouse2',action:'block'},
  {key:'KeyQ',action:'quickwheel'},
  {key:'KeyR',action:'torch'},
  {key:'KeyC',action:'perspective'},
  {key:'Escape',action:'pause'},
  {key:'KeyM',action:'map'},
  {key:'KeyG',action:'skills'},
  {key:'KeyK',action:'compendium'},
  {key:'KeyI',action:'inventory'},
  {key:'KeyJ',action:'journal'},
  {key:'KeyT',action:'clock'},
  {key:'Tab',action:'quickmenu'},
  {key:'F5',action:'quicksave'},
  {key:'F9',action:'quickload'},
];

export class InputManager {
  private keyToAction = new Map<string,Action>();
  private actionState = new Map<Action,boolean>();
  private actionJustPressed = new Map<Action,boolean>();
  private mouseDown = new Set<number>();
  private remapMode: {action:Action}|null = null;

  constructor(){
    this.loadBinds();
    window.addEventListener('keydown', e=>{
      if(e.code==='Backquote'){ e.preventDefault(); return; }
      const act = this.keyToAction.get(e.code);
      if(act){
        if(!this.actionState.get(act)) this.actionJustPressed.set(act,true);
        this.actionState.set(act,true);
      }
      // prevent tab focus change
      if(e.code==='Tab') e.preventDefault();
    });
    window.addEventListener('keyup', e=>{
      const act = this.keyToAction.get(e.code);
      if(act) this.actionState.set(act,false);
    });
    window.addEventListener('mousedown', e=>{
      const code = `Mouse${e.button}`;
      const act = this.keyToAction.get(code);
      if(act){
        if(!this.actionState.get(act)) this.actionJustPressed.set(act,true);
        this.actionState.set(act,true);
      }
      this.mouseDown.add(e.button);
    });
    window.addEventListener('mouseup', e=>{
      const code = `Mouse${e.button}`;
      const act = this.keyToAction.get(code);
      if(act) this.actionState.set(act,false);
      this.mouseDown.delete(e.button);
    });
  }

  private loadBinds(){
    const stored = localStorage.getItem('elenem_keybinds');
    const binds:Binding[] = stored ? JSON.parse(stored) : DEFAULT_BINDS;
    this.keyToAction.clear();
    binds.forEach(b=>this.keyToAction.set(b.key,b.action));
  }
  saveBinds(){
    const arr:Binding[] = [];
    this.keyToAction.forEach((action,key)=>arr.push({key,action}));
    localStorage.setItem('elenem_keybinds', JSON.stringify(arr));
  }
  getBinds():Binding[]{
    const arr:Binding[] = [];
    this.keyToAction.forEach((action,key)=>arr.push({key,action}));
    return arr;
  }
  remap(action:Action, newKey:string){
    // remove old mapping for this action
    for(const [k,a] of this.keyToAction.entries()) if(a===action) this.keyToAction.delete(k);
    this.keyToAction.set(newKey,action);
    this.saveBinds();
  }
  reset(){ localStorage.removeItem('elenem_keybinds'); this.loadBinds(); }

  isDown(action:Action){ return !!this.actionState.get(action); }
  justPressed(action:Action){ const v = !!this.actionJustPressed.get(action); if(v) this.actionJustPressed.set(action,false); return v; }
  consume(action:Action){ this.actionJustPressed.set(action,false); this.actionState.set(action,false); }

  update(){ /* clear one-frame flags after consumption via justPressed */ }
}
