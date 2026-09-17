import pl from '../data/translations/pl.json';
import en from '../data/translations/en.json';

type Dict = Record<string,string>;
const langs:Record<string,Dict> = { pl, en };
let current = 'pl';

export const Localization = {
  get lang(){ return current; },
  setLang(l:string){ if(langs[l]) current=l; },
  t(key:string, fallback?:string):string{
    return langs[current]?.[key] ?? langs['pl']?.[key] ?? fallback ?? key;
  },
  all(){ return langs[current]; }
};
