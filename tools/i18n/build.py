#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Buduje src/data/locales/{pl,en}.json z par klucz|PL|EN."""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'src/data/locales')

PL = {}
EN = {}

def add(block):
    for line in block.strip('\n').split('\n'):
        line = line.rstrip()
        if not line or line.startswith('#'):
            continue
        parts = line.split('|')
        if len(parts) != 3:
            print('ZŁA LINIA:', line[:120]); sys.exit(1)
        k, pl, en = parts
        PL[k.strip()] = pl.strip()
        EN[k.strip()] = en.strip()

# ===========================================================================
# 1. INTERFEJS I SYSTEMY
# ===========================================================================
add(r"""
common.crowns|koron|crowns
player.name|John|John
error.hint|Odśwież stronę (F5) i zajrzyj do konsoli (`) — błąd został zapisany w logu przeglądarki.|Reload the page (F5) and open the console (`) — the error was logged in the browser console.
boot:done|uruchomiono|booted
hud.day|Dzień {day}|Day {day}
hud.days|dni|days
hud.debt|Dług|Debt
hud.crowns|koron|crowns
hud.purse|Trzos|Purse
hud.weather|Pogoda|Weather
vital.hp|Zdrowie|Health
vital.st|Wytrzym.|Stamina
vital.hu|Głód|Hunger
vital.th|Pragnienie|Thirst
vital.fa|Wypoczynek|Rest
vital.hy|Czystość|Cleanliness
phase.night|noc|night
phase.dawn|świt|dawn
phase.morning|przedpołudnie|morning
phase.noon|południe|noon
phase.afternoon|popołudnie|afternoon
phase.dusk|zmierzch|dusk
phase.evening|wieczór|evening
weather.clear|pogodnie|clear
weather.cloudy|pochmurno|cloudy
weather.rain|deszcz|rain
weather.storm|burza|storm
weather.fog|mgła|fog
weather.snow|śnieg|snow
weather.heat|upał|heat
weather.changed|Pogoda się zmienia: {what}.|The weather turns: {what}.
weather.plagueStart|Dzwony biją inaczej. W mieście jest zaraza.|The bells sound different. There is plague in the town.
weather.plagueEnd|Zaraza ustępuje. Ulice znów pełne ludzi.|The plague recedes. The streets fill with people again.
day.changed|Dzień {day}. Zostało {left} dni na spłatę.|Day {day}. {left} days left to repay.
prompt.use|{what}|{what}
prompt.enter|wejdź: {what}|enter: {what}
prompt.door|drzwi: {what}|door: {what}
prompt.gate|brama: {what}|gate: {what}
prompt.station|{what}|{what}
prompt.talk|porozmawiaj z {who}|talk to {who}
prompt.carry|przestaw: {what}|move: {what}
carry.pickedUp|Chwytasz: {what}. Idziesz wolniej.|You take hold of: {what}. You walk slower.
carry.putDown|Odkładasz ciężar.|You set the burden down.
carry.cant|Nie da się tego chwycić.|You cannot get a grip on this.
carry.tooHurt|Jesteś zbyt poraniony, żeby to dźwignąć.|You are too injured to lift this.
belt.empty|Przy pasie nie masz nic użytecznego.|Nothing useful hangs at your belt.
belt.hint|Wybierz kierunkiem, zatwierdź E|Aim to choose, confirm with E
camera.zoom|Widok: {z}×|View: {z}×
diegetic.noNotebook|Nie masz notatnika. K uparcie robi nic.|You have no notebook. K stubbornly does nothing.
diegetic.noMap|Nie masz żadnej mapy. Widzisz tylko to, co pod nogami.|You have no map. You see only what is under your feet.
msg.ate|Zjadasz: {what}.|You eat: {what}.
msg.drank|Wypijasz: {what}.|You drink: {what}.
msg.poisonedFood|Coś było nie tak z tym jedzeniem. Żołądek buntuje się.|Something was wrong with that food. Your stomach rebels.
msg.usedMedicine|Używasz lekarstwa.|You use the medicine.
msg.warmed|Robi ci się cieplej.|You feel warmer.
msg.torchOn|Zapalasz pochodnię.|You light the torch.
msg.torchOff|Gasisz pochodnię.|You douse the torch.
msg.torchOut|Pochodnia dopaliła się.|The torch has burned out.
msg.noFlint|Nie masz krzesiwa. Bez ognia pochodnia to tylko kij.|You have no flint. Without fire a torch is only a stick.
msg.sober|Trunki wietrzeją z głowy. Głowa boli.|The drink clears from your head. Your head aches.
msg.cantUse|Nie bardzo wiadomo, co zrobić z: {what}.|There is no obvious use for: {what}.
msg.skillUp|{skill} — poziom {level}|{skill} — level {level}
interact.nothing|Nie ma tu nic do roboty.|Nothing to do here.
interact.hostile|{what} nie ma ochoty na rozmowę.|{what} is not in the mood to talk.
interact.locked|{what} jest zamknięte.|{what} is locked.
interact.lockpick|Wyłamać zamek: {what}?|Force the lock: {what}?
interact.unlocked|Zamek ustępuje.|The lock gives way.
interact.lockpickBroke|Wytrych pęka w zamku. Ktoś to usłyszał.|The pick snaps in the lock. Someone heard that.
interact.needPass|Strażnik żąda przepustki ({what}).|The guard demands a pass ({what}).
interact.gateOpen|Brama jest otwarta.|The gate stands open.
interact.gateOpened|Brama otwiera się ze zgrzytem.|The gate grinds open.
interact.gateClosedHours|Brama zamknięta do {from}:00 (otwarta {from}–{to}).|The gate is shut until {from}:00 (open {from}–{to}).
interact.nobody|Nikogo tu nie ma. Kram jest zamknięty.|Nobody is here. The stall is closed.
interact.cantEnter|Nie da się tam wejść.|You cannot get in there.
interact.empty|Pusto. Ktoś był tu przed tobą.|Empty. Someone got here first.
interact.found|Znajdujesz: {what}.|You find: {what}.
interact.searchSeen|{who} patrzy, jak grzebiesz w cudzych rzeczach.|{who} watches you rummage through other people's things.
interact.gathered|Zbierasz: {what}.|You gather: {what}.
interact.alreadyGathered|Tu już nic nie zostało.|Nothing is left here.
interact.drank|Pijesz wodę. Smakuje rzeką.|You drink the water. It tastes of the river.
interact.filledSkin|Napełniasz bukłak.|You fill the waterskin.
interact.warmed|Grzejesz się przy ogniu.|You warm yourself at the fire.
interact.gallows|Szubienica. Deski ciemne od deszczu i od rzeczy gorszych niż deszcz.|The gallows. Boards darkened by rain and by things worse than rain.
interact.stocks|Dyby. Deska wypolerowana głowami tych, którzy się spóźnili z długiem.|The stocks. A plank polished by the heads of those who were late with a debt.
inv.title|Sakwa|Satchel
inv.hintKey|Sakwa — klawisz {key}. Rzeczy przy pasie: Q.|Satchel — key {key}. Belt items: Q.
inv.hint|Najedź na przedmiot, żeby przeczytać opis Johna.|Hover an item to read John's description.
inv.weight|Ciężar|Weight
inv.volume|Objętość|Volume
inv.over|— za ciężko, idziesz wolniej|— overloaded, you walk slower
inv.empty|pusto|empty
inv.value|Wartość|Value
inv.dmg|Obrażenia {d}|Damage {d}
inv.dmgFull|Obrażenia|Damage
inv.reach|Zasięg {r}|Reach {r}
inv.mit|Redukcja {m}%|Mitigation {m}%
inv.mitFull|Redukcja obrażeń|Damage mitigation
inv.use|Użyj / załóż|Use / equip
inv.unequip|Zdejmij|Unequip
inv.sort|Uporządkuj|Sort
inv.drop|Upuść|Drop
inv.full|Nie mieści się: {what}. Plecak ma swoją objętość.|No room for: {what}. A pack has a volume.
inv.slot.weapon|Broń|Weapon
inv.slot.offhand|Druga ręka|Off-hand
inv.slot.body|Tułów|Body
inv.slot.head|Głowa|Head
journal.debt|Dług Johna|John's debt
journal.principal|Kwota początkowa|Principal
journal.paid|Spłacono|Paid
journal.remaining|Pozostało|Remaining
journal.due|Termin|Due
journal.day|dzień {day}|day {day}
journal.daysLeft|Dni do terminu|Days until due
journal.loans|Pożyczki prywatne|Private loans
journal.favorOwed|Jesteś winien Baldwinowi przysługę. Nie wiesz jaką.|You owe Baldwin a favour. You do not know which.
journal.payWhere|Płaci się Gwidonowi przy bramie celnej albo Baldwinowi osobiście.|You pay Gwidon at the customs gate, or Baldwin in person.
journal.active|Zadania w toku|Ongoing tasks
journal.done|Zakończone|Completed
journal.failed|Nieudane|Failed
journal.noneActive|Nie masz nic zapisanego. Bez notatnika trudno cokolwiek spamiętać.|You have nothing written down. Without a notebook little can be remembered.
journal.noneDone|Jeszcze nic nie doprowadziłeś do końca.|You have seen nothing through to the end yet.
journal.reputation|Jak cię widzą|How they see you
journal.noNotebook|Nie masz notatnika — pamiętasz tylko długi, bo te pamięta się same.|You have no notebook — you remember only the debts, because those remember themselves.
notes.hintKey|Notatnik — klawisz {key}. Bez niego te strony nie istnieją.|Notebook — key {key}. Without it these pages do not exist.
notes.tab.bestiary|Przyroda i ludzie|Nature and people
notes.tab.items|Przedmioty|Things
notes.tab.places|Miejsca|Places
notes.tab.john|Zapiski Johna|John's notes
notes.tab.custom|Własne wpisy|Your entries
notes.placeholder|Zapisz coś… (potrzebne pióro i atrament)|Write something… (quill and ink required)
notes.write|Zapisz|Write
notes.written|Wpis dodany.|Entry added.
notes.added|Zapisujesz w notatniku: {what}.|You write in the notebook: {what}.
notes.noNotebook|Nie masz notatnika. Kup go u skryby Urbana.|You have no notebook. Buy one from Urban the scribe.
notes.noQuill|Bez pióra i atramentu nic nie zapiszesz.|Without quill and ink you can write nothing.
notes.wet|Notatnik jest przemoczony ({pct}%). Część wpisów się rozmyła.|The notebook is soaked ({pct}%). Some entries have run.
notes.blurred|{count} wpisów rozmyło się od wody.|{count} entries were blurred by water.
notes.blurredEntry|…rozmyty atrament, nie do odczytania…|…blurred ink, impossible to read…
notes.lost|Tracisz notatnik ({reason}).|You lose the notebook ({reason}).
notes.reason.stolen|skradziony|stolen
notes.reason.burned|spalony|burned
notes.reason.lost|zgubiony|lost
notes.empty.bestiary|Nic jeszcze nie wpisałeś. Patrz, słuchaj i zapisuj.|Nothing written yet. Look, listen, and write it down.
notes.empty.items|Nie opisałeś jeszcze żadnego przedmiotu.|You have described no item yet.
notes.empty.places|Nie opisałeś jeszcze żadnego miejsca.|You have described no place yet.
notes.empty.john|John niczego nie zapisał o sobie.|John has written nothing about himself.
notes.empty.custom|Strony są puste.|The pages are blank.
notes.hint|Zapisałeś w myślach, ale nie na papierze.|You noted it in your head, but not on paper.
notes.hint.bestiary|Wpisy pojawiają się, gdy John coś zobaczy, zabije, usłyszy albo zapyta kogoś, kto wie.|Entries appear when John sees, kills, hears, or asks someone who knows.
notes.danger|niebezpieczeństwo {d}/5|danger {d}/5
notes.loot|Można z tego mieć|Yields
skills.hintKey|Karta wprawy w notatniku — klawisz {key}.|The skill page in the notebook — key {key}.
skills.intro|Umiejętności rosną z użycia, nie z punktów.|Skills grow from use, not from points.
skills.teacherRule|Perka nauczy cię tylko żywy człowiek. Trzeba do niego pójść, zapłacić i spędzić dni na nauce.|Only a living person can teach you a perk. You must go to them, pay, and spend days learning.
skills.training|Trwa nauka|Training in progress
perk.requires|Wymaga: {skill} poz. {level}, nauczyciel {who}, {gold} koron, {days} dni|Requires: {skill} lvl {level}, teacher {who}, {gold} crowns, {days} days
train.started|{who} zaczyna cię uczyć: {perk}. Zajmie to {days} dni.|{who} begins teaching you: {perk}. It will take {days} days.
train.progress|Zostało {days} dni nauki.|{days} days of training remain.
train.done|Umiesz już: {perk}.|You now know: {perk}.
train.reqLevel|Za mało wprawy (potrzebny poziom {level}).|Not enough practice (level {level} needed).
train.reqGold|Nie masz {gold} koron.|You do not have {gold} crowns.
train.reqRep|Nie darzą cię tu dostatecznym zaufaniem.|They do not trust you enough here.
train.busy|Już się czegoś uczysz. Jedna głowa, jeden nauczyciel.|You are already learning something. One head, one teacher.
train.no|Nie teraz.|Not now.
map.hintKey|Zwój mapy — klawisz {key}. Mapa jest przedmiotem: można ją zgubić.|Map scroll — key {key}. The map is an object: it can be lost.
map.discovered|Zbadano {pct}% obszaru|{pct}% of the area surveyed
map.markerCount|Znaczniki: {n}/24|Markers: {n}/24
map.markHere|Zaznacz to miejsce|Mark this place
map.marked|Zaznaczono: {what}|Marked: {what}
map.markerHere|tu byłem|I was here
map.acquired|Masz teraz plan: {region}.|You now have a plan of: {region}.
map.noMap|Nie masz mapy tego obszaru.|You have no map of this area.
map.tooManyMarkers|Za dużo znaczków na jednym zwoju. Zmaż jakiś.|Too many marks on one scroll. Erase one.
map.heard|Ktoś opowiedział ci o: {what}. Rysujesz to przerywaną linią.|Someone told you about: {what}. You draw it as a dashed line.
map.heardList|Zasłyszane|Heard of
map.none|nic|nothing
map.region|Twój zwój|Your scroll
""")

# ===========================================================================
# 2. DIALOG, WARUNKI, PRZESTĘPSTWO, HAZARD, HANDEL, USŁUGI
# ===========================================================================
add(r"""
dialogue.cant|Nie teraz.|Not now.
dialogue.dead|{who} nie odpowiada. Nie żyje.|{who} does not answer. He is dead.
npc.stranger|Nieznajomy|Stranger
npc.someone|ktoś|someone
npc.passerby|Mieszkaniec|Townsfolk
npc.age|wiek {age}|age {age}
npc.greeting.neutral|Dzień dobry.|Good day.
npc.greeting.friend|Dobrze cię widzieć, John.|Good to see you, John.
npc.greeting.warm|A, to ty.|Ah, it's you.
npc.greeting.cold|Czego chcesz?|What do you want?
npc.greeting.hostile|Zejdź mi z oczu.|Get out of my sight.
npc.greeting.wanted|Straż cię szuka. Nie stój tak blisko mnie.|The guard is looking for you. Do not stand so close to me.
npc.greeting.night|O tej porze uczciwi ludzie śpią.|Honest people sleep at this hour.
npc.guardAlerted|{who} kładzie rękę na broni.|{who} puts a hand on his weapon.
npc.screamed|{who} krzyczy i ucieka w stronę rynku.|{who} screams and runs toward the market.
crime.seen|{who} widzi, jak {what}.|{who} sees you {what}.
crime.reported|Ktoś doniósł straży: {what}.|Someone told the guard: {what}.
crime.finePaid|Zapłaciłeś grzywnę ({gold} koron). Jesteś czysty — na razie.|You paid the fine ({gold} crowns). You are clean — for now.
crime.cantPay|Nie masz tyle złota ({gold} koron). Zostają dyby albo ucieczka.|You do not have that much ({gold} crowns). That leaves the stocks, or running.
crime.confiscated|Straż zabiera: {what}.|The guard confiscates: {what}.
crime.punished|Dyby i noc w lochu. Stracono {days} dni i {fee} koron.|Stocks and a night in the cellar. {days} days and {fee} crowns lost.
crime.fled|Uciekasz. Ktoś zapamięta twoją twarz.|You run. Someone will remember your face.
crime.cooled|Sprawa przyschła. Straż przestała się rozglądać za tobą.|The matter has cooled. The guard stopped looking for you.
crime.evidenceFound|Straż znalazła ślad: {what}.|The guard found a trace: {what}.
crime.pickpocketOk|Wyciągasz {gold} koron z cudzej sakiewki.|You lift {gold} crowns from someone else's purse.
crime.pickpocketCaught|{who} łapie cię za nadgarstek.|{who} catches you by the wrist.
crime.theft|kradzież|theft
crime.pickpocket|kieszonkostwo|pickpocketing
crime.murder|zabójstwo|murder
crime.assault|napaść|assault
crime.trespass|wtargnięcie|trespass
crime.smuggling|przemyt|smuggling
crime.bribery|łapówka|bribery
crime.threat|groźba|threat
crime.insult|zniewaga|insult
crime.informing|donos|informing
crime.possession|paserstwo|possession of stolen goods
crime.vandalism|zniszczenie mienia|vandalism
crime.cheating|oszustwo przy grze|cheating at a game
crime.blood|krew na bruku|blood on the cobbles
crime.body|zwłoki|a body
crime.prying|ślady wyłamywania|pry marks
gamble.title|Stół do gry|Gaming table
gamble.rules|Stawka leży na stole. Wygrywasz — bierzesz. Przegrywasz — siedzisz dalej albo wstajesz.|The stake lies on the table. Win and you take it. Lose and you sit on, or stand up.
gamble.skillLevel|Twoja wprawa w hazardzie: {lv}|Your gambling practice: {lv}
gamble.stake|Stawka|Stake
gamble.playFor|Graj o {gold}|Play for {gold}
gamble.noStake|Nie masz {gold} koron na stawkę. Słowa nie grają.|You lack {gold} crowns for a stake. Words do not play.
gamble.notWelcome|Hanna nie otwiera stołu dla obcych. Trzeba zostać przedstawionym.|Hanna does not open the table to strangers. You must be introduced.
gamble.tooEarly|Przed południem przy stole siedzi tylko kurz.|Before noon only dust sits at the table.
gamble.yourDice|Twoje kości|Your dice
gamble.rivalDice|Kości przeciwnika|Rival's dice
gamble.keepTwo|Zostaw dwie z trzech kości. Liczy się suma.|Keep two of three dice. The sum counts.
gamble.keep|Zostaw {n}|Keep {n}
gamble.peek|Podejrzyj (wprawa 2)|Peek (practice 2)
gamble.reroll|Przerzuć (wprawa 3)|Re-roll (practice 3)
gamble.cheat|Oszukaj|Cheat
gamble.reveal|Odkryj|Reveal
gamble.cantPeek|Nie umiesz jeszcze liczyć oczu przeciwnika (wprawa {level}).|You cannot yet read your rival's dice (practice {level}).
gamble.cantReroll|Przerzut wymaga wprawy {level}.|Re-rolling requires practice {level}.
gamble.caughtReroll|Ktoś zauważył, że kość zmieniła miejsce.|Someone noticed the die changed places.
gamble.caughtCheat|Kości potoczyły się inaczej, niż powinny. Stół milknie.|The dice fell wrongly. The table goes quiet.
gamble.caughtMarking|Cecylia widzi znak na karcie. Cecylia nienawidzi oszustów.|Cecylia sees the mark on the card. Cecylia hates cheats.
gamble.won|Wygrywasz {gold} koron.|You win {gold} crowns.
gamble.lost|Przegrywasz {gold} koron.|You lose {gold} crowns.
gamble.tie|Remis. Stawka wraca do ciebie.|A tie. The stake returns to you.
gamble.cards|Zagraj w karty|Play cards
gamble.broke|Przegrałeś więcej, niż miałeś. Stół zapamiętuje takich ludzi.|You lost more than you had. The table remembers such people.
gamble.searched|Ktoś przy stole patrzy na twoją sakwę zbyt długo.|Someone at the table looks at your purse too long.
trade.buy|Na sprzedaż|For sale
trade.sell|Twój towar|Your goods
trade.buyBtn|Kup|Buy
trade.sellBtn|Sprzedaj|Sell
trade.cash|Gotówka kupca: {gold} koron|Merchant's cash: {gold} crowns
trade.hint|Ceny zależą od podaży, popytu i tego, jak dobrze umiesz się targować.|Prices depend on supply, demand, and how well you bargain.
trade.hintKey|Handel z {who}. Bez rozmowy nie ma ceny.|Trading with {who}. Without talk there is no price.
trade.bought|Kupujesz: {what} za {gold} koron.|You buy: {what} for {gold} crowns.
trade.sold|Sprzedajesz: {what} za {gold} koron.|You sell: {what} for {gold} crowns.
trade.noGold|Brak {gold} koron.|You are short {gold} crowns.
trade.refuseStolen|Kupiec ogląda towar, potem ciebie. „Tego nie wezmę.”|The merchant looks at the goods, then at you. "I won't take that."
trade.closed|Czynne {from}:00–{to}:00. Kupiec też śpi.|Open {from}:00–{to}:00. Merchants sleep too.
trade.unknown|Nie ma tu nikogo, kto by handlował.|Nobody trades here.
service.used|{what} ({gold} koron).|{what} ({gold} crowns).
service.closedHours|{what} — nie o tej porze (czynne {from}:00–{to}:00).|{what} — not at this hour (open {from}:00–{to}:00).
service.needsItem|Potrzebujesz: {what}.|You need: {what}.
service.confessed|Ulga. Nie taka, jakiej się spodziewałeś, ale ulga.|Relief. Not the kind you expected, but relief.
cond.skill|{skill} — masz {have}, potrzeba {level}|{skill} — you have {have}, {level} needed
cond.gold|Trzeba {gold} koron (masz {have})|{gold} crowns needed (you have {have})
cond.noGold|Za dużo złota, żeby to przeszło|Too much gold for that to pass
cond.item|Potrzebujesz {qty}× {what}|You need {qty}× {what}
cond.noItem|Masz już {what}|You already have {what}
cond.flag|Nie wiesz jeszcze tego, co trzeba|You do not yet know what is needed
cond.noFlag|Wiesz za dużo|You know too much
cond.relation|{who} nie ufa ci aż tak ({have}/{need})|{who} does not trust you that far ({have}/{need})
cond.rep|Za niska reputacja: {faction} ({need})|Reputation too low: {faction} ({need})
cond.injured|Nie jesteś ranny|You are not wounded
cond.quest|Nie masz takiego zobowiązania|You have no such obligation
cond.questState|To już nieaktualne|That is no longer current
cond.time|Nie o tej porze|Not at this hour
cond.weather|Nie w taką pogodę|Not in this weather
cond.night|Tylko nocą|Only at night
cond.day|Tylko za dnia|Only by day
cond.wanted|Nikt cię nie szuka|Nobody is looking for you
cond.dead|Ta osoba nie żyje|That person is dead
cond.alive|Ta osoba żyje|That person is alive
cond.perk|Nie umiesz tego jeszcze|You do not know that yet
confirm.title|Decyzja|Decision
confirm.yes|Tak|Yes
confirm.no|Nie|No
sign.title|Napis|Inscription
sign.hint|Litery są wyblakłe, ale czytelne. Czytanie to też wprawa.|The letters are faded but legible. Reading is a practice too.
""")

if __name__ == '__main__':
    pass

# ===========================================================================
# 3. WALKA, POTRZEBY, RZEMIOSŁO, SEN, SKRZYNIE, TABLICA, PAUZA, USTAWIENIA
# ===========================================================================
add(r"""
combat.tired|Za mało sił. Oddech też jest bronią.|Not enough strength. Breath is a weapon too.
combat.parried|Odbijasz cios w samą porę.|You turn the blow in time.
combat.parry|Parowanie!|Parry!
combat.guardBroken|Blok pęka. Odsłaniasz się.|Your guard breaks. You are open.
combat.started|{who} rzuca się na ciebie.|{who} comes at you.
combat.noSpar|Nie ma z kim trenować.|There is nobody to train with.
combat.sparResult|Wymiany: {wins}/3 trafione. Oberwałeś za {dmg}.|Exchanges: {wins}/3 landed. You took {dmg}.
combat.killedBeast|{what} pada.|{what} goes down.
combat.killedMan|{what} nie żyje. To był człowiek, nie zwierzę.|{what} is dead. That was a man, not a beast.
body.head|głowa|head
body.torso|tułów|torso
body.armL|lewa ręka|left arm
body.armR|prawa ręka|right arm
body.legL|lewa noga|left leg
body.legR|prawa noga|right leg
injury.cut|rana cięta|a cut
injury.bruise|stłuczenie|a bruise
injury.fracture|złamanie|a fracture
injury.puncture|rana kłuta|a puncture
injury.burn|oparzenie|a burn
needs.injury|{part}: {what}.|{part}: {what}.
needs.bandaged|Opatrujesz rany. Ból cichnie.|You dress the wounds. The pain quiets.
needs.infected|Rana się jątrzy. Czerwona, ciepła, źle pachnie.|The wound festers. Red, warm, smelling wrong.
needs.infectionCured|Zakażenie ustępuje.|The infection breaks.
needs.splintNeeded|To trzeba nastawić i usztywnić. Sam nie dasz rady.|That needs setting and splinting. Not something you can do alone.
needs.boneSet|Kość nastawiona. Ból zostanie na tygodnie.|The bone is set. The pain will stay for weeks.
needs.treated|Medyk zajmuje się tobą ({gold} koron).|The medic tends to you ({gold} crowns).
needs.cured|{what} ustępuje.|{what} passes.
needs.washed|Jesteś czysty (+{amount}).|You are clean (+{amount}).
needs.slept|Śpisz {hours} godzin (jakość {quality}%).|You sleep {hours} hours (quality {quality}%).
needs.plagueStart|Gorączka, dreszcze, plamy na szyi. To nie jest zwykłe przeziębienie.|Fever, chills, spots on the neck. This is no common cold.
needs.feverStart|Bagno wzięło swoje. Trzęsiesz się mimo ciepła.|The swamp has taken its toll. You shiver despite the warmth.
needs.rotStart|Rany przy zwłokach robią się czerwone. Coś się wdało.|Handling the corpse has reddened your wounds. Something has set in.
needs.badWater|Woda była zła. Za kilka godzin będziesz tego żałował.|The water was bad. In a few hours you will regret it.
disease.plague|zaraza|plague
disease.fever|gorączka bagienna|swamp fever
disease.stomach|rozstrój żołądka|an upset stomach
disease.flux|czerwonka|flux
disease.rot|zakażenie ran|wound rot
craft.intro|Stanowisko wymaga wprawy: {skill} (poziom {level}).|The station needs practice: {skill} (level {level}).
craft.needTool|Narzędzie: {what}|Tool: {what}
craft.needFuel|Opał: {what}|Fuel: {what}
craft.takesTime|Zajmie {min} minut czasu gry.|It takes {min} minutes of game time.
craft.do|Wykonaj|Make
craft.quality|Jakość około {q}%|Quality about {q}%
craft.made|Robisz: {what} ×{qty} ({quality}).|You make: {what} ×{qty} ({quality}).
craft.repaired|Naprawiasz: {what}.|You repair: {what}.
craft.repairFailed|{what} rozpada się w rękach. Zostaje złom.|{what} falls apart in your hands. Scrap is left.
craft.reqSkill|Za mała wprawa: {skill} {have}/{level}.|Not enough practice: {skill} {have}/{level}.
craft.reqTool|Brak narzędzia: {what}.|Missing tool: {what}.
craft.reqFuel|Brak opału: {what}.|Missing fuel: {what}.
craft.reqMaterial|Brak materiału: {what} ×{qty} (masz {have}).|Missing material: {what} ×{qty} (you have {have}).
craft.tired|Za mało sił na machanie młotem.|Too little strength left to swing a hammer.
craft.exhausted|Nie utrzymasz narzędzia prosto. Śpij.|You cannot hold a tool steady. Sleep.
craft.noStation|Nie ma tu stanowiska pracy.|There is no workstation here.
craft.unknown|Nie znasz takiego przepisu.|You know no such recipe.
craft.qFine|doskonała|fine
craft.qGood|dobra|good
craft.qPoor| licha|poor
craft.qShoddy|byle jaka|shoddy
craft.forgeLocked|Orlik nie wpuści cię do kowadła, dopóki nie dasz mu węgla.|Orlik will not let you near the anvil until you bring him coal.
sleep.title|Sen|Sleep
sleep.where|Legowisko|A place to lie down
sleep.cost|Koszt|Cost
sleep.fatigue|Zmęczenie: {f}%|Fatigue: {f}%
sleep.tillDawn|Śpij do świtu (6:00)|Sleep until dawn (6:00)
sleep.tillNoon|Śpij do południa (12:00)|Sleep until noon (12:00)
sleep.nap|Przyśnij dwie godziny|Nap for two hours
sleep.warning|Sen w miejscu publicznym bywa drogi: ktoś może przeszukać ci kieszenie.|Sleeping in a public place can be costly: someone may go through your pockets.
sleep.robbed|Obudziłeś się lżejszy o {gold} koron.|You woke lighter by {gold} crowns.
chest.title|Skrzynia|Chest
chest.contents|Zawartość|Contents
chest.empty|Pusto.|Empty.
board.title|Tablica ogłoszeń|Notice board
board.take|Weź zlecenie ({gold} koron)|Take the contract ({gold} crowns)
board.empty|Tablica jest pusta. Nikt nic nie chce powierzyć obcemu.|The board is empty. Nobody wants to trust a stranger.
pause.title|Pauza|Pause
pause.hint|Jedyne menu, które nie ma odpowiednika w świecie. ESC wraca do gry.|The only menu with no counterpart in the world. ESC returns to the game.
pause.status|Stan Johna|John's condition
pause.place|Jesteś w|You are in
pause.injuries|Rany|Injuries
pause.illness|Choroby|Illnesses
pause.wanted|Poszukiwany|Wanted
pause.tab.resume|Wróć do gry|Return to game
pause.tab.save|Zapis|Save
pause.tab.settings|Ustawienia|Settings
pause.tab.controls|Sterowanie|Controls
pause.tab.stats|Statystyki|Statistics
pause.tab.about|O grze|About
controls.diegetic|K, G, M i J działają tylko wtedy, gdy John ma odpowiedni przedmiot. Handel, rzemiosło, hazard, leczenie i nauka nie mają klawiszy — trzeba podejść do człowieka albo stanowiska i nacisnąć E.|K, G, M and J work only when John owns the item. Trade, craft, gambling, healing and learning have no hotkeys — walk up to a person or a station and press E.
set.lang|Język|Language
set.uiScale|Wielkość interfejsu|UI scale
set.masterVolume|Głośność ogólna|Master volume
set.musicVolume|Muzyka|Music
set.sfxVolume|Efekty|Effects
set.ambientVolume|Otoczenie|Ambience
set.subtitleBg|Tło napisów|Subtitle background
set.subtitleSize|Rozmiar napisów|Subtitle size
set.colorblind|Tryb dla daltonistów|Colour-blind mode
set.noFlash|Bez błysków (burza, krytyki)|No flashing (storms, crits)
set.noShake|Bez trzęsienia kamery|No camera shake
set.sneakMode|Skradanie|Sneaking
set.runMode|Bieg|Running
set.hold|trzymaj|hold
set.toggle|przełącz|toggle
set.visionCones|Pokaż pole widzenia NPC|Show NPC vision cones
set.questMarkers|Znaczniki celów (ułatwienie)|Quest markers (accessibility)
set.combat|Trudność walki|Combat difficulty
set.economy|Trudność ekonomii|Economy difficulty
set.law|Surowość prawa|Harshness of the law
set.hardcore|Hardcore: jeden zapis, śmierć kończy grę|Hardcore: one save, death ends the game
set.showFps|Pokaż FPS i siatkę kafelków|Show FPS and tile grid
set.note|Ustawienia zapisują się osobno dla każdego profilu przeglądarki.|Settings are stored separately from the save, per browser profile.
diff.easy|Łatwa|Easy
diff.normal|Normalna|Normal
diff.brutal|Brutalna|Brutal
save.written|Zapisano w slocie: {slot}.|Saved to slot: {slot}.
save.loaded|Wczytano slot: {slot}.|Loaded slot: {slot}.
save.missing|W tym slocie nic nie ma.|That slot is empty.
save.corrupt|Zapis jest uszkodzony.|The save is corrupt.
save.error|Nie udało się zapisać (brak miejsca w przeglądarce?).|Could not save (browser storage full?).
save.slots|Sloty|Slots
save.none|Brak zapisów.|No saves.
save.load|Wczytaj|Load
save.writeTo|Zapisz w slocie {slot}|Save to slot {slot}
save.slot.quick|Szybki zapis|Quicksave
save.slot.auto|Autozapis|Autosave
save.slot.1|Slot 1|Slot 1
save.slot.2|Slot 2|Slot 2
save.slot.3|Slot 3|Slot 3
save.debt|dług {d}|debt {d}
save.erased|Skasowano slot {slot}.|Slot {slot} erased.
save.hardcoreBlocked|W trybie hardcore nie ma ręcznych zapisów.|In hardcore there are no manual saves.
title.newGame|Nowa gra — dzień pierwszy|New game — day one
title.continue|Kontynuuj|Continue
title.newGameHardcore|Nowa gra: hardcore (jedno życie)|New game: hardcore (one life)
title.settings|Ustawienia|Settings
title.about|O grze|About
title.fine|ELENEM v2.0 — pionowy plaster. Wyspa Elenem, rok 1430. John ma trzydzieści dni i dziesięć tysięcy koron długu. Wszystko, co widzisz, ma swoje uzasadnienie w świecie: menu jest przedmiotem, umiejętność ma nauczyciela, a każda liczba daje się opisać zdaniem.|ELENEM v2.0 — vertical slice. The island of Elenem, year 1430. John has thirty days and ten thousand crowns of debt. Everything you see is justified in-world: a menu is an object, a skill has a teacher, and every number can be described in a sentence.
prolog.arrival|Statek odbija od burty. Zostajesz na kei z jednym mieczem i długiem.|The ship pushes off. You are left on the pier with one sword and a debt.
prolog.debt|Dziesięć tysięcy koron, trzydzieści dni. Od dziś każdy dzień ma cenę.|Ten thousand crowns, thirty days. From today every day has a price.
time.approx|Jest około {hour}:00 — tak ci się wydaje z słońca.|It is about {hour}:00 — as far as the sun tells you.
time.exact|Jest {hour}:00. Zegarek nie kłamie.|It is {hour}:00. The watch does not lie.
time.knownAnswer|Dzwon bił na {hour}:00.|The bell rang {hour}:00.
time.unknownAnswer|Nie wiem. Nie mam zegarka, a dzwon bił dawno.|I do not know. I have no watch, and the bell rang long ago.
time.cantTellNight|W nocy, we wnętrzu, bez zegarka — nie sposób powiedzieć.|At night, indoors, without a watch — impossible to tell.
time.bell|Dzwon bije {hour}:00.|The bell tolls {hour}:00.
time.jail|Tracisz {minutes} minut w lochu.|You lose {minutes} minutes in the cellar.
stat.daysPlayed|Dni|Days
stat.earned|Zarobiono|Earned
stat.spent|Wydano|Spent
stat.killed|Zabici|Killed
stat.crafted|Wykonane|Crafted
stat.gambled|Rozdania|Hands played
stat.gambledWon|Wygrane|Hands won
stat.crimesCommitted|Przestępstwa|Crimes
stat.arrests|Aresztowania|Arrests
stat.questsDone|Zadania|Tasks done
stat.walked|Przeszłe (px)|Distance (px)
stat.notesWritten|Wpisy|Entries written
stat.sleepes|—|—
stat.sleeps|Noce przespane|Nights slept
stat.parries|Parowania|Parries
stat.dodges|Uniki|Dodges
stat.endings|Jak cię zapamiętają|How they will remember you
ending.title|Koniec|The end
ending.summary|Podsumowanie|Summary
ending.reputation|Reputacje|Reputations
ending.toTitle|Do menu głównego|To the main menu
ending.continue|Graj dalej|Keep playing
ending.hardcore|W trybie hardcore śmierć jest końcem. Zapis został zamknięty.|In hardcore, death is the end. The save has been closed.
eco.event|Rynek reaguje: {what}.|The market reacts: {what}.
eco.ship|statek wszedł do portu — towar tańszy|a ship has come in — goods are cheaper
eco.harvest|zbiory — chleb i ziarno tanieją|the harvest — bread and grain fall in price
eco.drought|susza — młynarz podnosi ceny|drought — the miller raises prices
eco.war|plotki o wojnie — żelazo drożeje|rumours of war — iron grows dearer
eco.plague|zaraza — lekarstwa i płótno idą w górę|plague — medicines and linen climb
rep.none|nikt|nobody
rep.summary|Przychylni: {friends}. Wrodzy: {enemies}.|Favourable: {friends}. Hostile: {enemies}.
rep.toast|{faction} {amount} ({reason})|{faction} {amount} ({reason})
rep.hero|bohater|hero
rep.ally|sojusznik|ally
rep.friendly|przychylni|friendly
rep.neutral|obojętni|indifferent
rep.disliked|nielubiany|disliked
rep.hostile|wrodzy|hostile
rep.enemy|wróg|enemy
rep.reason.dialogue|rozmowa|talk
rep.reason.quest|zadanie|a task
rep.reason.murder|morderstwo|murder
rep.reason.killed|zabójstwo|killing
rep.reason.knightKilled|zabity rycerz|a slain knight
rep.reason.paid|spłata|a payment
rep.reason.debtCleared|spłacony dług|the debt cleared
rep.reason.deadline|niedotrzymany termin|the deadline missed
rep.reason.unpaid|nieoddana pożyczka|an unpaid loan
rep.reason.alms|jałmużna|alms
rep.reason.fled|ucieczka przed strażą|flight from the guard
rep.reason.punished|publiczna kara|public punishment
rep.reason.winner|wygrane w hazardzie|gambling winnings
rep.reason.cheater|oszustwo przy stole|cheating at the table
rep.reason.rumor|plotka|rumour
world.wolvesNight|Nocą z bagien schodzą wilki.|At night the wolves come down from the marshes.
""")

# ===========================================================================
# 4. PRZEDMIOTY
# ===========================================================================
add(r"""
item.crown|Korona|Crown
item.crown.desc|Srebrna moneta z wyblakłym profilem króla. Jedyna rzecz na wyspie, której wszyscy chcą.|A silver coin with a king's worn profile. The one thing on the island everyone wants.
item.swordIron|Miecz żelazny|Iron sword
item.swordIron.desc|Prosty, dobrze wyważony miecz. Tnie kolczugę wolniej niż skórę, ale tnie.|A plain, well-balanced sword. It cuts mail slower than leather, but it cuts.
item.swordRusted|Miecz zardzewiały|Rusted sword
item.swordRusted.desc|Twój miecz z kontynentu. Ostrze w zębach rdzy, rękojeść pamięta cudzą dłoń. Da się naostrzyć.|Your sword from the continent. The edge is toothed with rust, the grip remembers another hand. It can be sharpened.
item.axeWood|Topór ciesielski|Carpenter's axe
item.axeWood.desc|Narzędzie, które bywa bronią. Ciężkie, wolne, ale łamie kości i deski równie chętnie.|A tool that doubles as a weapon. Heavy, slow, but it splits bone and board with equal enthusiasm.
item.axeWar|Topór bojowy|War axe
item.axeWar.desc|Szeroki klin na długim stylisku. Nie do parowania — do kończenia.|A broad wedge on a long haft. Not for parrying — for finishing.
item.hammerSmith|Młot kowalski|Smith's hammer
item.hammerSmith.desc|Trzy funty żelaza na dębowym trzonku. Orlik mówi, że to narzędzie. Ty wiesz, że też broń.|Three pounds of iron on an oak haft. Orlik calls it a tool. You know it is also a weapon.
item.dagger|Sztylet|Dagger
item.dagger.desc|Krótki, szybki, łatwy do ukrycia pod płaszczem. Dobra rzecz w zaułku, zła w polu.|Short, quick, easy to hide under a cloak. Good in an alley, poor in a field.
item.bow|Łuk myśliwski|Hunting bow
item.bow.desc|Cisowy łuk i dwadzieścia kroków zasięgu. W mieście strzała jest dowodem, nie tylko pociskiem.|A yew bow with twenty paces of reach. In town an arrow is evidence, not just a projectile.
item.crossbow|Kusza lekka|Light crossbow
item.crossbow.desc|Broń, której nie wolno nosić mieszczaninowi. Celna, powolna, bardzo nielegalna.|A weapon no burgher may carry. Accurate, slow, very illegal.
item.spear|Włócznia strażnicza|Watch spear
item.spear.desc|Długi drzewce, wąski grot. Trzyma ludzi na dystans, dopóki ktoś nie wejdzie pod nią.|A long shaft, a narrow head. It keeps people away until somebody steps inside it.
item.arrow|Strzały|Arrows
item.arrow.desc|Lotki z gęsich piór, promienie z dębu. Trzynaście sztuk w pęku.|Goose-fletched, oak-shafted. Thirteen to a bundle.
item.shield|Tarcza okrągła|Round shield
item.shield.desc|Deski, skóra i żelazny guz. Ciężka, ale zamienia cios w siniaka zamiast rany.|Boards, leather and an iron boss. Heavy, but it turns a cut into a bruise.
item.paddedJack|Pikowany kaftan|Padded jack
item.paddedJack.desc|Warstwy lnu i paździerzy. Niewiele waży, dużo znosi, śmierdzi po tygodniu.|Layers of linen and flax. Light, forgiving, and it stinks after a week.
item.leatherVest|Skórzany kirys|Leather vest
item.leatherVest.desc|Utwardzana skóra na piersi i plecach. Wystarczy na nóż, nie wystarczy na topór.|Hardened leather over chest and back. Enough for a knife, not for an axe.
item.chainShirt|Kolcza koszula|Chain shirt
item.chainShirt.desc|Tysiące nitowanych kółek. Dziewięć kilo, które ratują życie i niszczą plecy.|Thousands of riveted rings. Nine kilos that save your life and ruin your back.
item.kettleHelm|Szyszak|Kettle helm
item.kettleHelm.desc|Rondo chroni przed deszczem i przed ciosem z góry. Widzisz w nim mniej, ale żyjesz dłużej.|The brim keeps off rain and blows from above. You see less in it, but you live longer.
item.cloak|Wełniany płaszcz|Wool cloak
item.cloak.desc|Gruba wełna, kaptur, zapinka z kości. W deszczu ciężki jak zbroja, w zimie wart swojej ceny.|Thick wool, a hood, a bone clasp. In rain it hangs like armour; in cold it earns its price.
item.torch|Pochodnia|Torch
item.torch.desc|Kij, szmata, smoła. Pali się półtorej godziny i gasi się w deszczu szybciej, niż myślisz.|A stick, a rag, tar. It burns an hour and a half and dies in rain faster than you think.
item.lantern|Latarnia olejowa|Oil lantern
item.lantern.desc|Rogowa szybka i knot. Świeci słabiej niż pochodnia, ale nie podpali stodoły.|A horn pane and a wick. Dimmer than a torch, but it will not set a barn alight.
item.candle|Świeca|Candle
item.candle.desc|Łój, knot, godzina światła. Wystarczy na przeczytanie jednej strony, jeśli się pospieszysz.|Tallow, wick, one hour of light. Enough to read one page, if you hurry.
item.flint|Krzesiwo i hubka|Flint and steel
item.flint.desc|Kawałek stali i krzemień. Bez tego pochodnia jest tylko kijem, a noc jest tylko nocą.|A scrap of steel and a flint. Without it a torch is only a stick, and night is only night.
item.lockpick|Wytrychy|Lockpicks
item.lockpick.desc|Trzy haczyki z drutu. Stare zamki ustępują, nowe się nie poddają, a dźwięk zawsze ktoś słyszy.|Three wire hooks. Old locks give way, new ones do not, and somebody always hears the sound.
item.rope|Lina konopna|Hemp rope
item.rope.desc|Dwadzieścia łokci liny. Przyda się na statek, do studni i do rzeczy, których nie planowałeś.|Twenty ells of rope. Useful for a ship, a well, and things you did not plan.
item.oilcloth|Cerata|Oilcloth
item.oilcloth.desc|Natłuszczony kawałek płótna. Chroni notatnik przed deszczem — o ile o tym pamiętasz.|A greased square of cloth. It keeps the notebook dry — if you remember to use it.
item.waterskin|Bukłak|Waterskin
item.waterskin.desc|Skórzany worek na wodę. Można napełnić w studni, ale w porcie woda bywa zła.|A leather bag for water. Fillable at the well, though harbour water is often bad.
item.bandage|Bandaż lniany|Linen bandage
item.bandage.desc|Czyste płótno w paskach. Zatrzymuje krew, nie zatrzymuje zakażenia.|Clean linen in strips. It stops blood, it does not stop infection.
item.splint|Łupki|Splint
item.splint.desc|Deszczułki i rzemień. Złamana noga z łupkami pozwala chodzić; bez nich — leżeć.|Slats and a thong. A splinted leg lets you walk; without it, you lie down.
item.yarrow|Krwawnik|Yarrow
item.yarrow.desc|Rośnie przy rowach i na miedzach. Żuty hamuje krew, ale łatwo go pomylić ze szczwołem.|It grows by ditches and field edges. Chewed, it stops bleeding — but it is easily confused with hemlock.
item.salve|Maść Wiery|Wiera's salve
item.salve.desc|Tłuszcz, zioła i coś, czego nie chciałeś wiedzieć. Działa szybciej niż modlitwa.|Fat, herbs, and something you did not want to know. It works faster than prayer.
item.bitterDraught|Gorzki napar|Bitter draught
item.bitterDraught.desc|Ciemny płyn w fiolce. Smakuje jak ziemia z cmentarza, zbija gorączkę.|A dark liquid in a vial. It tastes like graveyard earth and brings a fever down.
item.poison|Trucizna|Poison
item.poison.desc|Szczwół plamisty w fiolce. Bez smaku, bez zapachu, bez odtrutki. Tylko czas.|Spotted hemlock in a vial. Tasteless, odourless, with no antidote. Only time.
item.mushroom|Grzyby|Mushrooms
item.mushroom.desc|Kania albo coś, co wygląda jak kania. Różnica bywa ostatnią różnicą w życiu.|A parasol mushroom, or something that looks like one. The difference can be the last one in your life.
item.bread|Chleb żytni|Rye bread
item.bread.desc|Cztery korony za bochenek, bo młynarz gra w kości. Ciężki, kwaśny, sycący na pół dnia.|Four crowns a loaf because the miller plays dice. Heavy, sour, filling for half a day.
item.cheese|Ser|Cheese
item.cheese.desc|Twardy krąg z owczego mleka. Trzyma się tygodniami, pachnie krócej.|A hard wheel of ewe's milk. It keeps for weeks; the smell keeps for less.
item.apple|Jabłko|Apple
item.apple.desc|Małe, kwaśne, z sadów za północną bramą. Lepsze niż nic.|Small, sour, from the orchards past the north gate. Better than nothing.
item.fish|Wędzona ryba|Smoked fish
item.fish.desc|Szprot z portu, wędzona w trocinach. Słony, trwały, śmierdzący jak cały zaułek.|Harbour sprat smoked in sawdust. Salty, lasting, and it smells like the whole alley.
item.venison|Dziczyzna|Venison
item.venison.desc|Mięso z lasu, którego nikt nie pytał o zdanie. Surowe zepsuje żołądek, pieczone syci.|Meat from a forest nobody consulted. Raw it ruins your stomach; roasted it fills you.
item.stew|Miska gulaszu|Bowl of stew
item.stew.desc|Rzepa, ryba i chleb w jednej misce. Sześć koron u Hanny i najlepsze sześć koron w mieście.|Turnip, fish and bread in one bowl. Six crowns at Hanna's, and the best six crowns in town.
item.beer|Kufel piwa|Mug of beer
item.beer.desc|Ciemne, lekkie, ciepławe. Dwie korony i trochę odwagi w płynie.|Dark, thin, lukewarm. Two crowns and a little courage in liquid form.
item.aleCask|Beczka piwa|Cask of ale
item.aleCask.desc|Czternaście kilo beczki bez cła. Dla Idziego to towar, dla Bernarda to dwadzieścia brakujących sztuk w księdze.|Fourteen kilos of untaxed cask. To Idzi it is goods; to Bernard it is twenty missing entries in a ledger.
item.salt|Wór soli|Sack of salt
item.salt.desc|Białe złoto wyspy. Z cłem kosztuje dwanaście koron, bez cła — pięć razy tyle i stryczek.|The island's white gold. With duty it costs twelve crowns; without it, five times that and a rope.
item.ironOre|Ruda żelaza|Iron ore
item.ironOre.desc|Kamień cięższy niż wygląda. Z czterech funtów rudy Orlik wyciśnie jeden funt żelaza.|Stone heavier than it looks. From four pounds of ore Orlik wrings one pound of iron.
item.coal|Węgiel|Coal
item.coal.desc|Czarny kamień, który pali się długo. Bez tego kowal jest tylko kowalem na zimno.|Black stone that burns long. Without it a smith is only a smith working cold.
item.ironBar|Sztaba żelaza|Iron bar
item.ironBar.desc|Wyciągnięty z pieca, ostudzony, gotowy do kucia. Pięć kilo wartości dwudziestu sześciu koron.|Drawn from the fire, cooled, ready to work. Five kilos worth twenty-six crowns.
item.nails|Garść gwoździ|Handful of nails
item.nails.desc|Krzywe, ale swoje. Ciesielstwo na wyspie stoi na takich właśnie.|Crooked, but their own. Carpentry on this island stands on exactly these.
item.plank|Deska dębowa|Oak plank
item.plank.desc|Tarcica z dębu, sucha rok. Dobra na tarczę, na trumnę i na drzwi.|Oak board, seasoned a year. Good for a shield, a coffin, or a door.
item.hide|Skóra jelenia|Deer hide
item.hide.desc|Surowa skóra, jeszcze sztywna. Oles weźmie ją chętnie, jeśli nie wyschła na kamieniu.|A raw hide, still stiff. Oles will take it gladly, provided it was not dried on stone.
item.leather|Skóra garbowana|Tanned leather
item.leather.desc|Miękka, pachnąca dębem i moczem. Z dwóch takich płaszczy powstaje kirys.|Soft, smelling of oak and urine. Two of these become a cuirass.
item.wool|Wekno wełny|Bundle of wool
item.wool.desc|Nieprzędzona wełna z owiec z pastwisk za młynem. Tka się z niej wszystko oprócz pieniędzy.|Unspun wool from the sheep behind the mill. Everything can be woven from it except money.
item.grain|Wór zboża|Sack of grain
item.grain.desc|Żyto w worku. Osiem kilo, piętnaście koron i powód, dla którego chłopak z przedmieścia pójdzie na szubienicę.|Rye in a sack. Eight kilos, fifteen crowns, and the reason a boy from the suburbs will go to the gallows.
item.notebook|Notatnik|Notebook
item.notebook.desc|Skórzana oprawa, dwadzieścia cztery karty. Bez niego nie pamiętasz twarzy, cen ani obietnic. Może zamoknąć, spłonąć albo zostać skradziony.|Leather binding, twenty-four leaves. Without it you remember no faces, prices or promises. It can soak, burn, or be stolen.
item.quill|Pióro i atrament|Quill and ink
item.quill.desc|Gęsie pióro i słoiczek atramentu z żelazowych galasów. Bez tego notatnik jest tylko papierem.|A goose feather and a pot of iron-gall ink. Without it the notebook is only paper.
item.mapPort|Plan portu i Dolnego Miasta|Plan of the harbour and Lower Town
item.mapPort.desc|Czterdzieści koron za pergamin. Gosław rysował go chodząc, więc kłamie uczciwie.|Forty crowns for a parchment. Goslaw drew it by walking, so it lies honestly.
item.mapIsland|Plan wyspy|Plan of the island
item.mapIsland.desc|Cała wyspa na jednym zwoju. Wschodnie bagna są na nim bliżej, niż są naprawdę — tak mówią rybacy.|The whole island on one scroll. The eastern marshes are drawn nearer than they are — the fishermen say so.
item.watch|Zegarek kieszonkowy|Pocket watch
item.watch.desc|Mosieżny, z pękniętą szybką. Dwście czterdzieści koron za pewność, która godzina.|Brass, with a cracked crystal. Two hundred and forty crowns for certainty about the hour.
item.permitPort|Przepustka portowa|Harbour pass
item.permitPort.desc|Kawałek papieru z pieczęcią Bernarda. Bez niego brama celna jest ścianą.|A scrap of paper with Bernard's seal. Without it the customs gate is a wall.
item.permitUpper|Przepustka do Górnego Miasta|Upper Town pass
item.permitUpper.desc|Dziewięćdziesiąt koron i trzy pytania, których nie chcesz usłyszeć. Górne Miasto nie jest dla wszystkich.|Ninety crowns and three questions you would rather not hear. The Upper Town is not for everyone.
item.falsePapers|Fałszywe papiery|False papers
item.falsePapers.desc|Cudze nazwisko na dobrym papierze. Sto koron u Idziego, stryczek przy bramie, jeśli się pomylisz.|Someone else's name on good paper. A hundred crowns from Idzi, a rope at the gate if you slip up.
item.letter|Zapieczętowany list|Sealed letter
item.letter.desc|Wosk z herbem kościoła. Ojciec Teodor pisze do Zbyluta, żeby kupiec patrzył na ciebie łaskawiej.|Wax with the church's mark. Father Teodor writes to Zbylut so the merchant will look on you more kindly.
item.deedRoom|Zapis na izbę|Deed for a room
item.deedRoom.desc|Izba nad stajnią, twoja na rok. Cztery ściany, dach i sąsiad, który kaszle przez sen.|A room above the stable, yours for a year. Four walls, a roof, and a neighbour who coughs in his sleep.
item.relic|Relikwiarz św. Elenem|Reliquary of St Elenem
item.relic.desc|Pozłacana puszka z kością i czterysta lat czyjejś modlitwy. Trzysta koron u Idziego, nieskończoność w kościele.|A gilt box with a bone inside, and four hundred years of somebody's prayer. Three hundred crowns at Idzi's, infinity at the church.
item.ring|Sygnet|Signet ring
item.ring.desc|Herb starty do połowy. Ktoś nosił go długo, ktoś inny sprzeda go chętnie.|A crest worn half away. Someone wore it long; someone else will sell it gladly.
item.gem|Srebrny klejnot|Silver gem
item.gem.desc|Oprawiony w srebro kamień z kontynentu. Rejne da za niego połowę wartości, a i tak będzie zadowolony.|A continental stone set in silver. Rejne will give you half its worth and still be pleased.
item.dice|Kości|Dice
item.dice.desc|Dwie kości z krowiej kostki. Na jednej szóstka jest starta częściej niż na drugiej — sprawdź, zanim postawisz.|Two knucklebone dice. On one of them the six is worn more often than on the other — check before you bet.
item.cards|Karty|Cards
item.cards.desc|Talia z plamami od piwa. Cecylia zna każdą plamę na pamięć.|A beer-stained deck. Cecylia knows every stain by heart.
item.hook|Haczyk|Fishing hook
item.hook.desc|Wygięty gwoźdź i żyłka z końskiego włosa. Ryby w porcie są głupie, ale nie aż tak.|A bent nail and horsehair line. Harbour fish are stupid, but not that stupid.
item.net|Mała sieć|Small net
item.net.desc|Spleciona sieć na dwa sążnie. Ewa mówi, że sieci się nie kupuje, tylko plecie — i ma rację.|A woven net two fathoms long. Ewa says nets are not bought, they are knotted — and she is right.
item.snare|Wnyki|Snare
item.snare.desc|Pętla z drutu na ścieżce zwierząt. Działa, kiedy śpisz, i czasem łapie nie to, co trzeba.|A wire loop on an animal path. It works while you sleep, and sometimes catches the wrong thing.
item.bait|Przynęta|Bait
item.bait.desc|Skórki chleba i wnętrzności ryby. Śmierdzi w plecaku przez cały dzień.|Bread crusts and fish guts. It stinks in your pack all day.
item.bone|Kość wilka|Wolf bone
item.bone.desc|Goleń wilka. Twarda jak róg, dobra na uchwyt noża i na wywar przeciw gorączce.|A wolf's shin. Hard as horn, good for a knife handle and for a fever broth.
item.wolfPelt|Skóra wilka|Wolf pelt
item.wolfPelt.desc|Szara, gęsta, jeszcze ciepła, jeśli się pospieszysz. Oles płaci czterdzieści osiem koron za całą.|Grey, dense, still warm if you are quick. Oles pays forty-eight crowns for a whole one.
item.feather|Gęsie pióra|Goose feathers
item.feather.desc|Lotki do strzał i pióra do pisania. Jedno pióro, dwa zastosowania, jedna gęś niezadowolona.|Flight feathers for arrows and quills for writing. One feather, two uses, one unhappy goose.
item.crateUntaxed|Skrzynia bez cła|Untaxed crate
item.crateUntaxed.desc|Dwanaście kilo skrzyni, której nie ma w żadnej księdze. Trzeba ją przenieść przez miasto w nocy.|Twelve kilos of a crate that appears in no ledger. It must be carried across the town in the dark.
item.satchel|Torebka Marty|Marta's satchel
item.satchel.desc|Skórzana torebka z oszczędnościami jej matki: jedenaście koron i srebrna zapinka.|A leather bag holding her mother's savings: eleven crowns and a silver clasp.
item.whetstone|Osełka|Whetstone
item.whetstone.desc|Kamień z rzeki i godzina cierpliwości. Zardzewiały miecz stanie się mieczem.|A river stone and an hour of patience. A rusted sword becomes a sword.
item.tabChit|Kredka Hanny|Hanna's chit
item.tabChit.desc|Drewniana deszczułka z nacięciami: trzydzieści koron długu u karczmarki. Kto ma deskę, ma rację.|A wooden tally notched with thirty crowns owed to the innkeep. Whoever holds the stick holds the truth.
item.customsSeal|Pieczęć celna|Customs seal
item.customsSeal.desc|Mosiężny stempel Bernarda. Z nim wóz przejdzie przez bramę; bez niego wóz stoi trzy dni.|Bernard's brass stamp. With it a cart passes the gate; without it the cart stands for three days.
item.knightToken|Znak Dzikich Rycerzy|Wild Knights' token
item.knightToken.desc|Blacha z wyrytym krukiem. Noszą ją ci, którzy biorą dziesiątą część wszystkiego. Wartość: sto dwadzieścia koron albo stryczek.|A plate with an engraved crow. Worn by those who take a tenth of everything. Worth one hundred twenty crowns, or a rope.
item.turnip|Rzepa|Turnip
item.turnip.desc|Bulwa z pola za garbarnią. Gotowana w gulaszu udaje mięso.|A root from the field behind the tannery. Boiled in stew it pretends to be meat.
item.garlic|Warkocz czosnku|Braid of garlic
item.garlic.desc|Czosnek w warkoczu. Wiera wiesza go nad drzwiami i mówi, że to przeciw zarazie. Może ma rację.|Garlic in a braid. Wiera hangs it over the door and says it is against the plague. She may be right.
item.gooseFat|Gęsi smalec|Goose fat
item.gooseFat.desc|Słoik tłuszczu. Podstawa każdej maści i połowa smaku każdego gulaszu.|A jar of fat. The base of every salve and half the taste of every stew.
item.egg|Jaja gęsie|Goose eggs
item.egg.desc|Trzy jaja, wielkie jak pięść. Na patelni starczą dla dwóch ludzi.|Three eggs the size of a fist. In a pan they will feed two people.
item.rag|Szmaty lniane|Linen rags
item.rag.desc|Pocięta bielizna. Zofia pierze je, medyk zużywa na opatrunki, krawcowa na nici.|Cut-up linen. Zofia washes it, the medic uses it for dressings, the seamstress for thread.
item.poultice|Okład ziołowy|Herb poultice
item.poultice.desc|Zgnieciony krwawnik w szmacie. Kładziesz na ranę i liczysz, że nie będzie jątrzyć.|Bruised yarrow in a rag. You lay it on the wound and hope it does not fester.
item.antidote|Odtrutka|Antidote
item.antidote.desc|Ciemny płyn, który nie odwraca szczwołu — tylko kupuje czas. Siedemdziesiąt koron za kilka godzin.|A dark liquid that does not undo hemlock — it only buys time. Seventy crowns for a few hours.
item.jerkin|Skórzany kubrak|Leather jerkin
item.jerkin.desc|Dwie skóry jelenia i trzy dni pracy Olesa. Chroni przed deszczem i przed pierwszym ciosem.|Two deer hides and three days of Oles's work. It keeps out rain and the first blow.
item.wolfskin|Płaszcz z wilczej skóry|Wolfskin cloak
item.wolfskin.desc|Futro z kapturem. W lesie pachniesz jak wilk, w mieście jak ktoś, kogo nie zaczepiają.|Fur with a hood. In the woods you smell like a wolf; in town you smell like someone nobody bothers.
item.skinningKnife|Nóż do skórowania|Skinning knife
item.skinningKnife.desc|Cienkie, zakrzywione ostrze. Zdejmie skórę w całości, jeśli ręka się nie trzęsie.|A thin, curved blade. It will take a hide off whole, if the hand does not shake.
item.scrap|Złom żelazny|Iron scrap
item.scrap.desc|Kawałki po nieudanym kuciu. Orlik weźmie je z powrotem za trzecią część wartości.|Scraps from a failed forging. Orlik will take them back at a third of their worth.
item.purseSmall|Mała sakiewka|Small purse
item.purseSmall.desc|Czyjaś sakiewka z kilkoma koronami w środku. Ważne, żebyś nie pamiętał, czyja.|Someone's purse with a few crowns inside. Best not to remember whose.
item.purseBig|Ciężka sakiewka|Heavy purse
item.purseBig.desc|Ciężka, pełna, ciepła jeszcze od cudzego pasa. Takie sakiewki szukają właściciela przez tydzień.|Heavy, full, still warm from somebody else's belt. Such purses look for their owner for a week.
item.willowBark|Kora wierzby|Willow bark
item.willowBark.desc|Żuta łagodzi ból, parzona zbija gorączkę. Rośnie nad wodą, czyli tam, gdzie komary.|Chewed it eases pain, brewed it lowers fever. It grows by water, which is where the midges are.
item.bookHours|Godzinki|Book of hours
item.bookHours.desc|Mała księga modlitw z marginesami pełnymi czyichś notatek. Kościół chciałby ją z powrotem.|A small prayer book with margins full of somebody's notes. The church would like it back.
""")

# ===========================================================================
# 5. UMIEJĘTNOŚCI, PERKI, GAŁĘZIE, CZYNNOŚCI
# ===========================================================================
add(r"""
branch.combat|Walka|Combat
branch.combat.desc|Wszystko, czym zadajesz ból i jak go unikasz.|Everything by which you deal pain and avoid it.
branch.craft|Rzemiosło|Craft
branch.craft.desc|Praca rąk przy stanowisku: kowalstwo, stolarstwo, tanning, warzenie.|Handwork at a station: smithing, joinery, tanning, brewing.
branch.crime|Przestępczość|Crime
branch.crime.desc|Cudza kieszeń, cudzy zamek, cudze oko.|Somebody else's pocket, lock, and eye.
branch.knowledge|Wiedza|Knowledge
branch.knowledge.desc|Czytanie, historia, bestiarium i to, czego nie da się wykopać mieczem.|Reading, history, bestiary lore, and what a sword cannot dig out.
branch.survival|Przetrwanie|Survival
branch.survival.desc|Las, bagno, ciało: jedzenie, ciepło, rany i choroby.|Wood, marsh, body: food, warmth, wounds and sickness.
branch.trade|Handel|Trade
branch.trade.desc|Cena, targowanie, kłamstwo przy stole i umiejętność niepłacenia dwa razy.|Price, haggling, lying at a table, and the art of not paying twice.
skill.alchemy|Alchemia|Alchemy
skill.alchemy.desc|Nalewki, trucizny i mikstury. Każda fiolka ma cenę i skutek.|Tinctures, poisons and draughts. Every vial has a price and an effect.
skill.archery|Łucznictwo|Archery
skill.archery.desc|Cięciwa, oddech, dystans. W mieście strzała zostawia ślad w ścianie i w pamięci świadków.|String, breath, distance. In town an arrow leaves a mark in the wall and in a witness's memory.
skill.barter|Targowanie|Barter
skill.barter.desc|Każde jedno słowo mniej znaczy jedną koronę więcej.|Every word fewer is a crown more.
skill.beasts|Zwierzęta|Beasts
skill.beasts.desc|Wiesz, co je, czego się boi i kiedy ucieknie. Pies, koń, wilk, dzik.|You know what it eats, what it fears and when it will run. Dog, horse, wolf, boar.
skill.blunt|Obuch|Blunt
skill.blunt.desc|Młot, maczuga, kij. Nie tnie, ale łamie i ogłusza — i nie zostawia krwi na bruku.|Mace, club, staff. It does not cut, but it breaks and stuns — and leaves no blood on the cobbles.
skill.brawl|Bójka|Brawl
skill.brawl.desc|Pięści, łokcie, głowa. Kiedy nie masz broni, masz siebie.|Fists, elbows, head. When you have no weapon, you have yourself.
skill.brewing|Warzenie|Brewing
skill.brewing.desc|Słód, woda, czas. Beczka bez cła to zysk, beczka zepsuta to strata.|Malt, water, time. An untaxed cask is profit; a spoiled one is loss.
skill.carpentry|Ciesielstwo|Carpentry
skill.carpentry.desc|Deski, gwoździe, kąt prosty. Drzwi, tarcza, beczka, trumna.|Boards, nails, a right angle. A door, a shield, a cask, a coffin.
skill.cooking|Gotowanie|Cooking
skill.cooking.desc|Z tego samego garnka jedno danie syci, a drugie rozstraja żołądek.|From the same pot one dish fills you and another undoes your stomach.
skill.deceit|Zwodzenie|Deceit
skill.deceit.desc|Kłamstwo, które brzmi jak prawda. Kosztuje reputację, jeśli ktoś sprawdzi.|A lie that sounds like the truth. It costs reputation if somebody checks.
skill.endurance|Wytrzymałość|Endurance
skill.endurance.desc|Jak długo możesz biec, bić i nie spaść z nóg.|How long you can run, fight and stay upright.
skill.firstaid|Pierwsza pomoc|First aid
skill.firstaid.desc|Bandaż, łupki, czyste ręce. Rana opatrzona zamyka się, nieoprawiona jątrzy.|Bandage, splint, clean hands. A dressed wound closes; an undressed one festers.
skill.fishing|Rybołówstwo|Fishing
skill.fishing.desc|Sieć, haczyk, cierpliwość. Port daje jeść, jeśli wiesz, gdzie rzucać.|Net, hook, patience. The harbour feeds you if you know where to cast.
skill.foraging|Zbieractwo|Foraging
skill.foraging.desc|Krwawnik od szczwołu odróżnisz tylko wtedy, jeśli się nauczysz.|You can tell yarrow from hemlock only if you learn to.
skill.gamble|Hazard|Gambling
skill.gamble.desc|Kości, karty i twarz, która nic nie mówi. Wygrana to nie szczęście, to rachunek.|Dice, cards, and a face that says nothing. Winning is not luck, it is arithmetic.
skill.herbalism|Zielarstwo|Herbalism
skill.herbalism.desc|Co rośnie, co leczy, co zabija. Wiera zna to na pamięć i nie chce uczyć za darmo.|What grows, what heals, what kills. Wiera knows it by heart and will not teach for free.
skill.history|Historia|History
skill.history.desc|Rok 1430 ma przyczyny. Klasztor, bunt, pożar i to, dlaczego bramę zamykają o zmierzchu.|1430 has causes. The abbey, the rising, the fire, and why the gate closes at dusk.
skill.intimidate|Zastraszanie|Intimidate
skill.intimidate.desc|Czasem wystarczy stać blisko i milczeć. Strażnicy pamiętają twarze.|Sometimes standing close and saying nothing is enough. Guards remember faces.
skill.lockpick|Wytrych|Lockpicking
skill.lockpick.desc|Zamek to mechanizm, nie wyrok. Dźwięk jednak słychać w całym zaułku.|A lock is a mechanism, not a verdict. But the sound carries down the whole alley.
skill.medicine|Medycyna|Medicine
skill.medicine.desc|Zakażenie, gorączka, zaraza. Różnica między opatrunkiem a amputacją.|Infection, fever, plague. The difference between a dressing and an amputation.
skill.parry|Parowanie|Parrying
skill.parry.desc|Odbicie ciosu w ostatniej chwili. Wymaga oczu, nie siły.|Turning a blow at the last moment. It needs eyes, not strength.
skill.persuade|Przekonywanie|Persuade
skill.persuade.desc|Słowa działają, jeśli wiesz, czego ten człowiek chce.|Words work if you know what the person wants.
skill.pickpocket|Kieszonkostwo|Pickpocketing
skill.pickpocket.desc|Cudza sakiewka w twojej dłoni. Jeśli się nie uda, cały plac widzi twoją twarz.|Somebody else's purse in your hand. If it fails, the whole square sees your face.
skill.reading|Czytanie|Reading
skill.reading.desc|Bez tego notatnik jest tylko kreskami, a księga celna — ścianą liczb.|Without it a notebook is only scratches and a customs ledger is a wall of numbers.
skill.sailing|Żeglarstwo|Sailing
skill.sailing.desc|Wiatr, prąd, lina. Bosman Idzi nie tłumaczy dwa razy.|Wind, current, rope. Bosun Idzi does not explain twice.
skill.smithing|Kowalstwo|Smithing
skill.smithing.desc|Temperatura, rytm, hartowanie. Zła sztaby nie naprawi najlepszy młot.|Heat, rhythm, quenching. The best hammer cannot fix bad stock.
skill.sneak|Skradanie|Sneaking
skill.sneak.desc|Cień, miękki krok, oddech. Strażnik z pochodnią widzi dalej, niż myślisz.|Shadow, soft step, breath. A guard with a torch sees further than you think.
skill.streetwise|Znajomość ulicy|Streetwise
skill.streetwise.desc|Kto kogo kryje, gdzie jest tanio, który zaułek kończy się murem.|Who covers whom, where it is cheap, which alley ends in a wall.
skill.sword|Miecz|Sword
skill.sword.desc|Dystans, kąt, rytm. Podstawowa rzecz, którą przyniosłeś z kontynentu.|Distance, angle, rhythm. The basic thing you brought from the continent.
skill.tanning|Garbarstwo|Tanning
skill.tanning.desc|Kora dębu, woda i zapach, którego nie zmyjesz. Oles płaci dobrze za całą skórę.|Oak bark, water, and a smell you will not wash off. Oles pays well for a whole hide.
skill.tracking|Tropienie|Tracking
skill.tracking.desc|Błoto, złamana gałąź, krew na kamieniu. Las mówi, jeśli umiesz słuchać.|Mud, a broken twig, blood on stone. The woods speak if you know how to listen.
use.alchemy|Wiedza o fiolkach|Vial lore
use.archery|Strzał|Shot
use.barter|Targ|Haggling
use.beasts|Zwierzę|Animal
use.blunt|Cios obuchem|Blunt strike
use.brawl|Bójka|Brawl
use.brewing|Warzenie|Brewing
use.carpentry|Ciosła|Joiner's work
use.cooking|Garnek|The pot
use.deceit|Kłamstwo|A lie
use.endurance|Wysiłek|Exertion
use.firstaid|Opatrunek|Dressing
use.fishing|Połów|Fishing
use.foraging|Zbiory|Gathering
use.gamble|Rozdanie|A hand
use.herbalism|Zioła|Herbs
use.history|Dawne dzieje|Old history
use.intimidate|Groźba|A threat
use.lockpick|Zamek|A lock
use.medicine|Leczenie|Treatment
use.parry|Odbicie|A parry
use.persuade|Prośba|An appeal
use.pickpocket|Kieszeń|A pocket
use.reading|Pismo|Script
use.sailing|Lina i wiatr|Rope and wind
use.smithing|Kucie|Forging
use.sneak|Cichy krok|A quiet step
use.streetwise|Ulica|The street
use.sword|Cios mieczem|Sword blow
use.tanning|Skóra|Hides
use.tracking|Ślad|A track
perk.literate|Piśmienny|Literate
perk.literate.desc|Umiesz czytać i pisać bez błędów. Notatnik naprawdę notuje.|You can read and write without error. The notebook truly records.
perk.quickDraw|Szybka dłoń|Quick draw
perk.quickDraw.desc|Pierwszy cios wyprowadzasz szybciej, niż przeciwnik zdąży podnieść tarczę.|You land the first blow before the other can raise his shield.
perk.parryMaster|Mistrz parowania|Parry master
perk.parryMaster.desc|Okno parowania jest szersze, a po udanym odbiciu wróg się odsłania.|The parry window is wider, and a successful turn leaves the enemy open.
perk.riposte|Riposta|Riposte
perk.riposte.desc|Po dobrym parowaniu twój cios trafia dwa razy mocniej.|After a good parry your blow lands twice as hard.
perk.heavyHand|Ciężka ręka|Heavy hand
perk.heavyHand.desc|Ciosy obuchem łamią gardę zamiast tylko ją obijać.|Blunt blows break a guard instead of merely battering it.
perk.shieldWall|Mur z tarczy|Shield wall
perk.shieldWall.desc|Blok trzyma dłużej, zanim pęknie.|A block holds longer before it breaks.
perk.longBreath|Długi oddech|Long breath
perk.longBreath.desc|Mniej sił kosztuje bieg i wymiana ciosów.|Running and trading blows cost less breath.
perk.softStep|Miękki krok|Soft step
perk.softStep.desc|Skradanie prawie nie hałasuje. Pies i tak cię wyczuje.|Sneaking is nearly silent. The dog will smell you anyway.
perk.hiddenPockets|Ukryte kieszenie|Hidden pockets
perk.hiddenPockets.desc|Złodziej przeszuka cię i nie znajdzie tego, co najważniejsze.|A thief will search you and not find what matters most.
perk.cutpurse|Rzezimieszek|Cutpurse
perk.cutpurse.desc|Sakiewka przechodzi z pasa do dłoni bez dźwięku.|A purse moves from belt to hand without a sound.
perk.wireFingers|Druciane palce|Wire fingers
perk.wireFingers.desc|Wytrych rzadziej się łamie, zamek otwiera się ciszej.|A pick breaks less often and a lock opens more quietly.
perk.honestFace|Uczciwa twarz|Honest face
perk.honestFace.desc|Strażnik patrzy na ciebie i widzi kupca, nie włóczęgę.|A guard looks at you and sees a merchant, not a vagrant.
perk.smoothLie|Gładkie kłamstwo|Smooth lie
perk.smoothLie.desc|Kłamstwo brzmi jak prawda nawet dla człowieka, który zna prawdę.|A lie sounds true even to the man who knows the truth.
perk.merchantsEar|Ucho kupca|Merchant's ear
perk.merchantsEar.desc|Słyszysz, kiedy cena jest zmyślona.|You hear when a price has been invented.
perk.saltHand|Słona dłoń|Salt hand
perk.saltHand.desc|Lina, żagiel i prąd są ci znajome. Bosman mówi o jedną rzecz mniej.|Rope, sail and current are familiar to you. The bosun says one thing less.
perk.coastPilot|Pilot przybrzeżny|Coast pilot
perk.coastPilot.desc|Znasz mielizny wokół wyspy. Statek płynie tam, gdzie chcesz.|You know the shoals around the island. A ship goes where you want.
perk.diceMemory|Pamięć do kości|Dice memory
perk.diceMemory.desc|Pamiętasz, co wypadło, i wiesz, kiedy kość jest szlifowana.|You remember what fell and know when a die is loaded.
perk.coldEye|Zimne oko|Cold eye
perk.coldEye.desc|Przy kartach twoja twarz nic nie mówi, a cudza mówi za dużo.|At cards your face says nothing and the other's says too much.
perk.greenThumb|Zielony kciuk|Green thumb
perk.greenThumb.desc|Zioła odrastają szybciej, a zbiory są większe.|Herbs grow back faster and the yield is larger.
perk.herbarium|Zielnik|Herbarium
perk.herbarium.desc|Nie pomylisz krwawnika ze szczwołem. Nawet o świcie, nawet w deszczu.|You will not mistake yarrow for hemlock. Not at dawn, not in rain.
perk.fieldDressing|Opatrunek polowy|Field dressing
perk.fieldDressing.desc|Bandaż zakładany szybko i czysto. Rana goi się zamiast jątrzyć.|A dressing laid quickly and cleanly. The wound heals instead of festering.
perk.chirurgeon|Cyrulik|Chirurgeon
perk.chirurgeon.desc|Nastawisz kość i zszyjesz skórę tam, gdzie inny tylko patrzy.|You will set a bone and stitch skin where another only watches.
perk.curing|Konserwacja|Curing
perk.curing.desc|Mięso i ryby trzymają się dłużej i nie trują.|Meat and fish keep longer and do not poison.
perk.brewer|Piwowar|Brewer
perk.brewer.desc|Beczka nie kwaśnieje, a smak jest równy od pierwszej do ostatniej miarki.|The cask does not sour, and the taste is even from first measure to last.
perk.distiller|Destylator|Distiller
perk.distiller.desc|Mocniejsze nalewki z tej samej ilości ziół.|Stronger tinctures from the same quantity of herbs.
perk.joiner|Stolarz|Joiner
perk.joiner.desc|Deska pasuje do deski za pierwszym razem.|Board meets board on the first try.
perk.trueTemper|Prawdziwy hart|True temper
perk.trueTemper.desc|Ostrze trzyma krawędź dłużej i nie pęka przy twardym kontakcie.|An edge holds longer and does not chip on hard contact.
perk.bellows|Miech|Bellows
perk.bellows.desc|Piec trzyma temperaturę, więc sztaba wystarcza na więcej.|The forge holds heat, so one bar goes further.
perk.shadowWork|Praca w cieniu|Shadow work
perk.shadowWork.desc|Nocą twoje ręce są szybsze, a oczy — ostrzejsze.|At night your hands are quicker and your eyes sharper.
perk.streetEar|Ucho ulicy|Street ear
perk.streetEar.desc|Plotki docierają do ciebie zanim dojrzeją.|Rumours reach you before they ripen.
perk.readGround|Czytanie gruntu|Reading the ground
perk.readGround.desc|Wiesz, kto tędy szedł i jak dawno temu.|You know who passed and how long ago.
perk.beastLore|Wiedza o zwierzętach|Beast lore
perk.beastLore.desc|Wilk nie jest dla ciebie potworem, tylko zwierzęciem z nawykami.|A wolf is not a monster to you, just an animal with habits.
perk.chronicle|Kronika|Chronicle
perk.chronicle.desc|Rok 1430 nie jest datą, jest opowieścią, którą znasz do końca.|1430 is not a date to you; it is a story you know to the end.
perk.stillWater|Spokojna woda|Still water
perk.stillWater.desc|Zimna woda i zmęczenie nie odbierają ci ręki.|Cold water and fatigue do not take away your hand.
req.gold1|1 korona|1 crown
req.gold2|2 korony|2 crowns
req.gold3|3 korony|3 crowns
req.gold4|4 korony|4 crowns
req.gold5|5 koron|5 crowns
req.gold8|8 koron|8 crowns
req.gold10|10 koron|10 crowns
req.gold14|14 koron|14 crowns
req.gold20|20 koron|20 crowns
req.gold25|25 koron|25 crowns
req.gold30|30 koron|30 crowns
req.gold38|38 koron|38 crowns
req.gold40|40 koron|40 crowns
req.gold50|50 koron|50 crowns
req.gold55|55 koron|55 crowns
req.gold65|65 koron|65 crowns
req.gold75|75 koron|75 crowns
req.gold80|80 koron|80 crowns
req.gold120|120 koron|120 crowns
req.gold180|180 koron|180 crowns
req.gold1000|1000 koron|1000 crowns
req.bread|Chleb|Bread
req.coal3|Węgiel ×3|Coal ×3
req.forgeUnlocked|Orlik wpuścił cię do kowadła|Orlik has let you to the anvil
req.foundCave|Znaleziono jaskinię|The cave was found
req.foundGap|Znaleziono szczelinę w murze|The gap in the wall was found
req.guildTeach|Cech zgodził się uczyć|The guild agreed to teach
req.history2|Historia 2|History 2
req.idziTeach|Idzi zgodził się uczyć|Idzi agreed to teach
req.idziTrust|Idzi ci ufa|Idzi trusts you
req.injured|Jesteś ranny|You are wounded
req.intimidate3|Zastraszanie 3|Intimidate 3
req.intimidate4|Zastraszanie 4|Intimidate 4
req.martaRumor|Wiesz coś o Marcie|You know something about Marta
req.martaTeach|Marta zgodziła się uczyć|Marta agreed to teach
req.permit|Przepustka|A pass
req.saltRumor|Wiesz, skąd bierze się sól|You know where the salt comes from
req.streetwise3|Znajomość ulicy 3|Streetwise 3
req.table|Wolny stolik|A free table
req.teachSmith|Orlik będzie uczył|Orlik will teach
req.vagnRespect|Vagn cię szanuje|Vagn respects you
req.vranov|Słowo od Vranova|A word from Vranov
req.wanted|Jesteś poszukiwany|You are wanted
req.betrayed|Ktoś cię wydał|Somebody has given you up
service.alms|Jałmużna (2 korony)|Alms (2 crowns)
service.bath|Łaźnia (5 koron)|Bath (5 crowns)
service.confess|Spowiedź (3 korony)|Confession (3 crowns)
service.contract|Kontrakt pisemny|A written contract
service.drink|Kufel piwa (2 korony)|Mug of beer (2 crowns)
service.meal|Miska gulaszu (6 koron)|Bowl of stew (6 crowns)
service.pass|Przepustka górnomiejska|Upper Town pass
service.room|Izba na noc|A room for the night
service.setBone|Nastawienie kości (12 koron)|Setting a bone (12 crowns)
service.stitch|Szycie rany (8 koron)|Stitching a wound (8 crowns)
service.treat|Opatrzenie ran (10 koron)|Dressing wounds (10 crowns)
service.wash|Pranie (1 korona)|Washing (1 crown)
note.arrival.day|Dzień pierwszy, keja|Day one, the pier
note.arrival|Statek odpłynął o świcie. Baldwin Kruk stał na brzegu i liczył na palcach. Dziesięć tysięcy koron, trzydzieści dni. Nie mam nic oprócz zardzewiałego miecza i adresu karczmy.|The ship sailed at dawn. Baldwin Kruk stood on the shore counting on his fingers. Ten thousand crowns, thirty days. I have nothing but a rusted sword and the address of an inn.
note.debt.day|Dzień pierwszy, karczma|Day one, the inn
note.debt|Kruk mówi, że dług rośnie o dwadzieścia koron dziennie. Jeśli to prawda, za tydzień będę winien więcej, niż mam nadzieję zarobić. Muszę sprawdzić, czy liczy uczciwie.|Kruk says the debt grows by twenty crowns a day. If that is true, in a week I will owe more than I hope to earn. I must check whether he counts honestly.
note.vagn.day|Dzień pierwszy, dziedziniec|Day one, the yard
note.vagn|Stary Vagn patrzył na mnie przez chwilę i powiedział, że trzymam miecz jak chłop z widłami. Potem pokazał, gdzie jest wiadro z wodą. Nauka kosztuje korony i czas — nie ma darmowych lekcji.|Old Vagn looked at me a while and said I hold a sword like a peasant holds a pitchfork. Then he showed me where the water bucket is. Teaching costs crowns and time — there are no free lessons.
note.marta.day|Dzień drugi, zaułek|Day two, the alley
note.marta|Dziewczyna, może piętnaście lat, próbowała mi wyjąć sakiewkę. Złapałem ją za nadgarstek. Nie płakała — tylko policzyła, ile by zarobiła. Powiedziała, że zna kogoś, kto potrzebuje kogoś, kto umie chodzić cicho.|A girl, maybe fifteen, tried to lift my purse. I caught her by the wrist. She did not cry — she only calculated what she would have earned. She said she knows somebody who needs somebody who can walk quietly.
note.idzi.day|Dzień drugi, magazyn|Day two, the warehouse
note.idzi|Bosman Idzi nie podał mi ręki. Powiedział, że pracuje dla człowieka, który nie istnieje, i że jeżeli chcę przewieźć coś, czego nie ma w księdze, mam przyjść po zmierzchu. Wspomniał o soli — dwanaście koron w worze, jeśli nikt nie patrzy.|Bosun Idzi did not shake my hand. He said he works for a man who does not exist, and that if I want to move something that is in no ledger I should come after dusk. He mentioned salt — twelve crowns a sack, if nobody is watching.
note.fire.day|Dzień trzeci, rynek|Day three, the market
note.fire|Na rynku ktoś krzyczał, że w Dolnym Mieście płonie dach. Straż zamyka bramę, żeby ludzie nie biegli. Hanna mówi, że to trzeci pożar w tym miesiącu i że ubezpieczenia nie ma, bo cechy się kłócą o to, kto płaci.|Somebody on the market was shouting that a roof is burning in the Lower Town. The guard closes the gate so people will not run. Hanna says it is the third fire this month and there is no insurance, because the guilds are arguing about who pays.
note.blood.day|Dzień czwarty, za garbarnią|Day four, behind the tannery
note.blood|Pierwszy raz zabiłem człowieka. Nie w pojedynku — w zaułku, bo chciał mojej sakiewki. Krew na bruku wygląda jak rdza. Straż przeszła obok i nie zatrzymała się. Ktoś to widział, wiem to, bo patrzył mi w oczy.|The first time I killed a man. Not in a duel — in an alley, because he wanted my purse. Blood on cobbles looks like rust. The guard walked past and did not stop. Somebody saw it; I know, because he looked me in the eye.
""")

# ===========================================================================
# 6. POSTACIE, KUPCY, MIEJSCA, STANOWISKA, BUDYNKI, WNĘTRZA, FRAKCJE
# ===========================================================================
add(r"""
faction.wildKnights|Dzicy Rycerze|Wild Knights
faction.cityGuard|Straż Miejska|City Guard
faction.merchantGuild|Cech Kupiecki|Merchant Guild
faction.church|Kościół|The Church
faction.smugglers|Przemytnicy z portu|Harbour Smugglers
faction.villagers|Mieszkańcy|Villagers
player.name|John z Vranova|John of Vranov
enemy.none|—|—
npc.baldwin.name|Baldwin Kruk|Baldwin Kruk
npc.baldwin.role|Wierzyciel Dzikich Rycerzy|Debt collector of the Wild Knights
npc.baldwin.address|Pokój nad stajnią, przy karczmie|A room above the stable, by the inn
npc.baldwin.greet1|Trzydzieści dni, John. Liczę na palcach, żebyś widział, ile ci zostało.|Thirty days, John. I count on my fingers so you can see how much you have left.
npc.baldwin.desire|Żeby dług został spłacony co do korony i żeby nikt nie myślał, że Rycerze żartują.|For the debt to be paid to the last crown, and for nobody to think the Knights joke.
npc.baldwin.secret|Sam jest winien Rycerzom więcej, niż John. Jeśli John nie zapłaci, Baldwin pójdzie na szubienicę pierwszy.|He owes the Knights more than John does. If John does not pay, Baldwin hangs first.
npc.hanna.name|Hanna z Młyna|Hanna of the Mill
npc.hanna.role|Karczmarka|Innkeeper
npc.hanna.address|Karczma Pod Rdzawym Kotem, rynek|The Rusty Cat inn, market square
npc.hanna.greet1|Zmarznięty? Miska sześć koron, izba pięć. Kredka tylko dla stałych gości.|Cold? A bowl is six crowns, a room five. A tally tab is only for regulars.
npc.hanna.greet2|Znowu ty. Siadaj przy piecu, nie przy oknie — przy oknie siedzą ci, którzy liczą cudze pieniądze.|You again. Sit by the hearth, not the window — the window is for those who count other people's money.
npc.hanna.greet3|Jeśli masz krew na rękawie, wejdź tylnymi drzwiami. Nie chcę tłumaczyć tego straży.|If there is blood on your sleeve, use the back door. I do not want to explain that to the guard.
npc.hanna.desire|Spokojna karczma, pełne beczki i żeby cechy przestały się kłócić o to, kto płaci za odbudowę spalonych dachów.|A quiet inn, full casks, and for the guilds to stop arguing about who pays to rebuild the burnt roofs.
npc.hanna.secret|Mąż zginął w pożarze w 1428. Kredki z nacięciami trzyma pod ladą — niektóre z nich mają po sześć lat i nigdy nie zostały spłacone.|Her husband died in the fire of 1428. She keeps the notched tallies under the counter — some are six years old and were never paid.
npc.vagn.name|Stary Vagn|Old Vagn
npc.vagn.role|Nauczyciel walki, były sierżant|Combat teacher, former sergeant
npc.vagn.address|Dziedziniec za kuźnią|The yard behind the smithy
npc.vagn.greet1|Stoisz jak chłop z widłami. Podnieś łokcie, obniż biodra, oddychaj.|You stand like a peasant with a pitchfork. Elbows up, hips down, breathe.
npc.vagn.greet2|Trzy wymiany. Jeśli mnie trafisz choć raz, dam ci lekcję za połowę ceny.|Three exchanges. Touch me once and I will give you the lesson at half price.
npc.vagn.desire|Żeby ktoś po nim przeżył to, czego uczy. Reszta to piwo i cisza.|For somebody to outlive what he teaches. The rest is beer and silence.
npc.vagn.secret|W 1428 prowadził obronę bramy północnej i zostawił ją, kiedy przyszedł rozkaz od Rycerzy. Trzech jego ludzi zginęło po jego odejściu.|In 1428 he held the north gate and left it when an order came from the Knights. Three of his men died after he walked away.
npc.wiera.name|Wiera Zielarka|Wiera the herbalist
npc.wiera.role|Zielarka i lekarka z bagien|Herbalist and healer of the marshes
npc.wiera.address|Chatka na skraju bagien, za garbarnią|A hut at the edge of the marshes, past the tannery
npc.wiera.greet1|Pokaż ręce. Tak, obie. Brud pod paznokciami mówi o tobie więcej niż twoje słowa.|Show me your hands. Both. The dirt under your nails says more than your words.
npc.wiera.desire|Żeby ludzie przestali umierać na rzeczy, które rosną trzydzieści kroków od ich domu.|For people to stop dying of things growing thirty paces from their door.
npc.wiera.secret|W 1429 podczas zarazy leczyła obu stron — rycerzy i chłopów. Rycerze spalili jej chatę; chłopi odbudowali ją w jedną noc.|During the plague of 1429 she treated both sides — knights and peasants. The knights burned her hut; the peasants rebuilt it in one night.
npc.orlik.name|Mistrz Orlik|Master Orlik
npc.orlik.role|Kowal|Blacksmith
npc.orlik.address|Kuźnia przy rynku, komin z cegły|The smithy on the square, brick chimney
npc.orlik.greet1|Węgiel najpierw. Potem pogadamy o ostrzu.|Coal first. Then we will talk about an edge.
npc.orlik.greet2|Kto przynosi złom, dostaje trzecią część ceny. Kto przynosi węgiel, dostaje kowadło.|Whoever brings scrap gets a third of the price. Whoever brings coal gets the anvil.
npc.orlik.desire|Piec, który nie gaśnie, i czeladnik, który nie ucieknie do miasta na zimę.|A forge that does not go out, and an apprentice who will not run off to town for the winter.
npc.orlik.secret|Kuje groty dla Dzikich Rycerzy i nie wpisuje ich do księgi. Wie, że Rawicz też wie, i obaj milczą, bo obaj na tym zarabiają.|He forges heads for the Wild Knights and does not enter them in the ledger. He knows Rawicz knows, and both stay silent because both profit.
npc.idzi.name|Bosman Idzi|Bosun Idzi
npc.idzi.role|Przemytnik, bosman portowy|Smuggler, harbour bosun
npc.idzi.address|Magazyn B, przy kei zachodniej|Warehouse B, on the west pier
npc.idzi.greet1|Nie znam cię. To dobrze. Znam wszystkich i to jest źle.|I do not know you. Good. I know everybody, and that is bad.
npc.idzi.greet2|Po zmierzchu, tylnymi drzwiami, bez pochodni. Jeśli przyniesiesz latarnię, nie ma rozmowy.|After dusk, back door, no torch. If you bring a lantern, there is no conversation.
npc.idzi.desire|Statek, który wypłynie bez cła, i syn, który nie pójdzie w jego ślady.|A ship that leaves without duty, and a son who will not follow him.
npc.idzi.secret|Syn Idziego służy w straży celnej Bernarda. Każda skrzynia, którą ojciec wnosi, może być tą, którą syn otworzy.|Idzi's son serves in Bernard's customs guard. Every crate the father carries in could be the one his son opens.
npc.rawicz.name|Sierżant Rawicz|Sergeant Rawicz
npc.rawicz.role|Dowódca straży miejskiej|Captain of the city guard
npc.rawicz.address|Wartownia przy bramie północnej|The guardhouse by the north gate
npc.rawicz.greet1|Masz przepustkę albo masz powód. Jedno i drugie na piśmie.|You have a pass or you have a reason. Both in writing.
npc.rawicz.greet2|Widziałem cię wczoraj. Albo przedwczoraj. Pamiętam twarze lepiej niż nazwiska.|I saw you yesterday. Or the day before. I remember faces better than names.
npc.rawicz.desire|Brama zamknięta na noc, zero pożarów i żeby Rycerze przestali brać dziesiątą część jego ludzi.|The gate shut at night, no fires, and for the Knights to stop taking a tenth of his men.
npc.rawicz.secret|Bierze łapówki od Orlika i od Idziego — i donosi na obu do Rycerzy raz na kwartał, żeby zachować równowagę.|He takes bribes from Orlik and from Idzi — and reports both to the Knights once a quarter, to keep the balance.
npc.teodor.name|Ojciec Teodor|Father Teodor
npc.teodor.role|Kapelan kaplicy św. Elenem|Chaplain of St Elenem's chapel
npc.teodor.address|Kaplica przy placu kościelnym|The chapel on the churchyard
npc.teodor.greet1|Nie pytam, co zrobiłeś. Pytam, co zamierzasz zrobić.|I do not ask what you did. I ask what you intend to do.
npc.teodor.greet2|Spowiedź trzy korony. Jałmużna dwa. Cisza za darmo.|Confession three crowns. Alms two. Silence free.
npc.teodor.desire|Żeby relikwiarz wrócił z portu do kaplicy i żeby nikt nie umarł bez księdza przy łóżku.|For the reliquary to come back from the harbour to the chapel, and for nobody to die without a priest at the bed.
npc.teodor.secret|Relikwiarz został sprzedany Idziemu przez kogoś z klasztoru, a Teodor zna to nazwisko i milczy, bo to jego brat.|The reliquary was sold to Idzi by somebody from the abbey, and Teodor knows the name and keeps quiet, because it is his brother.
npc.marta.name|Marta|Marta
npc.marta.role|Kieszonkowiec, piętnaście lat|Pickpocket, fifteen years old
npc.marta.address|Nocleg w zaułku za piekarnią|She sleeps in the alley behind the bakery
npc.marta.greet1|Nie trzymaj sakiewki z tyłu. Z tyłu jest najłatwiej.|Do not keep your purse at the back. The back is easiest.
npc.marta.greet2|Nauczę cię za pięćdziesiąt koron albo za jedną przysługę. Przysługa jest droższa.|I will teach you for fifty crowns or for one favour. The favour costs more.
npc.marta.desire|Jedenaście koron w torebce i tyle samo w zapasie, żeby matka przestała kaszleć w zimnej izbie.|Eleven crowns in a bag and as many in reserve, so her mother stops coughing in a cold room.
npc.marta.secret|Matka Marty pierze bieliznę w wartowni i zna rozkład zmian strażników. Marta wie o tym i jeszcze nie zdecydowała, co z tym zrobić.|Marta's mother washes linen at the guardhouse and knows the guards' shift rotation. Marta knows this and has not decided what to do with it.
npc.goslaw.name|Kartograf Gosław|Goslaw the cartographer
npc.goslaw.role|Kartograf|Cartographer
npc.goslaw.address|Izba nad kancelarią pisarza|A room above the scribe's office
npc.goslaw.greet1|Plan portu czterdzieści koron. Wyspa — dwieście czterdzieści. Rysowałem chodząc, więc kłamie uczciwie.|A harbour plan forty crowns. The island — two hundred forty. I drew it walking, so it lies honestly.
npc.goslaw.desire|Pergamin, który przetrwa wilgoć, i rok bez deszczu, żeby dokończyć wschodnie bagna.|Parchment that survives damp, and a year without rain to finish the eastern marshes.
npc.goslaw.secret|Wschodnie bagna są na jego mapie narysowane bliżej, niż są naprawdę — bo ktoś mu zapłacił, żeby tak było.|The eastern marshes are drawn nearer than they really are — because somebody paid him to draw them that way.
npc.medic.name|Balwierz Marcin|Barber-surgeon Marcin
npc.medic.role|Balwierz i medyk|Barber and medic
npc.medic.address|Gabinet przy łaźni|A surgery by the bathhouse
npc.medic.greet1|Opatrunek dziesięć, szwy osiem, kość dwanaście. Płacisz z góry, bo potem ludzie uciekają.|Dressing ten, stitches eight, a bone twelve. You pay first, because afterwards people run.
npc.medic.desire|Czyste szmaty, czysta woda i żeby ludzie przychodzili wcześniej niż trzeciego dnia.|Clean rags, clean water, and for people to come earlier than the third day.
npc.medic.secret|Nie umie czytać po łacinie. Kupuje gotowe przepisy od Wiery i przepisuje je jako własne.|He cannot read Latin. He buys ready recipes from Wiera and writes them down as his own.
npc.scribe.name|Pisarz Zbylut|Scribe Zbylut
npc.scribe.role|Pisarz miejski|City scribe
npc.scribe.address|Kancelaria przy rynku|An office on the square
npc.scribe.greet1|Notatnik dwanaście koron, pióro trzy, atrament pięć. Umowy piszę za procent.|A notebook twelve crowns, a quill three, ink five. I write contracts for a percentage.
npc.scribe.desire|Atrament, który nie blaknie, i żeby cechy płaciły za papier, na którym pisze ich spory.|Ink that does not fade, and for the guilds to pay for the paper on which he writes their disputes.
npc.scribe.secret|Pisze dla obu stron w sporze cechów i trzyma kopie. Gdyby kopie wyszły na jaw, spalono by kancelarię.|He writes for both sides of the guild dispute and keeps copies. If the copies came to light, the office would burn.
npc.customs.name|Bernard Celny|Bernard of the Customs
npc.customs.role|Poborca celny|Customs collector
npc.customs.address|Urząd celny przy bramie portowej|The customs house by the harbour gate
npc.customs.greet1|Sól dwanaście, zboże piętnaście, futro czterdzieści osiem. Pieczęć kosztuje trzy.|Salt twelve, grain fifteen, fur forty-eight. The seal costs three.
npc.customs.desire|Księga, w której liczby się zgadzają, i rok bez Dzikich Rycerzy na karku.|A ledger whose numbers agree, and a year without the Wild Knights on his back.
npc.customs.secret|W jego księdze brakuje dwudziestu sztuk soli w tym miesiącu. Wie o tym i czeka, aż ktoś inny zostanie oskarżony.|Twenty sacks of salt are missing from his ledger this month. He knows, and he waits for somebody else to be blamed.
npc.guild.name|Rejne Kupiec|Rejne the merchant
npc.guild.role|Kupiec cechowy|Guild merchant
npc.guild.address|Dom cechowy przy rynku|The guild house on the square
npc.guild.greet1|Kupuję uczciwie i sprzedaję drogo. To nie jest sprzeczność, to jest zawód.|I buy honestly and sell dear. That is not a contradiction, that is a trade.
npc.guild.desire|Cło na futra z kontynentu i koniec przemytu, który zjada jego marżę.|A duty on continental furs and an end to the smuggling that eats his margin.
npc.guild.secret|Sam kupuje sól bez cła od Idziego, kiedy cena jest dobra. Nazywa to elastycznością.|He himself buys untaxed salt from Idzi when the price is right. He calls it flexibility.
npc.usurer.name|Lombardzista Mojsze|Mojsze the pawnbroker
npc.usurer.role|Lombardzista|Pawnbroker
npc.usurer.address|Sklep z zakratowanym oknem, zaułek zachodni|A shop with a barred window, west alley
npc.usurer.greet1|Zastaw zostaje u mnie, procent liczy się od dnia. Wykupisz w miesiąc — stracisz trzecią część.|The pledge stays with me, interest counts from the day. Redeem it in a month — you lose a third.
npc.usurer.desire|Spokojna ulica i klienci, którzy wracają.|A quiet street and customers who come back.
npc.usurer.secret|Trzyma w sejfie sygnet jednego z Dzikich Rycerzy — zastawiony, nie wykupiony, z datą sprzed czterech miesięcy.|He keeps a Wild Knight's signet in his safe — pledged, not redeemed, dated four months ago.
npc.baker.name|Piekarz Grzegorz|Grzegorz the baker
npc.baker.role|Piekarz|Baker
npc.baker.address|Piekarnia przy rynku, komin od wschodu|The bakery on the square, chimney on the east
npc.baker.greet1|Bochenek cztery korony, bo młynarz gra w kości, a ja nie gram z nikim.|A loaf four crowns, because the miller plays dice and I play with nobody.
npc.baker.desire|Mąka po starej cenie i piec, który nie pęka w mrozy.|Flour at the old price and an oven that does not crack in the frost.
npc.baker.secret|Dodaje do mąki mielone żołędzie, odkąd zboże zdrożało. Nikt się nie poskarżył, ale wie, że ktoś się poskarży.|He has been adding ground acorns to the flour since grain grew dear. Nobody has complained, but he knows somebody will.
npc.fisher.name|Rybak Ewa|Ewa the fisher
npc.fisher.role|Rybaczka|Fisherwoman
npc.fisher.address|Chatka przy kei wschodniej|A hut by the east pier
npc.fisher.greet1|Sieć dwanaście koron, haczyk dwa. Ryby nie sprzedaję po zmierzchu, bo wtedy nie widzę, komu.|A net twelve crowns, a hook two. I do not sell fish after dusk, because then I cannot see to whom.
npc.fisher.desire|Spokojne morze, cała sieć i żeby port nie śmierdział tak, że ryby odchodzą.|A calm sea, a whole net, and for the harbour not to stink so much that the fish leave.
npc.fisher.secret|Widziała nocą łódź Idziego trzy razy w tym miesiącu. Nie mówi nikomu, bo Idzi płaci jej za milczenie rybą.|She has seen Idzi's boat at night three times this month. She tells nobody, because Idzi pays her for silence in fish.
npc.tanner.name|Garbarz Oles|Oles the tanner
npc.tanner.role|Garbarz|Tanner
npc.tanner.address|Garbarnia za zachodnim zaułkiem|The tannery beyond the west alley
npc.tanner.greet1|Cała skóra czterdzieści osiem, podziurawiona dwadzieścia. Kora dębowa na wagę.|A whole hide forty-eight, a holed one twenty. Oak bark by weight.
npc.tanner.desire|Woda, która nie niesie zarazy, i koniec sporu z cechami o to, gdzie wolno wylewać kadzie.|Water that carries no plague, and an end to the guild argument about where he may empty his vats.
npc.tanner.secret|Wylewa kadzie do strumienia nocą, bo cechy nie zgodziły się na rów. Trzy studnie niżej mają wodę, która pachnie jak on.|He empties his vats into the stream at night because the guilds refused him a drain. Three wells downstream have water that smells like him.
npc.washer.name|Praczka Zofia|Zofia the washerwoman
npc.washer.role|Praczka|Washerwoman
npc.washer.address|Balie przy strumieniu, koło łaźni|Tubs by the stream, near the bathhouse
npc.washer.greet1|Pranie korona, krew na koszuli dwie — bo muszę prać dwa razy.|Washing one crown, blood on a shirt two — because I have to wash it twice.
npc.washer.desire|Mydło, ciepła woda i żeby nikt nie przynosił jej koszul, które trzeba spalić.|Soap, warm water, and for nobody to bring her shirts that ought to be burned.
npc.washer.secret|Pierze bieliznę strażników i wie, kto z nich sypia poza domem. Nie sprzedaje tej wiedzy — jeszcze.|She washes the guards' linen and knows which of them sleeps away from home. She does not sell that knowledge — yet.
npc.stableboy.name|Stajenny Paweł|Paweł the stableboy
npc.stableboy.role|Stajenny|Stableboy
npc.stableboy.address|Stajnia przy karczmie|The stable by the inn
npc.stableboy.greet1|Koń pięć koron za dzień, owies dwa. Nie sprzedaję konia komuś, kto nie umie go utrzymać.|A horse five crowns a day, oats two. I do not sell a horse to someone who cannot hold one.
npc.stableboy.desire|Własny koń i izba bez przeciągu.|A horse of his own and a room without a draught.
npc.stableboy.secret|Śpi w stajni, bo nie ma izby. Kruk wie o tym i nie liczy mu za to czynszu — jeszcze.|He sleeps in the stable because he has no room. Kruk knows and does not charge him rent — yet.
npc.nun.name|Siostra Agnieszka|Sister Agnes
npc.nun.role|Zakonnica z przytułku|Nun of the almshouse
npc.nun.address|Przytułek przy kaplicy|The almshouse by the chapel
npc.nun.greet1|Legowisko w przytułku za jałmużnę. Trzy dni, nie więcej — jest kolejka.|A pallet in the almshouse for alms. Three days, no more — there is a queue.
npc.nun.desire|Pełna spiżarnia przytułku i mniej dzieci, które przychodzą same.|A full almshouse pantry and fewer children who come alone.
npc.nun.secret|Zapisuje nazwiska tych, którzy nie wrócili po swoje rzeczy. W tym roku lista ma jedenaście pozycji.|She writes down the names of those who never came back for their things. This year the list has eleven entries.
npc.beggar.name|Jędrek Kulawy|Lame Jędrek
npc.beggar.role|Żebrak przy bramie|Beggar at the gate
npc.beggar.address|Brama północna, po lewej stronie|North gate, on the left
npc.beggar.greet1|Koronę, panie. Albo pół. Pół korony to bochenek na dwa dni.|A crown, sir. Or half. Half a crown is a loaf for two days.
npc.beggar.desire|But, który nie przemaka, i miejsce przy piecu w zimie.|Boots that do not soak, and a place by the fire in winter.
npc.beggar.secret|Widzi wszystko, co przechodzi przez bramę, i sprzedaje to Rawiczowi za miskę gulaszu raz w tygodniu.|He sees everything that passes the gate and sells it to Rawicz for a bowl of stew once a week.
npc.collector.name|Poborca Kruków|Raven's man
npc.collector.role|Poborca Dzikich Rycerzy|Collector for the Wild Knights
npc.collector.address|Dom z czarnym krukiem nad drzwiami|The house with a black crow over the door
npc.collector.greet1|Dziesiąta część. Od wszystkiego. Gotówką albo w naturze, ja nie wybrzydzam.|A tenth. Of everything. In coin or in kind, I am not fussy.
npc.collector.desire|Kwity podpisane przez wszystkich kupców w mieście i spokój od góry.|Receipts signed by every merchant in town, and quiet from above.
npc.collector.secret|Sam odpisuje dla siebie jedną dziesiątą zebranej dziesiątej. Rycerze jeszcze nie liczyli tak dokładnie.|He skims a tenth of the tenth he collects. The Knights have not counted so carefully yet.
npc.executioner.name|Kat Wawrzyniec|Wawrzyniec the executioner
npc.executioner.role|Kat miejski|City executioner
npc.executioner.address|Dom przy szubienicy, za murami|A house by the gallows, outside the walls
npc.executioner.greet1|Nie podaję ręki. To nie grzeczność, to zwyczaj.|I do not shake hands. It is not manners, it is custom.
npc.executioner.desire|Żeby jego syn nie musiał wykonywać tego zawodu i żeby miasto płaciło za robotę, nie tylko za wynik.|For his son not to have to take up this trade, and for the town to pay for the work, not only for the result.
npc.executioner.secret|Mieszka w domu, który miasto mu dało, i płaci podatek od domu, którego nie może sprzedać. Nikt nie kupi domu kata.|He lives in a house the town gave him and pays tax on a house he cannot sell. Nobody buys an executioner's house.
npc.gamblerDay.name|Cecylia Karta|Cecylia Cards
npc.gamblerDay.role|Krupierka, dzienna zmiana|Dealer, day shift
npc.gamblerDay.address|Karczma Pod Rdzawym Kotem, stolik przy piecu|The Rusty Cat, table by the hearth
npc.gamblerDay.greet1|Kości trzy, karty pięć. Znam każdą plamę na tej talii — nie oszukuj, szkoda twojego czasu.|Dice three, cards five. I know every stain in this deck — do not cheat, it wastes your time.
npc.gamblerDay.desire|Stół, przy którym nikt nie krzyczy, i wieczór, w którym wyjdzie na zero.|A table where nobody shouts, and an evening that ends even.
npc.gamblerDay.secret|Liczy karty dla Marty raz w tygodniu i dostaje za to jedną piątą wygranej. Nie nazywa tego wspólnictwem.|She counts cards for Marta once a week and gets a fifth of the winnings. She does not call it partnership.
npc.gamblerNight.name|Grubas Nikiel|Fat Nickel
npc.gamblerNight.role|Krupier, nocna zmiana|Dealer, night shift
npc.gamblerNight.address|Karczma Pod Rdzawym Kotem, stolik przy oknie|The Rusty Cat, table by the window
npc.gamblerNight.greet1|W nocy stawki są wyższe i twarze są inne. Kości pięć, karty dziesięć.|At night the stakes are higher and the faces are different. Dice five, cards ten.
npc.gamblerNight.desire|Żeby ktoś przegrał na tyle dużo, żeby spłacił jego własny dług u Kruka.|For somebody to lose enough to pay off his own debt to Kruk.
npc.gamblerNight.secret|Jedna z jego kości jest szlifowana od spodu. Nie on ją szlifował — dostał ją w spadku po koledze.|One of his dice is weighted on the underside. He did not weight it — he inherited it from a colleague.
npc.guard.name|Strażnik|Guard
npc.guard.address|Wartownia i patrole przy rynku|The guardhouse and market patrols
npc.guard.greet1|Przechodź albo stój. Trzeciej możliwości nie ma.|Move along or stand still. There is no third option.
npc.guard.greet2|Po zmierzchu ta ulica jest zamknięta. Nie ma przepustki — nie ma przejścia.|After dusk this street is closed. No pass, no way through.
npc.guard.desire|Zmiana bez zdarzeń i gorąca miska na końcu zmiany.|A shift with no incidents, and a hot bowl at the end of it.
npc.guard.secret|Strażnicy noszą groty kute przez Orlika, których nie ma w księdze. Wiedzą, że są nielegalne, i noszą je, bo są dobre.|The guards wear heads forged by Orlik that are in no ledger. They know they are illegal and wear them because they are good.
npc.guardNorth.name|Strażnik bramy północnej|North gate guard
npc.guardNorth.role|Posterunek przy bramie|Post at the gate
npc.guardCustoms.name|Strażnik celny|Customs guard
npc.guardCustoms.role|Posterunek przy urzędzie celnym|Post at the customs house
merchant.baker|Piekarnia Grzegorza|Grzegorz's bakery
merchant.baker.flavor|Bochenek cztery korony. Zapach chleba wychodzi na rynek przed świtem i wraca dopiero wieczorem.|A loaf four crowns. The smell of bread reaches the square before dawn and returns only in the evening.
merchant.smithy|Kuźnia Orlika|Orlik's smithy
merchant.smithy.flavor|Węgiel najpierw, potem rozmowa. Młot bije od piątej do zmierzchu i nie przestaje w deszcz.|Coal first, then talk. The hammer strikes from five until dusk and does not stop for rain.
merchant.tanner|Garbarnia Olesa|Oles's tannery
merchant.tanner.flavor|Skóra czterdzieści osiem, jeśli cała. Zapach czuć z drugiego końca rynku i to jest część ceny.|A hide forty-eight, if whole. The smell carries across the square and that is part of the price.
merchant.fisher|Keja Ewy|Ewa's pier stall
merchant.fisher.flavor|Sieć dwanaście, haczyk dwa. Po zmierzchu nie sprzedaje, bo nie widzi, komu sprzedaje.|A net twelve, a hook two. After dusk she does not sell, because she cannot see to whom.
merchant.tavern|Karczma Pod Rdzawym Kotem|The Rusty Cat inn
merchant.tavern.flavor|Miska sześć, piwo dwa, izba pięć. Kredka tylko dla tych, którzy wracają.|A bowl six, beer two, a room five. A tab only for those who come back.
merchant.medic|Gabinet balwierza|The barber's surgery
merchant.medic.flavor|Opatrunek dziesięć, szwy osiem, kość dwanaście. Płatne z góry.|A dressing ten, stitches eight, a bone twelve. Paid in advance.
merchant.herbalist|Chatka Wiery|Wiera's hut
merchant.herbalist.flavor|Zioła, maści i wiedza, za którą trzeba zapłacić czasem, nie tylko koronami.|Herbs, salves, and knowledge you pay for in time, not only in crowns.
merchant.scribe|Kancelaria Zbyluta|Zbylut's office
merchant.scribe.flavor|Notatnik dwanaście, pióro trzy. Umowy pisze za procent od wartości.|A notebook twelve, a quill three. He writes contracts for a percentage of the value.
merchant.cartographer|Izba Gosława|Goslaw's room
merchant.cartographer.flavor|Plan portu czterdzieści koron, wyspa dwieście czterdzieści. Rysowane chodzeniem, więc kłamie uczciwie.|A harbour plan forty crowns, the island two hundred forty. Drawn by walking, so it lies honestly.
merchant.pawn|Lombard Mojszego|Mojsze's pawnshop
merchant.pawn.flavor|Zastaw zostaje, procent rośnie od dnia. Wykup w miesiąc — tracisz trzecią część.|The pledge stays, interest grows by the day. Redeem in a month — you lose a third.
merchant.guild|Dom cechowy|The guild house
merchant.guild.flavor|Kupuje uczciwie, sprzedaje drogo. Cło, kwity i spory o to, kto płaci za spalone dachy.|Buys honestly, sells dear. Duty, receipts, and the argument over who pays for burnt roofs.
merchant.customs|Urząd celny|The customs house
merchant.customs.flavor|Sól dwanaście, zboże piętnaście, futro czterdzieści osiem. Pieczęć kosztuje trzy korony.|Salt twelve, grain fifteen, fur forty-eight. The seal costs three crowns.
merchant.black|Czarny rynek|The black market
merchant.black.flavor|Towar, którego nie ma w księdze, cena, której nie ma w cenniku, i twarz, której nie ma w pamięci.|Goods in no ledger, prices in no list, and a face in nobody's memory.
place.harbour|Port|The harbour
place.lowerTown|Dolne Miasto|Lower Town
place.marketSquare|Rynek|Market square
place.tanneryYard|Podwórze garbarni|Tannery yard
place.chapelYard|Plac kościelny|Churchyard
place.vagnYard|Dziedziniec Vagna|Vagn's yard
place.piers|Keje|The piers
place.alleyWest|Zachodni zaułek|West alley
place.smugglersGap|Szczelina przemytników|Smugglers' gap
place.northGate|Brama północna|North gate
place.customsGate|Brama celna|Customs gate
station.bar|Szynkwas|The bar
station.forge|Kowadło|The anvil
station.rack|Stojak z towarem|Goods rack
station.chest|Skrzynia|Chest
station.bed|Legowisko|A bed
station.medic|Stół balwierza|The barber's table
station.dice|Stolik do kości|Dice table
station.cards|Stolik do kart|Cards table
station.scribe|Biurko pisarza|The scribe's desk
station.writeDesk|Biurko do pisania|Writing desk
station.hideout|Kryjówka|Hideout
station.hides|Kadzie garbarskie|Tanning vats
station.tanVat|Kadz garbarska|Tanning vat
station.bath|Balie łaźni|Bath tubs
station.altar|Ołtarz|Altar
station.alms|Skrzynka jałmużny|Alms box
station.trainingDummy|Manekin treningowy|Training dummy
station.confiscated|Skonfiskowane towary|Confiscated goods
station.customs|Kontuar celny|Customs counter
station.guardDesk|Biurko straży|Guard desk
station.guildDesk|Kontuar cechu|Guild counter
station.searchCrate|Skrzynia do przeszukania|Crate to search
station.stocks|Dyby|The stocks
station.rackShop|Stojak sklepowy|Shop rack
bld.tavern|Karczma Pod Rdzawym Kotem|The Rusty Cat inn
bld.tavern.sign|Pod Rdzawym Kotem|The Rusty Cat
bld.smithy|Kuźnia|Smithy
bld.smithy.sign|Kuźnia Orlika — węgiel na sprzedaż|Orlik's smithy — coal for sale
bld.scribe|Kancelaria pisarza|The scribe's office
bld.scribe.sign|Zbylut — pismo, umowy, notatniki|Zbylut — writing, contracts, notebooks
bld.customs|Urząd celny|Customs house
bld.customs.sign|Cło i pieczęcie — otwarte do zmierzchu|Duty and seals — open until dusk
bld.chapel|Kaplica św. Elenem|Chapel of St Elenem
bld.abbeyRuin|Ruiny klasztoru|Ruins of the abbey
bld.almshouse|Przytułek|Almshouse
bld.bathhouse|Łaźnia|Bathhouse
bld.fisher|Chatka rybacza|Fisher's hut
bld.guardhouse|Wartownia|Guardhouse
bld.guild|Dom cechowy|Guild house
bld.house|Dom mieszkalny|Dwelling
bld.marta|Zaułek Marty|Marta's alley
bld.shack|Ruina|Shack
bld.tannery|Garbarnia|Tannery
bld.vagn|Dom Vagna|Vagn's house
bld.warehouseA|Magazyn A|Warehouse A
bld.warehouseB|Magazyn B|Warehouse B
int.tavern|Izba karczmy|Inn interior
int.smithy|Kuźnia, środek|Inside the smithy
int.scribe|Kancelaria|The office
int.warehouse|Magazyn|The warehouse
int.chapel|Nawa kaplicy|Chapel nave
int.bath|Łaźnia|The bathhouse
int.customs|Kontuar celny|The customs counter
int.vagn|Izba Vagna|Vagn's room
int.roomJohn|Twoja izba nad stajnią|Your room above the stable
int.guard|Wartownia|The guardhouse
int.guild|Sala cechowa|The guild hall
int.tannery|Hala garbarni|The tannery hall
gate.north.locked|Brama północna zamknięta na noc. Strażnik chce przepustkę albo powód na piśmie.|The north gate is locked for the night. The guard wants a pass or a reason in writing.
sign.title|Szyld|Sign
sign.hint|Przeczytaj|Read
""")

# ===========================================================================
# 7. ZADANIA, TABLICA, ZAKOŃCZENIA, BESTIARIUM
# ===========================================================================
add(r"""
quest.prolog.title|Dzień pierwszy|Day one
quest.prolog.s1|Pomów z Baldwinem Krukiem na kei|Speak to Baldwin Kruk on the pier
quest.prolog.s2|Wejdź do karczmy Pod Rdzawym Kotem|Enter the Rusty Cat inn
quest.prolog.s3|Pomów z Hanną o izbie i o misce|Ask Hanna about a room and a bowl
quest.prolog.journal|Przypłynąłem o świcie. Kruk policzył na palcach trzydzieści dni i dziesięć tysięcy koron. Pierwsze kroki: znać ceny, znać ludzi, nie znać kłopotów.|I landed at dawn. Kruk counted out thirty days and ten thousand crowns on his fingers. First steps: know the prices, know the people, do not know trouble.
quest.prolog.note|Dług jest prawdziwy, bo Kruk ma papier z pieczęcią Rycerzy. Trzydzieści dni. Jeśli nie zapłacę, nie będzie sądu — będzie dziesiąta część z mojej skóry.|The debt is real because Kruk has a paper with the Knights' seal. Thirty days. If I do not pay there will be no trial — there will be a tenth taken from my hide.
quest.vagn.title|Trzy wymiany|Three exchanges
quest.vagn.s1|Znajdź Vagna na dziedzińcu za kuźnią|Find Vagn in the yard behind the smithy
quest.vagn.s2|Przetrwaj trzy wymiany ciosów na manekinie|Survive three exchanges at the dummy
quest.vagn.journal|Vagn powiedział, że trzymam miecz jak chłop z widłami. Pokazał manekin i wiadro z wodą. Trzy wymiany — jeśli go trafię, lekcja za pół ceny.|Vagn said I hold a sword like a peasant holds a pitchfork. He showed me the dummy and the water bucket. Three exchanges — if I touch him, the lesson is half price.
quest.vagn.note|Nauka u Vagna kosztuje korony i czas. Nie ma darmowych lekcji, ale jest manekin, który nie oddaje.|Learning from Vagn costs crowns and time. There are no free lessons, but there is a dummy that does not hit back.
quest.coal.title|Węgiel dla kuźni|Coal for the smithy
quest.coal.s1|Zdobądź trzy bryły węgla|Get three lumps of coal
quest.coal.s2|Zanieś węgiel Orlikowi|Bring the coal to Orlik
quest.coal.journal|Orlik nie wpuści mnie do kowadła bez węgla. Trzy bryły — tyle potrzeba na jeden dzień kucia. Węgiel jest w porcie, u Bernarda, albo bez cła, u Idziego.|Orlik will not let me to the anvil without coal. Three lumps — enough for one day of forging. Coal is at the harbour with Bernard, or untaxed with Idzi.
quest.coal.note|Kupić węgiel z cłem to dwadzieścia cztery korony i czysta księga. Kupić bez cła to osiemnaście koron i cudza tajemnica, którą noszę w plecaku.|Coal with duty is twenty-four crowns and a clean ledger. Coal without duty is eighteen crowns and somebody else's secret in my pack.
quest.coal.hint|Bernard sprzedaje węgiel w urzędzie celnym do zmierzchu. Idzi kupi albo sprzeda po zmroku, w magazynie B.|Bernard sells coal at the customs house until dusk. Idzi will buy or sell after dark, in warehouse B.
quest.salt.title|Dwanaście koron w worze|Twelve crowns a sack
quest.salt.s1|Pomów z Idzim po zmierzchu|Talk to Idzi after dusk
quest.salt.s2|Przenieś wór soli przez miasto|Carry a sack of salt across the town
quest.salt.s3|Omijaj patrole straży|Avoid the guard patrols
quest.salt.s4|Dostarcz sól Rejnemu albo Bernardowi|Deliver the salt to Rejne or to Bernard
quest.salt.journal|Sól z cłem kosztuje dwanaście koron, bez cła — pięć razy tyle dla kogoś, kto ją ma. Idzi mówi, że to najprostsza robota na wyspie: worek, noc, droga bez latarni.|Salt with duty costs twelve crowns; without duty it is worth five times that to whoever holds it. Idzi says it is the simplest work on the island: a sack, a night, a road with no lamps.
quest.salt.note|Wór soli waży osiem kilo. Jeśli straż mnie przeszuka, worek jest dowodem, nie towarem. Bernard wie o brakujących dwudziestu sztukach i czeka, aż kogoś oskarży.|A sack of salt weighs eight kilos. If the guard searches me, the sack is evidence, not goods. Bernard knows about the twenty missing sacks and waits to accuse somebody.
quest.salt.hint|Nocą patrole chodzą parami przy rynku i pojedynczo przy kei. Zaułek zachodni nie ma latarni. Pies przy garbarni szczeka na każdego, kto pachnie solą.|At night patrols go in pairs by the square and singly by the pier. The west alley has no lamps. The dog at the tannery barks at anyone who smells of salt.
quest.marta.title|Jedna przysługa|One favour
quest.marta.s1|Znajdź Martę w zaułku za piekarnią|Find Marta in the alley behind the bakery
quest.marta.s2|Oddaj jej torebkę albo zachowaj ją|Return her satchel or keep it
quest.marta.s3|Przejdź przez plac nie wzbudzając uwagi|Cross the square without drawing attention
quest.marta.s4|Wróć do Marty z odpowiedzią|Go back to Marta with an answer
quest.marta.journal|Marta próbuje mi wyjąć sakiewkę i nie płacze, kiedy ją łapię. Mówi, że nauczy mnie za pięćdziesiąt koron albo za jedną przysługę. Przysługa jest droższa.|Marta tries to lift my purse and does not cry when I catch her. She says she will teach me for fifty crowns or for one favour. The favour costs more.
quest.marta.note|Jej torebka ma jedenaście koron i srebrną zapinkę. Jeśli ją oddam, dowiem się rzeczy, których nie ma w żadnej księdze. Jeśli ją zatrzymam, dowiem się, jakim jestem człowiekiem — i Marta też się dowie.|Her bag holds eleven crowns and a silver clasp. If I return it I will learn things that are in no ledger. If I keep it, I will learn what kind of man I am — and so will Marta.
quest.marta.hint|Marta śpi w zaułku za piekarnią i nie wychodzi przed dziesiątą. Cecylia Karta liczy dla niej raz w tygodniu.|Marta sleeps in the alley behind the bakery and does not come out before ten. Cecylia Cards counts for her once a week.
quest.tab.title|Kredka u Hanny|Hanna's tally
quest.tab.s1|Weź trzy miski gulaszu na kredyt|Take three bowls of stew on the tab
quest.tab.s2|Spłać trzydzieści koron albo znajdź inny sposób|Pay thirty crowns or find another way
quest.tab.s3|Pomów z Hanną o spłacie|Speak to Hanna about settling
quest.tab.journal|Hanna daje kredkę stałym gościom. Trzydzieści koron w nacięciach na deszczułce. Kto ma deskę, ma rację — ale Hanna pamięta każde nacięcie.|Hanna gives a tally to regulars. Thirty crowns in notches on a stick. Whoever holds the stick holds the truth — but Hanna remembers every notch.
quest.tab.note|Kredka to dług bez procentu, ale z pamięcią. Jeśli jej nie spłacę, Hanna przestanie mnie karmić, a cała ulica dowie się, dlaczego.|A tab is a debt without interest but with memory. If I do not pay it, Hanna stops feeding me and the whole street learns why.
bestiary.rat|Szczur portowy|Harbour rat
bestiary.rat.habitat|Magazyny, keje, śmietniki przy karczmie. Ucieka od światła, idzie za zapachem ryby.|Warehouses, piers, the bins by the inn. It runs from light and follows the smell of fish.
bestiary.rat.lore|Marta mówi, że szczur z magazynu B jest wielkości kota i że Idzi dokarmia go celowo. Nikt nie widział tego szczura. Wszyscy o nim mówią.|Marta says the rat in warehouse B is the size of a cat and that Idzi feeds it on purpose. Nobody has seen this rat. Everybody talks about it.
bestiary.dog|Pies łańcuchowy|Chain dog
bestiary.dog.habitat|Garbarnia, dziedziniec kuźni, brama północna. Szczeka na zapach soli i krwi.|The tannery, the smithy yard, the north gate. It barks at the smell of salt and blood.
bestiary.dog.lore|Pies Olesa nie gryzie ludzi, tylko ich zatrzymuje. Trzy razy w roku ktoś próbuje przejść nocą przez podwórze i trzy razy w roku pies wygrywa.|Oles's dog does not bite people, it only stops them. Three times a year somebody tries to cross the yard at night and three times a year the dog wins.
bestiary.crow|Wrona|Crow
bestiary.crow.habitat|Szubienica, ruiny klasztoru, dachy Dolnego Miasta.|The gallows, the abbey ruins, Lower Town roofs.
bestiary.crow.lore|Kat mówi, że wrony przy szubienicy są najedzone i leniwe. Nie chce wyjaśniać, czym są najedzone.|The executioner says the crows at the gallows are full and lazy. He does not want to explain what they are full of.
bestiary.wolf|Wilk|Wolf
bestiary.wolf.habitat|Bagno wschodnie i las za murami. Schodzi do miasta nocą, kiedy mróz trzyma dłużej niż tydzień.|The eastern marsh and the woods beyond the walls. It comes down to town at night when the frost lasts longer than a week.
bestiary.wolf.lore|W 1429 wilki weszły na rynek w biały dzień i wzięły dziecko. Od tamtej zimy brama północna jest zamykana o zmierzchu i nikt nie protestuje.|In 1429 wolves came onto the square in broad daylight and took a child. Since that winter the north gate closes at dusk and nobody protests.
bestiary.boar|Dzik|Boar
bestiary.boar.habitat|Las za murami, dębowe zagajniki. Idzie na wprost, nie skręca.|The woods beyond the walls, oak thickets. It goes straight ahead and does not turn.
bestiary.boar.lore|Vagn uczy, że dzika nie wolno przyjmować na tarczę bokiem — tylko czekać, aż sam się nadzienie. Trzech ludzi w zeszłym roku czekało za krótko.|Vagn teaches that you must not take a boar on the shield sideways — you wait until it gores itself. Three men last year waited too briefly.
bestiary.deer|Jeleń|Deer
bestiary.deer.habitat|Skraj lasu o świcie, łąki za garbarnią. Ucieka na pierwszy szelest.|The woodland edge at dawn, the meadows past the tannery. It runs at the first rustle.
bestiary.deer.lore|Oles płaci czterdzieści osiem koron za całą skórę. Myśliwi Dzikich Rycerzy uważają jelenia za swoją własność i mają na to papier sprzed czterdziestu lat.|Oles pays forty-eight crowns for a whole hide. The Wild Knights' huntsmen consider deer their property and have a forty-year-old paper saying so.
bestiary.horse|Koń|Horse
bestiary.horse.habitat|Stajnia przy karczmie, droga do bramy północnej.|The stable by the inn, the road to the north gate.
bestiary.horse.lore|Paweł mówi, że koń wie, kiedy jeździec się boi. Pięć koron za dzień to cena za to, żeby koń się nie bał razem z tobą.|Paweł says a horse knows when the rider is afraid. Five crowns a day is the price of a horse that is not afraid with you.
bestiary.pike|Szczupak|Pike
bestiary.pike.habitat|Strumień przy łaźni, głębie za keją wschodnią.|The stream by the bathhouse, the depths past the east pier.
bestiary.pike.lore|Ewa łowi szczupaki na sieć, nie na haczyk, i mówi, że szczupak to ryba dla ludzi, którzy mają czas. Wszyscy inni jedzą szprota.|Ewa catches pike with a net, not a hook, and says pike is a fish for people who have time. Everybody else eats sprat.
bestiary.goose|Gęś|Goose
bestiary.goose.habitat|Pastwiska za młynem, brzeg strumienia.|The pastures behind the mill, the stream bank.
bestiary.goose.lore|Gęsi z pastwisk należą do młynarza i młynarz twierdzi, że pilnują one jego obejścia lepiej niż pies. Może ma rację — gęsi są głośniejsze.|The pasture geese belong to the miller, and the miller claims they guard his yard better than a dog. He may be right — geese are louder.
bestiary.yarrow|Krwawnik|Yarrow
bestiary.yarrow.lore|Rośnie przy rowach i na miedzach. Żuty tamuje krew. Wiera odróżnia go od szczwołu po łodydze: krwawnik ma łodygę rowkowaną.|It grows by ditches and field edges. Chewed it staunches blood. Wiera tells it from hemlock by the stem: yarrow's stem is grooved.
bestiary.hemlock|Szczwół plamisty|Spotted hemlock
bestiary.hemlock.lore|Wygląda jak dziki pasternak i jak krwawnik w młodym liściu. Trzy kroki od ścieżki, którą chodzisz codziennie. Nie ma odtrutki — jest tylko czas.|It looks like wild parsnip and like young yarrow. Three paces off a path you walk every day. There is no antidote — only time.
bestiary.chanterelle|Kurka|Chanterelle
bestiary.chanterelle.lore|Pomarańczowa, pachnie morelą, rośnie pod bukiem. Wiera kupuje je na wagę i mówi, że połowa grzybiarzy na wyspie zbiera coś, co wygląda podobnie.|Orange, smelling of apricot, growing under beech. Wiera buys them by weight and says half the mushroom pickers on the island gather something that looks similar.
bestiary.toadstool|Muchomor|Toadstool
bestiary.toadstool.lore|Czerwony w białe kropki. Ładny i bezwartościowy, jeśli chcesz żyć. Chłopi wierzą, że odstrasza szczury — kładą go przy workach ze zbożem.|Red with white spots. Pretty and worthless if you want to live. Peasants believe it drives off rats — they lay it by the grain sacks.
bestiary.willow|Wierzba|Willow
bestiary.willow.lore|Rośnie nad wodą, tam gdzie komary i bagno. Kora żuta łagodzi ból, parzona zbija gorączkę. Wiera zbiera ją w marcu, zanim soki ruszą.|It grows by water, where the midges and the marsh are. Bark chewed eases pain, brewed it lowers fever. Wiera cuts it in March, before the sap runs.
bestiary.knight|Dziki Rycerz|Wild Knight
bestiary.knight.habitat|Dom z czarnym krukiem, patrole nocne, brama celna po zmierzchu.|The house with the black crow, night patrols, the customs gate after dusk.
bestiary.knight.lore|Biorą dziesiątą część wszystkiego i mają papier z pieczęcią. W 1428 weszli do miasta na zaproszenie cechu, żeby stłumić bunt. Nie wyszli. Nikt ich nie prosił o zostanie.|They take a tenth of everything and they have a sealed paper. In 1428 they came into town at the guild's invitation to put down a rising. They did not leave. Nobody asked them to stay.
bestiary.harbour|Port|The harbour
bestiary.harbour.lore|Trzy keje, dwa magazyny i urząd celny. O zmierzchu port zmienia właściciela: za dnia należy do Bernarda, nocą do Idziego. Straż o tym wie i patrzy w drugą stronę, bo patrzy za opłatą.|Three piers, two warehouses and a customs house. At dusk the harbour changes owner: by day it belongs to Bernard, by night to Idzi. The guard knows and looks the other way, for a fee.
bestiary.market|Rynek|The market
bestiary.market.lore|Cztery kramy, tablica ogłoszeń i szubienica w zasięgu wzroku — celowo, żeby cena chleba wydawała się uczciwa. W południe tłum, o zmierzchu pusto, w nocy patrol.|Four stalls, a notice board, and a gallows in sight — deliberately, so the price of bread seems fair. A crowd at noon, empty at dusk, a patrol at night.
bestiary.tannery|Garbarnia|The tannery
bestiary.tannery.lore|Cztery kadzie, strumień i zapach, który czuć z rynku. Cechy od trzech lat spierają się, gdzie Oles może wylewać. Spór trwa, bo nikt nie chce płacić za rów.|Four vats, a stream, and a smell that reaches the square. For three years the guilds have argued where Oles may empty them. The argument lasts because nobody wants to pay for a drain.
bestiary.chapel|Kaplica św. Elenem|Chapel of St Elenem
bestiary.chapel.lore|Mała nawa, ołtarz i skrzynka jałmużny, która jest opróżniana dwa razy w tygodniu. Relikwiarz zniknął cztery miesiące temu i nikt nie złożył skargi na piśmie.|A small nave, an altar, and an alms box emptied twice a week. The reliquary vanished four months ago and nobody filed a written complaint.
bestiary.abbey|Ruiny klasztoru|Ruins of the abbey
bestiary.abbey.lore|Spalony w 1428 podczas buntu. Mury stoją, dachu nie ma, a piwnica podobno jest cała. Podobno — bo nikt, kto tam wszedł, nie wrócił z opowieścią, której da się sprawdzić.|Burned in 1428 during the rising. The walls stand, the roof is gone, and the cellar is said to be intact. Said — because nobody who went in came back with a story that can be checked.
bestiary.gallows|Szubienica|The gallows
bestiary.gallows.lore|Belka dębowa, dwa sznury i tabliczka z nazwiskami. Kat wiesza tu ludzi raz na kwartał, a miasto płaci mu za robotę, nie za wynik — co jest powodem jego jedynej skargi.|An oak beam, two ropes, and a board with names. The executioner hangs people here once a quarter, and the town pays him for the work, not for the result — which is the cause of his only complaint.
bestiary.gap|Szczelina w murze|The gap in the wall
bestiary.gap.lore|Wyrwa w zachodnim murze, szeroka na dwa łokcie, zakryta deską. Idzi twierdzi, że jej nie ma. Bernard twierdzi, że o niej wie. Rawicz twierdzi, że nie ma jej w jego raporcie.|A breach in the west wall, two ells wide, covered by a board. Idzi claims it does not exist. Bernard claims he knows of it. Rawicz claims it is not in his report.
ending.honest|Uczciwy dłużnik|The honest debtor
ending.crime|Człowiek z zaułka|The man from the alley
ending.death|Zapomniany|Forgotten
ending.escape|Ten, który odpłynął|The one who sailed away
ending.knights|Kruk w służbie|A crow in service
ending.overthrow|Koniec dziesiątej części|The end of the tenth
ending.captive|Więzień długu|Prisoner of debt
""")

# ===========================================================================
# 8. TABLICA OGŁOSZEŃ (treść zleceń)
# ===========================================================================
add(r"""
board.debt.title|Wierzyciel szuka dłużnika|A creditor seeks a debtor
board.debt.a|Ktokolwiek widział Pawła ze stajni, winnego mi czterdzieści koron. Nagroda za wskazanie miejsca: dziesięć koron.|Whoever has seen Paweł of the stable, owing me forty crowns. Ten crowns for telling me where he is.
board.debt.b|Płacę gotówką i nie zadaję pytań o to, co dalej zrobię. — Mojsze, lombard, zaułek zachodni|I pay in coin and ask no questions about what I do next. — Mojsze, pawnshop, west alley
board.delivery.title|Dostawa na keję wschodnią|Delivery to the east pier
board.delivery.a|Trzeba przenieść dwie skrzynie z magazynu A na keję wschodnią przed zmierzchem. Waga dwanaście kilo każda. Płatne osiem koron.|Two crates must be carried from warehouse A to the east pier before dusk. Twelve kilos each. Eight crowns paid.
board.delivery.b|Nie pytać o zawartość. Nie otwierać. Nie iść drogą z latarniami.|Do not ask about the contents. Do not open. Do not take the lamp-lit road.
board.delivery.c|Pytać o Idziego w magazynie B po zmroku. — Bosman Idzi|Ask for Idzi in warehouse B after dark. — Bosun Idzi
board.escort.title|Odprowadzenie do bramy północnej|Escort to the north gate
board.escort.a|Kupiec szuka kogoś z bronią, kto odprowadzi wóz do bramy północnej po zmierzchu. Płatne dwadzieścia koron, połowa z góry.|A merchant seeks somebody armed to walk with his cart to the north gate after dusk. Twenty crowns, half in advance.
board.escort.b|Nie chodzi o złodziei. Chodzi o dziesiątą część, której nie chce płacić przy świadkach. — Dom cechowy|It is not about thieves. It is about the tenth, which he does not want to pay in front of witnesses. — Guild house
board.labour.title|Robota przy kadziach|Work at the vats
board.labour.a|Garbarnia potrzebuje dwóch ludzi do przenoszenia skór na jeden dzień. Płatne sześć koron i miska na koniec.|The tannery needs two men to move hides for one day. Six crowns and a bowl at the end.
board.labour.b|Praca śmierdzi i nie da się tego ukryć. Woda jest zimna. — Oles, garbarnia|The work stinks and that cannot be hidden. The water is cold. — Oles, tannery
board.missing.title|Zaginął chłopak z przedmieścia|A boy from the suburbs is missing
board.missing.a|Syn wyszedł po wodę wczoraj o zmierzchu i nie wrócił. Ma piętnaście lat, płaszcz z kapturem i buty z jednym sznurowadłem.|My son went for water at dusk yesterday and did not come back. Fifteen years old, hooded cloak, boots with one lace.
board.missing.b|Nie mam koron. Mam bochenek chleba dziennie dla tego, kto go przyprowadzi. — Przytułek przy kaplicy|I have no crowns. I have a loaf a day for whoever brings him back. — The almshouse by the chapel
board.pests.title|Szczury w magazynie A|Rats in warehouse A
board.pests.a|Cech płaci cztery korony za każde dziesięć ogonów. Skrzynie z ziarnem są przegryzione i to jest ważniejsze niż ogony.|The guild pays four crowns for every ten tails. The grain crates are gnawed through, and that matters more than tails.
board.pests.b|Nie używać ognia w magazynie. Raz już próbowano. — Rejne, dom cechowy|Do not use fire in the warehouse. Somebody already tried. — Rejne, guild house
""")

# ===========================================================================
# 8b. DOKŁADKI: reszta kluczy kodu i danych
# ===========================================================================
add(r"""
int.room|Izba na piętrze|The room upstairs
station.hearth|Palenisko|The hearth
enemy.bandit_weak|Bandyta z zaułka|Alley bandit
enemy.bandit|Bandyta|Bandit
enemy.bandit_boss|Przywódca bandy|Band leader
enemy.drunk|Pijak|Drunkard
enemy.guard|Strażnik miejski|City guard
enemy.knight_squire|Giermek Rycerzy|Knight's squire
npc.greeting.stranger|Nie znam cię. Czego chcesz?|I do not know you. What do you want?
about.title|O grze|About
about.principle|Zasada nadrzędna|The overriding principle
about.principleBody|Wszystko musi mieć uzasadnienie fabularne. Żaden system nie pojawia się z powietrza po naciśnięciu klawisza: każde menu ma swój fizyczny odpowiednik w świecie, a John musi mieć powód, by z niego korzystać.|Everything must have a roleplay justification. No system appears out of thin air on a keypress: every menu has a physical counterpart in the world, and John must have a reason to use it.
about.body|ELENEM v2.0 — dwuwymiarowa gra fabularna w pikselowej oprawie, widok z trzech czwartych z góry. Wyspa Elenem, rok 1430. Pionowy plaster: jedna dzielnica, obsada z rozkładami dnia, trzy zadania, ekwipunek, walka, cykl dnia i nocy, licznik długu i zapis. Cała treść mieszka w plikach JSON, cały tekst w plikach tłumaczeń, a systemy rozmawiają ze sobą magistralą zdarzeń.|ELENEM v2.0 — a two-dimensional role-playing game in pixel art, three-quarter top-down view. The island of Elenem, year 1430. Vertical slice: one district, a cast with daily routines, three tasks, inventory, combat, day-night cycle, a debt counter and saving. All content lives in JSON files, all text in translation files, and the systems talk to each other over an event bus.
console.hello|Konsola debugowania. Wpisz `help`, żeby zobaczyć listę poleceń.|Debug console. Type `help` to list commands.
console.unknown|Nie znam polecenia: {cmd}. Wpisz `help`.|Unknown command: {cmd}. Type `help`.
death.revived|Ocknąłeś się w łaźni. Ktoś przyniósł cię z ulicy i wziął czterdzieści procent twoich pieniędzy.|You came to in the bathhouse. Somebody carried you in from the street and took forty percent of your money.
debt.title|Dług|Debt
debt.creditor|Wierzyciel|Creditor
debt.toWhom|Komu|To whom
debt.daysLeft|Pozostało dni|Days left
debt.interest|Dzienny przyrost|Daily growth
debt.nothing|Nie masz długu. Jeszcze.|You have no debt. Yet.
debt.paid|Spłaciłeś {amount} koron. Pozostało {left}.|You paid {amount} crowns. {left} remains.
debt.payAll|Spłać wszystko ({amount} koron)|Pay it all ({amount} crowns)
debt.payAmount|Zapłać część|Pay part
debt.extended|Kruk przedłużył termin o {days} dni. To będzie kosztowało.|Kruk extended the deadline by {days} days. That will cost.
debt.cleared|Dług spłacony co do korony. Kruk patrzy na ciebie inaczej niż wczoraj.|The debt is paid to the last crown. Kruk looks at you differently than yesterday.
debt.knightsComing|Rycerze przyjdą po swoje. Dziesiąta część to nie prośba.|The Knights will come for theirs. A tenth is not a request.
debt.loanDue|Pożyczka u Mojszego jest wymagalna za {days} dni.|Mojsze's loan falls due in {days} days.
debt.loanTaken|Wziąłeś {amount} koron od Mojszego. Oddasz {total}.|You took {amount} crowns from Mojsze. You will return {total}.
quest.started|Nowe zadanie: {title}|New task: {title}
quest.done|Zadanie wykonane: {title}|Task completed: {title}
quest.failed|Zadanie nieudane: {title}|Task failed: {title}
quest.newObjective|Nowy cel: {what}|New objective: {what}
quest.stationUnlocked|{who} wpuścił cię do stanowiska: {station}|{who} has let you to the station: {station}
quest.teacherUnlocked|{who} zgodził się uczyć|{who} has agreed to teach
""")

# ===========================================================================
# 8c. KALENDARZ (TimeSystem.dateLabel — żadnego twardego tekstu w kodzie)
# ===========================================================================
add(r"""
date.full|{day} {month} {year}|{month} {day}, {year}
month.0|stycznia|January
month.1|lutego|February
month.2|marca|March
month.3|kwietnia|April
month.4|maja|May
month.5|czerwca|June
month.6|lipca|July
month.7|sierpnia|August
month.8|września|September
month.9|października|October
month.10|listopada|November
month.11|grudnia|December
""")

# ===========================================================================
# 8d. DOKŁADKI: regiony map, wyjścia z wnętrz, teksty zakończeń
# ===========================================================================
add(r"""
region.port_dolne_miasto|Port i Dolne Miasto|Harbour and Lower Town
region.island|Wyspa Elenem|The island of Elenem
station.exit|Wyjście|Exit
ending.end_honest.text|Trzydziestego dnia Baldwin Kruk przeliczył monety dwa razy i skinął głową. Dług zamknięty co do korony, kwit podpisany w kancelarii Zbyluta, pieczęć cechu na miejscu. Nie zostałeś bohaterem — zostałeś człowiekiem, któremu można pożyczyć pieniądze. Hanna dała ci kredkę bez słowa, Orlik odkłada dla ciebie lepszy węgiel, a Vagn mówi, że trzymasz miecz jak ktoś, kto chce żyć. Wyspa nie nagradza uczciwości; ona ją tylko zapamiętuje.|On the thirtieth day Baldwin Kruk counted the coins twice and nodded. The debt closed to the last crown, the receipt signed in Zbylut's office, the guild seal in place. You did not become a hero — you became a man who can be lent money. Hanna gives you a tab without a word, Orlik keeps better coal aside for you, and Vagn says you hold a sword like somebody who wants to live. The island does not reward honesty; it only remembers it.
ending.end_crime.text|Dług spłacony, ale nikt nie pyta, skąd miałeś pieniądze. Marta zna twoje kroki, Idzi zna twoje milczenie, a Bernard zna twarz, której nie ma w jego księdze. Rawicz patrzy na ciebie z drugiego strony rynku i nie rusza się z miejsca — bo wie, że gdyby ruszył, znalazłby się w raporcie, którego nikt nie chce podpisać. Spałeś w nocy. To znaczy: spałeś z nożem przy pasie i plecami do ściany, ale spałeś.|The debt is paid, but nobody asks where the money came from. Marta knows your steps, Idzi knows your silences, and Bernard knows a face that is in no ledger of his. Rawicz watches you from across the square and does not move — because he knows that if he did, he would end up in a report nobody wants to sign. You slept at night. That is: you slept with a knife at your belt and your back to the wall, but you slept.
ending.end_escape.text|Statek odszedł o świcie, tak samo jak wtedy, kiedy przypłynąłeś. Tylko że tym razem to ty stałeś na burcie, a wyspa robiła się mniejsza. Dług został na brzegu razem z ludźmi, którym coś obiecałeś. Kruk doliczy ci odsetki do śmierci i wpisze twoje nazwisko na tablicę, którą czyta się na głos przy bramie. Morze jest szerokie i nigdzie nie jest bliżej niż tutaj. Masz całe życie, żeby się przekonać, czy to wystarczy.|The ship left at dawn, just as it did when you arrived. Only this time you stood at the rail and the island grew smaller. The debt stayed on the shore together with the people you promised something to. Kruk will add interest until he dies and write your name on the board that is read aloud at the gate. The sea is wide and nowhere is closer than here. You have a whole life to find out whether that is enough.
ending.end_knights.text|Znak z wyrytym krukiem waży niewiele, a otwiera wszystkie drzwi, których nie chcesz otwierać. Dziesiąta część idzie przez twoje ręce i część z niej zostaje na twoich rękach. Vagn przestał się do ciebie odzywać; Hanna liczy ci miskę jak obcemu, bo jesteś obcy — tylko drożej ubrany. Kruk klepie cię po ramieniu i mówi, że zawsze wiedział. Masz spokój, którego nie da się wydać, i dług, którego nie da się spłacić.|The token with the engraved crow weighs little and opens every door you do not want opened. The tenth passes through your hands and some of it stays on them. Vagn stopped speaking to you; Hanna charges you for a bowl as she would a stranger, because you are a stranger — only better dressed. Kruk pats your shoulder and says he always knew. You have a peace that cannot be spent and a debt that cannot be repaid.
ending.end_overthrow.text|Zaczęło się od tablicy ogłoszeń i jednego zdania wypowiedzianego za głośno przy studni. Potem był cech, potem przytułek, potem brama, której nikt nie zamknął na rozkaz. Dziesiąta część nie została zniesiona żadnym dekretem — po prostu przestano ją płacić, wszyscy naraz, w jednym tygodniu. Kruk wyjechał nocą, a dom z czarnym krukiem nad drzwiami ma teraz nowe drzwi. Nie ma bohatera. Jest czterdziestu ludzi, którzy policzyli to samo co ty.|It began at the notice board and with one sentence said too loudly by the well. Then the guild, then the almshouse, then a gate nobody closed on orders. The tenth was not abolished by any decree — people simply stopped paying it, all at once, in a single week. Kruk left in the night, and the house with the black crow over the door has a new door now. There is no hero. There are forty people who did the same arithmetic you did.
ending.end_death.text|Zaułek, deska, schody — wyspa ma wiele sposobów, żeby z człowieka zrobić wspomnienie. Ktoś zaniósł cię do łaźni albo zostawił przy murze, zależnie od tego, ile miałeś w sakiewce i komu byłeś winien. Kruk doliczył jeszcze trzy dni odsetek, zanim dowiedział się, że nie ma od kogo ich odebrać. Hanna zostawiła miskę na stole do wieczora. Marta zapytała, czy ktoś zabiera twój miecz.|An alley, a plank, a stair — the island has many ways to turn a person into a memory. Somebody carried you to the bathhouse or left you by the wall, depending on how much was in your purse and to whom you owed. Kruk added three more days of interest before he learned there was nobody left to collect from. Hanna left a bowl on the table until evening. Marta asked whether anyone is taking your sword.
ending.end_captive.text|Trzydziestego pierwszego dnia nie było sądu. Był dom z czarnym krukiem nad drzwiami, izba bez okna i księga, w której twoje nazwisko wpisano w kolumnie po lewej stronie — tam, gdzie wpisuje się rzeczy, a nie ludzi. Dług rośnie dalej, tylko że teraz nie masz jak go spłacić, bo spłaca się go pracą. Bernard odwrócił wzrok, kiedy cię prowadzono; Rawicz patrzył uważnie, żeby zapamiętać, kto się odwraca.|On the thirty-first day there was no trial. There was a house with a black crow over the door, a windowless room, and a ledger in which your name was entered in the left-hand column — where things are written, not people. The debt keeps growing, except now you have no way to pay it, because it is paid in labour. Bernard looked away as they led you past; Rawicz watched carefully, to remember who looks away.
""")

# ===========================================================================
# 8e. STATYCZNA OPRAWA HTML (localizeStatic — zero twardych łańcuchów)
# ===========================================================================
add(r"""
ui.docTitle|ELENEM — 1430|ELENEM — 1430
ui.title.logo|ELENEM|ELENEM
ui.title.tagline|Wyspa Elenem · rok 1430 · pionowy plaster|The island of Elenem · year 1430 · vertical slice
ui.title.notes|Notes Johna|John's notebook
ui.title.skills|Wprawa|Skill
ui.title.map|Zwój mapy|Map scroll
ui.title.inv|Sakwa i wyposażenie|Satchel and equipment
ui.title.journal|Dziennik zadań i długów|Journal of tasks and debts
ui.title.trade|Handel|Trade
ui.title.pause|Pauza|Pause
ui.close|Zamknij|Close
ui.leave|Odejdź|Walk away
ui.leaveStall|Odejdź od straganu|Step away from the stall
ui.resume|Wróć do gry|Return to the game
ui.console.placeholder|komendy: help, give notebook, time 22, debt pay 500, spawn bandit, weather rain, tp market|commands: help, give notebook, time 22, debt pay 500, spawn bandit, weather rain, tp market
""")

# ===========================================================================
# 8f. STANOWISKA RZEMIEŚLNICZE (crafting.json)
# ===========================================================================
add(r"""
station.forgeWork|Kowadło Orlika|Orlik's anvil
station.workbench|Warsztat stolarski|Joiner's bench
station.herbTable|Stół zielarki|Herb table
station.kitchenFire|Palenisko w kuchni|Kitchen fire
station.tanningVat|Kadz garbarska|Tanning vat
""")

# ===========================================================================
# 8g. POPRAWKI: teksty dopasowane do parametrów przekazywanych z kodu
#     (sprawdza je tools/i18n/check.py — zero {niepodstawionych} miejsc)
# ===========================================================================
add(r"""
death.revived|Ocknąłeś się w łaźni. Ktoś przyniósł cię z ulicy i wziął {gold} koron za zachód.|You came to in the bathhouse. Somebody carried you in from the street and took {gold} crowns for the trouble.
debt.extended|Kruk przedłużył termin o {days} dni. Nowy termin: dzień {due}. To będzie kosztowało.|Kruk extended the deadline by {days} days. New due day: {due}. That will cost.
debt.loanDue|Pożyczka jest wymagalna: {gold} koron dla {who}.|A loan has fallen due: {gold} crowns to {who}.
debt.loanTaken|Wziąłeś {gold} koron. Termin spłaty: dzień {due}.|You took {gold} crowns. Due on day {due}.
debt.paid|Spłaciłeś {gold} koron. Pozostało {remaining}.|You paid {gold} crowns. {remaining} remains.
debt.payAll|Spłać wszystko ({gold} koron)|Pay it all ({gold} crowns)
debt.payAmount|Zapłać {gold} koron|Pay {gold} crowns
debt.deadlineWarn|Do terminu zostało {days} dni. Kruk już liczy.|{days} days until the deadline. Kruk is already counting.
debt.interestToast|Dług urósł o {gold} koron w jeden dzień.|The debt grew by {gold} crowns in a single day.
pause.hint|Jedyne menu, które nie ma odpowiednika w świecie. {key} wraca do gry.|The only menu with no counterpart in the world. {key} returns to the game.
perk.requires|Wymaga: {skill} poz. {level}, nauczyciel {who}, {gold} koron, {days} dni nauki|Requires: {skill} level {level}, teacher {who}, {gold} crowns, {days} days of study
prolog.debt|{gold} koron długu, {days} dni. Od dziś każdy dzień ma cenę.|{gold} crowns of debt, {days} days. From today every day has a price.
quest.done|Zadanie wykonane: {title} (+{gold} koron)|Task completed: {title} (+{gold} crowns)
quest.failed|Zadanie nieudane: {title} — {reason}|Task failed: {title} — {reason}
quest.failed.deadline|termin minął|the deadline passed
quest.failed.generic|coś poszło nie tak|something went wrong
quest.stationUnlocked|Odblokowano stanowisko: {what}|Station unlocked: {what}
train.started|Zaczynasz naukę: {perk}. Zajmie to {days} dni.|You begin learning: {perk}. It will take {days} days.
""")

# ===========================================================================
# 8h. PLOTKI (wstawiane jako {rumor} w dialogach — muszą brzmieć jak gadanie)
# ===========================================================================
add(r"""
rumor.customsMissing|Mówią, że z urzędu celnego zniknęło dwadzieścia worków soli i że Bernard sam siebie przesłuchuje od tygodnia.|They say twenty sacks of salt walked out of the customs house and that Bernard has been questioning himself for a week.
rumor.johnThreatened|Mówią, że ten nowy z kontynentu straszy ludzi przy bramie. Podobno nie ma przy sobie ani korony, ani manier.|They say the new man from the continent threatens people at the gate. Apparently he has neither a crown on him nor any manners.
rumor.johnBetrayed|Mówią, że ktoś z portu sprzedał kogoś Rycerzom. Idzi nie odzywa się od dwóch dni, a to u niego znaczy dokładnie to, co myślisz.|They say somebody from the harbour sold somebody to the Knights. Idzi has not spoken in two days, which from him means exactly what you think.
rumor.johnLied|Mówią, że ten nowy kłamie w żywe oczy i że raz już go na tym złapano. Podobno nawet się nie zaczerwienił.|They say the new man lies to your face and has already been caught at it once. Apparently he did not even blush.
rumor.guardBullied|Mówią, że straż znów kogoś przetrzymała całą noc bez powodu. Rawicz twierdzi, że to dla porządku, a miasto twierdzi swoje.|They say the guard held somebody all night again for no reason. Rawicz calls it order; the town has its own word for it.
rumor.johnHelped|Mówią, że ten nowy pomógł komuś, kto nie miał mu czym zapłacić. Na tej wyspie to rzadsze niż uczciwy celnik.|They say the new man helped somebody who had nothing to pay him with. On this island that is rarer than an honest customs officer.
rumor.johnOffended|Mówią, że ten nowy obraził kogoś przy studni, przy wszystkich. U nas takie rzeczy pamięta się dłużej niż długi.|They say the new man insulted somebody at the well, in front of everyone. Here such things are remembered longer than debts.
rumor.johnFled|Mówią, że ktoś uciekł przed strażą przez zachodni zaułek. Podobno biegł tak, że zgubił jeden but i całą godność.|They say somebody ran from the guard down the west alley. Apparently he ran so hard he lost one boot and all his dignity.
rumor.crimeSeen|Mówią, że ktoś widział krew na bruku przy garbarni. Straż zmyła ją rankiem, ale bruk pamięta, a ludzie pamiętają lepiej.|They say somebody saw blood on the cobbles by the tannery. The guard washed it off in the morning, but the stone remembers and people remember better.
rumor.execution|Mówią, że kat ma robotę w przyszłym tygodniu i że tabliczka przy szubienicy dostanie nowe nazwisko.|They say the executioner has work next week and that the board by the gallows will get a new name on it.
rumor.plague|Mówią, że w dwóch domach przy północnej bramie ludzie mają gorączkę i plamy. Ksiądz chodzi tam częściej niż medyk.|They say two houses by the north gate have fever and spots. The priest visits them more often than the medic does.
rumor.knightsLevy|Mówią, że Rycerze podnoszą dziesiątą część do ósmej. Nikt nie widział pisma, ale wszyscy widzieli ich ludzi przy wozach.|They say the Knights are raising the tenth to an eighth. Nobody has seen the paper, but everybody has seen their men at the carts.
rumor.shipArrives|Mówią, że do portu wszedł statek z kontynentu. Ceny spadną na dzień albo dwa, potem Bernard je podniesie z powrotem.|They say a ship from the continent has come into the harbour. Prices will drop for a day or two, then Bernard will lift them back.
rumor.martaSatchel|Mówią, że ktoś zabrał torebkę Marcie i że Marta od tamtej pory liczy ludzi, nie korony. Lepiej nie być na tej liście.|They say somebody took Marta's bag and that since then Marta counts people, not crowns. Better not be on that list.
rumor.wolves|Mówią, że wilki znów podeszły pod mury. Od 1428 nikt nie zamyka bramy później niż o zmierzchu i nikt nie dyskutuje.|They say the wolves came up to the walls again. Since 1428 nobody keeps the gate open past dusk and nobody argues.
rumor.abbeyLight|Mówią, że w ruinach klasztoru nocą widać światło. Ojciec Teodor mówi, że to pasterze, a pasterze mówią, że to nie oni.|They say there is a light in the abbey ruins at night. Father Teodor says it is shepherds; the shepherds say it is not them.
""")

# ===========================================================================
# 8i. NOTATNIK — nabycie
# ===========================================================================
add(r"""
notes.acquired|Masz teraz notatnik i pióro. K i G przestały być puste.|You now have a notebook and a quill. K and G are no longer empty.
""")

# ===========================================================================
# 8j. TRZY BROŃ-BRANŻOWE WPRAWY (topór, sztylet, włócznia)
# ===========================================================================
add(r"""
skill.axe|Topór|Axe
skill.axe.desc|Cios z zamachu, który łamie gardę i drzewce. Wolniejszy od miecza, cięższy w skutkach.|A swung blow that breaks guard and haft alike. Slower than a sword, heavier in consequence.
use.axe|Rąbanie|Chopping
skill.dagger|Sztylet|Dagger
skill.dagger.desc|Krótkie ostrze w bliskim zwarciu. Szybkie, chowa się w rękawie, nie zatrzymuje konia.|A short blade in close quarters. Quick, it hides in a sleeve, and it does not stop a horse.
use.dagger|Pchnięcie|A thrust
skill.spear|Włócznia|Spear
skill.spear.desc|Dystans, którego nie ma miecz. Trzyma wroga na długość drzewca, dopóki ktoś nie wejdzie pod grot.|Reach a sword does not have. It keeps an enemy a shaft-length away until somebody steps inside the head.
use.spear|Pchnięcie włócznią|Spear thrust
""")

# ===========================================================================
# 9. ZAPIS I RAPORT POKRYCIA
# ===========================================================================
def write(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')

os.makedirs(OUT, exist_ok=True)
write(os.path.join(OUT, 'pl.json'), PL)
write(os.path.join(OUT, 'en.json'), EN)

print(f'PL: {len(PL)} kluczy -> {OUT}/pl.json')
print(f'EN: {len(EN)} kluczy -> {OUT}/en.json')

def load(p):
    try:
        return [l.strip() for l in open(p, encoding='utf-8') if l.strip()]
    except FileNotFoundError:
        return []

missing = []
for k in load('/tmp/datakeys.txt'):
    if k not in PL:
        missing.append(k)
print(f'\nBrakujące klucze danych: {len(missing)}')
for k in missing[:120]:
    print('  ', k)

code = load('/tmp/codekeys.txt')
dyn = [k for k in code if k.endswith('.')]
static = [k for k in code if not k.endswith('.')]
miss_static = [k for k in static if k not in PL]
print(f'\nKlucze dynamiczne w kodzie (prefiksy): {len(dyn)}')
for k in dyn:
    hits = sum(1 for pk in PL if pk.startswith(k))
    flag = '  OK' if hits else '  BRAK'
    print(f'  {k:<16} {hits:>4}{flag}')
print(f'\nBrakujące klucze statyczne z kodu: {len(miss_static)}')
for k in miss_static:
    print('  ', k)
