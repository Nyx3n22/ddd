# ELENEM — 2D pixel-art RPG, otwarty świat, rok 1430

**Gatunek:** RPG 2D z otwartym światem, immersive sim, survival light, symulacja życia
**Perspektywa:** rzut 3/4 z góry (top-down), pixel-art
**Setting:** średniowiecze, rok 1430, wyspa Elenem — port, miasto, wsie, lasy, bagna, kopalnie, klify, ruiny
**Ton:** przyziemny, brudny realizm; magia jako zabobon i plotka
**PEGI:** 16+

> **Prolog:** John, 36 lat, były najemnik o niejasnej przeszłości, przypływa statkiem do
> portowego miasta na wyspie Elenem. Ma 100 koron i dług **10 000 koron** do spłacenia
> w **30 dni** u Dzikich Rycerzy — na wpół bandyckiego bractwa kontrolującego wyspę.

Ten projekt to **grywalny vertical slice Etapu 1** (brief v2.0, §10): jedna dzielnica
portowa i kompletna pętla „jeden dzień pracy w mieście". Szczegóły zakresu:
[`docs/VERTICAL_SLICE.md`](docs/VERTICAL_SLICE.md). Mapowanie na Godot 4.x:
[`docs/GODOT_MIGRATION.md`](docs/GODOT_MIGRATION.md).

> ⚠️ **Zmiana kierunku (v2.0):** poprzednia wersja była prototypem 3D na Three.js.
> Brief v2.0 odwraca tę decyzję — gra jest **2D pixel-art**. Kod 3D został usunięty
> z `src/` i pozostaje wyłącznie w historii gita (commit `5822bfc`).

---

## ▶️ Uruchomienie

```bash
npm install
npm run dev        # http://localhost:5173
```

Pozostałe polecenia:

| Polecenie | Co robi |
|---|---|
| `npm run build` | produkccyjny build (Vite) do `dist/` |
| `npm run preview` | podgląd builda |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run i18n:keys` | wyciąga klucze z kodu i danych → źródło tłumaczeń |
| `npm run i18n:build` | buduje `src/data/locales/{pl,en}.json` |
| `npm run i18n:check` | audyt: brakujące klucze, klucze danych, parametry `{…}` |
| `npm run smoke` | build + test dymny na jsdom (realny scenariusz rozgrywki) |
| `npm run verify` | **typecheck + i18n:check + build + smoke** — wszystko naraz |

Projekt działa w przeglądarce i w Live Preview; renderowanie na canvasie 2D,
wewnętrzny bufor **640×360** skalowany całkowitą wielokrotnością.

---

## 🎭 Zasada nadrzędna: wszystko ma uzasadnienie fabularne

Najważniejsza reguła briefu (§0). **Żaden system nie pojawia się „z powietrza"
pod klawiszem** — każdy interfejs ma fizyczny przedmiot w świecie i powód, dla
którego John ma do niego dostęp. Złamanie tej zasady = usunięcie lub przeróbka funkcji.

| Klawisz | Co naprawdę otwiera | Skąd John to ma |
|---|---|---|
| `K` | **notatnik Johna** | kupiony u Teodora (skryba). Bez notatnika klawisz nie działa. Notatnik może zaginąć, zamoknąć, spłonąć, zostać skradziony |
| `M` | **zwój mapy** | kupiony u Gosława (kartograf). Każda mapa pokrywa **inny region** — bez niej widzisz tylko to, co na ekranie |
| `G` | **strona wprawy w notatniku** | wymaga notatnika. Perki odblokowuje **tylko żywy nauczyciel**: podejście, zapłata, `E` — nigdy menu |
| `J` | **dziennik zleceń i długu** | wyłącznie zapis. Zero mechaniki rozgrywki pod tym klawiszem |
| `I` | sakwa i ekwipunek | fizyczny dobytek Johna |
| — | hazard, handel, kowalstwo, leczenie, nauka, zaciąg | **bez skrótów klawiszowych**: podejście do stołu / kowadła / medyka / mistrza / areny i `E` |

Zamiast twardych bloków UI są **konsekwencje w świecie**: strażnik pyta o glejt,
brama jest zamknięta, pies pilnuje podwórka, przewoźnik liczy sobie za kurs,
kupiec nie skupi stu worków soli, bo nie ma tyle gotówki.

Każdy NPC ma imię, zawód, dom, plan doby i powód istnienia (żadnego „Villager #12").
Każdą liczbę w grze da się opisać jednym zdaniem po ludzku.

---

## 🎮 Sterowanie

| Akcja | Klawisz | Opis |
|---|---|---|
| Ruch | `W A S D` / strzałki | 4 kierunki, płynna interpolacja |
| Unik / przeskoczenie | `Spacja` | **nie skok** — w rzucie z góry skok nie ma sensu; przewrót, przeskok przez przeszkodę, krótkie klatki nietykalności |
| Skradanie | `Ctrl` / `C` | przytrzymanie lub przełącznik (opcja w ustawieniach) |
| Bieg | `Shift` | zużywa wytrzymałość |
| Interakcja | `E` | NPC, przedmioty, drzwi, stoły, stanowiska, bramy |
| Chwyt / przeciąganie | `F` | ciała i obiekty |
| Atak | `LPM` | kierunek od ruchu/kursora; cel wybierany po bliskości i łuku |
| Blok / parowanie | `PPM` | parowanie w oknie czasowym zależnym od trudności |
| Pas szybkiego dostępu | `Q` | pochodnia, bandaż, broń, narzędzie |
| Pochodnia / latarnia | `R` | zapal / zgaś (zużywa olej) |
| Zegar, kalendarz, dług | `T` | pora dnia, dzień, termin spłaty |
| Notatnik | `K` | wymaga kupionego notatnika |
| Mapa | `M` | wymaga kupionego zwoju mapy danego regionu |
| Wprawa (umiejętności) | `G` | strona w notatniku |
| Dziennik zleceń i długu | `J` | |
| Ekwipunek | `I` | |
| Pauza / ustawienia | `ESC` | zakładki: zapis, ustawienia, sterowanie, statystyki, o grze |
| Szybki zapis / odczyt | `F5` / `F9` | wyłączone na trudności Ironman |
| Konsola deweloperska | `` ` `` | narzędzie, nie część świata |

Wszystkie klawisze są remapowalne (`ESC` → Ustawienia → Sterowanie); mapowanie
trzymane w `localStorage` pod kluczem `elenem.binds.v2`. Obsługiwany jest też gamepad.

---

## 🧩 Co jest w vertical slice

**Dzielnica portowa** (~1/40 wyspy) — `src/data/world/district_port.json`:

- siatka **140 × 112 kafli** (kafel 32 px), chunki 16×16, rysowanie tylko chunków w kadrze
- punkt startowy na deskach przystani (`2016, 3216`), wejście ze statku
- **8 regionów**: przystań, dolne miasto, plac targowy, podwórze garbarza, dziedziniec kaplicy, podwórze Vagna, mola, zachodnia alejka
- **24 budynki** (11 z wnętrzami) + **12 definicji wnętrz** (karczma, kuźnia, składnica, kaplica, łaźnia, komora celna, warsztat Vagna, pokój Johna, posterunek, cech, garbarnia, kantorek skryby)
- **124 rekwizyty**, 19 lamp, 3 bramy, 2 punkty szybkiej podróży, 4 spawnery

**Ludzie i ekonomia:**

- **28 NPC** z imieniem, zawodem, domem, planem doby, nastawieniem i plotkami; **13 z nich uczy** umiejętności
- **13 kupców** z własną ofertą, gotówką i usługami: `contract`, `drink`, `fence`, `hideout`, `meal`, `pass`, `permit`, `room`, `set_bone`, `smuggle`, `stitch`, `treat`
- **6 zleceń** (`q_prolog_debt`, `q_coal_for_orlik`, `q_untaxed_salt`, `q_marta_satchel`, `q_hanna_tab`, `q_vagn_respect`) o typach `talk / collect / kill / gamble / custom / debtPaid / enterInterior / reachArea / payGold`
- **93 przedmioty** w 15 kategoriach, waga i objętość, stan i zużycie, broń z reach, pancerze warstwowe
- **5 stanowisk rzemieślniczych, 18 receptur**, jakość zależna od umiejętności
- hazard: kości, karty, kubki; oszukiwanie jako umiejętność z ryzykiem pobicia

**Postać i walka:**

- **34 umiejętności** w 6 gałęziach (walka, przestępczość, rzemiosło, handel, przetrwanie, wiedza) — rosną **od używania**, nie od punktów
- **34 perki** — wyłącznie od żywego nauczyciela, za opłatą i przy odpowiedniej reputacji
- obrażenia warstwowe (kończyny / tułów / głowa), skaleczenia, krwawienie, opatrunki, szyny, medyk
- **10 stworzeń i 6 typów ludzi** (wilk, dzik, jeleń, pies, wrona, szczur, szczupak, gęś, koń, Dziki Rycerz; bandyta, bandyta-boss, pijak, strażnik, giermek)
- 4 poziomy trudności (`story`, `normal`, `veteran`, `iron`) modyfikujące HP/obrażenia/okno parowania/nietykalność uniku

**Świat i czas:**

- cykl dobowy z fazami (świt, dzień, zmierzch, noc), dzwon miejski co godzinę
- pogoda (bezchmurzenie, pochmurno, deszcz, burza, mgła, śnieg, upał) i jej wpływ na widoczność, ślady, ceny i zachowanie NPC
- oświetlenie: globalna ciemność + źródła światła (lampy, pochodnie, okna, ognie)
- potrzeby: głód, pragnienie, zmęczenie, czystość — jako modyfikatory, nie jako paski do zapełniania
- dług 10 000 koron / 30 dni: odsetki, raty, negocjacje, poborcy, lichwiarz, zastaw
- reputacja 6 frakcji, plotki rozchodzące się z opóźnieniem (świadek musi dojść), przestępstwa i śledztwo, 6 zakończeń

**Notatnik** (fizyczny przedmiot) gromadzi: bestiariusz (10 stworzeń, 5 roślin, 7 miejsc),
przedmioty, miejsca, zapiski Johna (7) i własne wpisy gracza.

---

## 🏗️ Architektura

```
src/
  core/      EventBus · GameState · Game · TimeSystem · InputManager · Localization
             SaveSystem · Settings · RNG · AudioSystem · DebugConsole · gameSingleton
  render/    Palette · Art · Characters · Buildings · Icons · Camera · Lighting
             WeatherParticles · FloatingText · Renderer
  world/     TileMap · Scene · Loaders · World
  entities/  Actor · Player · NPCActor · EnemyActor
  systems/   DialogueSystem · QuestSystem · SkillsSystem · InventorySystem · EconomySystem
             CraftingSystem · GamblingSystem · CrimeSystem · ReputationSystem · RumorSystem
             NeedsSystem · WeatherSystem · DebtSystem · NotesSystem
  ui/        UIManager — wszystkie oprawy diegetyczne
  data/      wyłącznie JSON (patrz niżej)
tools/
  i18n/      keys.py · build.py · check.py
  smoke.mjs  test dymny na jsdom
```

**EventBus.** Systemy nie znają się nawzajem — emitują i nasłuchują **43 zdarzenia**
(`DAY_CHANGED`, `PLAYER_ATTACK`, `SKILL_LEVEL_UP`, `RUMOR_SPREAD`, `CRIME_COMMITTED`,
`TRADE_DONE`, `DEBT_PAID`, `QUEST_ADVANCED`, `NOTES_DAMAGED`, `SLEPT`, `CRAFTED`, …).
To samo w Godocie realizują sygnały — patrz dokument migracji.

**Dane zewnętrzne.** Wszystkie liczby, teksty i definicje żyją w JSON; kod tylko je
interpretuje. Dzięki temu balans i treść zmienia się bez dotykania TypeScriptu.

| Plik | Zawartość |
|---|---|
| `data/world/district_port.json` | siatka, regiony, budynki, rekwizyty, lampy, bramy, spawnery |
| `data/world/interiors.json` | 12 wnętrz |
| `data/npcs.json` | 28 postaci: rutyna, nauczanie, nastawienie, dialog |
| `data/merchants.json` | 13 kupców: oferta, gotówka, usługi |
| `data/dialogues/{pl,en}.json` | drzewa dialogowe z warunkami i efektami |
| `data/items.json` | 93 przedmioty |
| `data/skills.json` | 34 umiejętności, 34 perki, 6 gałęzi, krzywa XP |
| `data/quests.json` | 6 zleceń z etapami |
| `data/crafting.json` | 5 stanowisk, 18 receptur |
| `data/enemies.json` | stworzenia, ludzie, presety trudności |
| `data/bestiary.json` | wpisy notatnika |
| `data/locales/{pl,en}.json` | **1425 kluczy** w każdej wersji |

**Zapis.** `GameState.serialize()` + `World.serialize()` → JSON → `localStorage`
(sloty ręczne + autozapis). Serializowany jest pełny stan świata: czas, pogoda,
pozycje i rutyny NPC, ekwipunek, umiejętności, perki, zlecenia, dług, reputacje,
plotki, notatki, flagi, stan pojemników.

**Lokalizacja.** Zero twardych napisów w kodzie — wszystko przez `t('klucz', {param})`.
Klucze danych (pola `*Key`) są audytowane razem z kluczami UI.

**Determinizm.** `RNG` to mulberry32 z ziarnem (domyślnie `1430`) + `hash2(x, y, seed)`
dla szumu siatki — ten sam seed daje ten sam świat.

**Dźwięk.** Syntezowany proceduralnie w WebAudio (brak plików audio w repozytorium):
kroki po różnych podłożach, uderzenia, dzwon, tłum, wiatr, deszcz.

---

## 🎨 Założenia techniczne i artystyczne

- bufor wewnętrzny **640×360**, skalowanie **całkowitą wielokrotnością** (bez rozmazywania)
- kafel **32×32 px**, postać gracza ~**32×48 px**
- ograniczona ciepła paleta (brązy, szarości, zielenie mchu, rdzawa czerwień, pergamin)
- miękkie cienie w jednym kierunku, **Y-sorting obowiązkowy** — postać wchodzi za budynek, beczkę i stragan
- culling obiektów poza kadrem + rysowanie tylko widocznych chunków
- sprite'y rysowane proceduralnie z jednej palety: ten sam szkielet NPC, wymienne kolory
- docelowo 60 FPS na sprzęcie średniej klasy

---

## 🧪 Narzędzia deweloperskie

**Konsola** (`` ` ``) — 43 polecenia:

```
help · give <itemId> [qty] · take <itemId> [qty] · gold <n> · addgold <n>
debt [pay|set|days|extend] · time <h> [m] · day <n> · advance [min]
weather <clear|cloudy|rain|storm|fog|snow|heat> · plague [on|off]
tp <region|x y> · scene <world|int_x> · quest [list|start|advance|complete|fail]
skill <id> [level] · perk <id> · rep <faction> <n> · rel <npcId> <n>
flag <key> [value] · flags · crime <type> · wanted [0-5] · clear
spawn <npcId|creature|bandit> · kill <npcId> · revive <npcId> · hurt <n> · heal
injure [part] [type] · note <text> · notebook · map · reveal · rumor <key>
ending <id> · lang <pl|en> · stats · fps · save [slot] · load [slot]
seed <n> · npcs · godmode
```

**Test dymny** (`tools/smoke.mjs`) uruchamia grę w jsdom i przechodzi realny scenariusz:
rozruch → nowa gra → ruch, unik, atak, blok → `K`/`M`/`G` odmawiają bez przedmiotu,
a po zakupie notatnika i mapy otwierają się → `J`/`I`/`ESC` → upływ czasu → zlecenia
w dzienniku → noc, pochodnia, pogoda → zapis, mutacja stanu, odczyt → przełączenie
na EN (cała oprawa po angielsku) → ekran zakończenia → plotki.

**Stan weryfikacji na tej gałęzi:**

| Sprawdzenie | Wynik |
|---|---|
| `tsc --noEmit` (strict) | 0 błędów |
| `vite build` | OK |
| `tools/i18n/check.py` | 1425 kluczy PL i EN, 0 braków; 141 kluczy z parametrami, 0 niezgodności |
| `tools/smoke.mjs` | 55 kroków OK, 0 błędów, 0 ostrzeżeń |

---

## 🗺️ Co dalej

1. **Warstwa artystyczna:** animacje 4-kierunkowe postaci (8, jeśli pozwoli budżet), normal mapy pod `Light2D`, atlas sprite'ów z plików zamiast rysowania proceduralnego
2. **Kolejne regiony wyspy:** dolne miasto w całości, wsie, lasy, bagna, kamieniołom, klify, ruiny, obóz Dzikich Rycerzy
3. **Systemy z briefu poza Etapem 1:** choroby i epidemie, towarzysze i najemnicy, własność i baza, transport (koń, wóz, łódź), polowania i rybołówstwo, zlecenia proceduralne, losowe wydarzenia
4. **Balans:** playtesty pętli „jeden dzień pracy", ekonomia soli i ziół, tempo narastania długu
5. **Migracja do Godot 4.x** — plan i mapowanie węzłów: [`docs/GODOT_MIGRATION.md`](docs/GODOT_MIGRATION.md)

---

**Autor prototypu:** Arena AI Agent
**Data:** 2026-09-17
**Branch:** `arena/01a0b049-ddd` · PR #2
