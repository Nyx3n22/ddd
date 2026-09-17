import { gameState } from './GameState';
export class SaveSystem {
  static save(slot='autosave'){
    const data = gameState.serialize();
    localStorage.setItem(`elenem_save_${slot}`, data);
    localStorage.setItem('elenem_last_save', new Date().toISOString());
    return true;
  }
  static load(slot='autosave'){
    const data = localStorage.getItem(`elenem_save_${slot}`);
    if(!data) return false;
    gameState.deserialize(data);
    return true;
  }
  static hasSave(slot='autosave'){ return !!localStorage.getItem(`elenem_save_${slot}`); }
  static listSlots(){
    const slots:string[] = [];
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k?.startsWith('elenem_save_')) slots.push(k.replace('elenem_save_','')); }
    return slots;
  }
}
