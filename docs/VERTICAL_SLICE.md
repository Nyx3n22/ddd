# Vertical slice — Etap 1: „jeden dzień pracy w mieście"

Dokument opisuje, **co dokładnie** zostało zbudowane w tej iteracji, jak to sprawdzić
ręcznie i automatycznie, oraz **czego świadomie nie ma**.

Brief v2.0, §10: Etap 1 ma udowodnić, że pętla „jeden dzień pracy w mieście" działa
i jest przyjemna **sama w sobie**, zanim dołożymy kolejne systemy. Kryterium przejścia
jest więc jakościowe, nie ilościowe.

---

## 1. Wymagania Etapu 1 — stan realizacji

| Wymaganie (brief §10) | Stan | Gdzie to żyje |
|---|---|---|
| Sterowanie | ✅ | `src/core/InputManager.ts`, `src/entities/Player.ts` |
| Jedna dzielnica (~1/40 wyspy) | ✅ 140×112 kafli, 8 regionów | `src/data/world/district_port.json` |
| 5 NPC z dialogami i dobową rutyną | ✅ **28 NPC**, 13 nauczycieli | `src/data/npcs.json`, `src/data/dialogues/{pl,en}.json` |
| 3 zadania | ✅ **6 zleceń** | `src/data/quests.json`, `src/systems/QuestSystem.ts` |
| Ekwipunek | ✅ waga/objętość, warstwy, stan, zużycie | `src/systems/InventorySystem.ts`, `src/data/items.json` |
| Walka | ✅ atak/blok/parowanie/unik, obrażenia warstwowe, skaleczenia, krwawienie | `src/systems/*`, `src/entities/EnemyActor.ts`, `src/data/enemies.json` |
| Cykl dobowy | ✅ fazy dnia, dzwon co godzinę, noc jako ryzyko | `src/core/TimeSystem.ts`, `src/render/Lighting.ts` |
| Licznik długu | ✅ 10 000 / 30 dni, odsetki, raty, poborcy | `src/systems/DebtSystem.ts` |
| Zapis | ✅ pełny stan świata, sloty + autozapis | `src/core/SaveSystem.ts`, `GameState.serialize()` |
| Zasada diegetyczna (§0) | ✅ patrz sekcja 2 | `src/systems/NotesSystem.ts`, `EconomySystem.ts`, `src/world/World.ts` |
| 2D pixel-art, 640×360, kafel 32 px | ✅ skalowanie całkowite | `src/render/Renderer.ts` (`VIEW_W`/`VIEW_H`), `src/render/Art.ts` (`TILE = 32`) |
| Y-sorting obowiązkowy | ✅ wspólna lista obiektów i aktorów | `src/render/Renderer.ts` |
| Chunki + culling | ✅ chunk 16×16, rysowanie tylko widocznych | `src/world/TileMap.ts`, `src/render/Camera.ts` |
| Dane w JSON, zero liczb w kodzie | ✅ 11 plików danych | `src/data/**` |
| Pełna lokalizacja PL/EN | ✅ 1425 kluczy × 2 | `src/data/locales/{pl,en}.json` |
| `Space` = unik, **nie skok** | ✅ | `InputManager.ts` (`dodge: ['Space']`) |
| Konsola dev do testowania zadań | ✅ 43 polecenia | `src/core/DebugConsole.ts` |
| Event-bus, bez ciasnych sprzężeń | ✅ 43 zdarzenia | `src/core/EventBus.ts` |

---

## 2. Interfejsy diegetyczne — jak to działa w praktyce

Każda oprawa ma fizyczny przedmiot. Bez niego klawisz **nie otwiera menu** — John
dostaje komunikat w świecie („nie masz w czym notować"), a nie szary panel.

### `K` — notatnik Johna

- **Źródło w świecie:** kupno u Teodora, skryby (`scribe_shop`) — usługa `contract`/sprzedaż przedmiotu `notebook`.
- **Bez notatnika:** `K` nic nie otwiera, pojawia się toast i wpis w HUD; gracz musi najpierw zarobić i pójść do kantorka.
- **Po kupnie:** `NotesSystem.acquireNotebook()` ustawia `state.notes.owned`, dokłada przedmiot do sakwy, emituje `notes:acquired` i toast.
- **Treść notatnika** (5 zakładek): przyroda i ludzie (bestiariusz: 10 stworzeń, 5 roślin, 7 miejsc), przedmioty, miejsca, zapiski Johna (7), własne wpisy (komenda `note <tekst>` / notowanie przy biurku).
- **Zniszczalność:** zdarzenia `NOTES_DAMAGED` (deszcz, pożar, kradzież) — wpis może zostać utracony, notatnik może zamoknąć.
- **Wpisy nie śmiecą:** `NotesSystem.addEntry()` odrzuca identyfikatory spoza mapy wpisów; surowe id przeciwników i regionów nigdy nie trafiają do notatnika (wpis o psie Olesa pojawia się jako „pies", nie jako `dog`).

### `M` — mapa

- **Źródło w świecie:** zwój kupiony u Gosława, kartografa (`goslaw_maps`).
- **Każda mapa = inny region:** definicja przedmiotu ma pole `mapRegion`; kupno wywołuje `acquireMap()` i odblokowuje podgląd tylko tego regionu.
- **Bez mapy:** widać wyłącznie to, co na ekranie; mgła wojny trzymana jest w `state.maps.visited`.
- **Uzupełnienie:** wskazówki NPC, własne znaczniki, `reveal` w konsoli (narzędzie dev, nie mechanika).

### `G` — wprawa

- **Źródło w świecie:** strona w notatniku → wymaga notatnika.
- **34 umiejętności w 6 gałęziach** rosną **od używania** (`SkillsSystem.use(id, xp)`), nie od punktów.
- **34 perki** odblokowuje **tylko żywy nauczyciel**: trzeba do niego podejść, zapłacić, mieć reputację i wymagany poziom. Nie da się tego zrobić z menu — i to jest celowe.
- Nauczyciele w slice'u: Hanna (gotowanie, warzenie), Orlik (kowalstwo, stolarstwo), Vagn (miecz, parowanie, obuch, bójka, wytrzymałość), Idzi (oszustwo, żegluga, skradanie), Teodor (historia, perswazja), Marta (kieszonkowstwo, wytrychy, cichy krok), skryba Urban (czytanie), medyk Elen (pierwsza pomoc, medycyna), kupiec Zbylut (targowanie), garbarz Oleś (garbarstwo), rybaczka Ewa, piekarz Ignac, Wiera (zioła).

### `J` — dziennik

- **Wyłącznie zapis**: zlecenia (aktywne / ukończone / utracone) i dług (kwota główna, spłacone, termin, dni do terminu, u kogo spłacasz).
- Zero mechaniki pod tym klawiszem — zgodnie z briefem.

### Czynności bez skrótów klawiszowych

| Czynność | Obiekt w świecie | Kto / gdzie | Efekt |
|---|---|---|---|
| Hazard | stół do gry, kubki, kości | karczma Hanny, gracze na placu | stawka, oszukiwanie (`deceit`), ryzyko pobicia |
| Handel | stragan, lada, waga | 13 kupców | kupno/sprzedaż z limitem gotówki kupca |
| Kowalstwo | kowadło, palenisko | kuźnia Orlika | 18 receptur na 5 stanowiskach |
| Leczenie | łoże medyka, opatrunki | medyk Elen | szycie, nastawianie kości, zioła |
| Nauka | nauczyciel | 13 postaci | perki, poziomy |
| Zaciąg | posterunek, arena | straż, Vagn | kontrakt, żołd |
| Sen | łóżko, izba | pokój Johna, karczma (`room`) | przewinięcie czasu, jakość snu |
| Przemyt | wóz, beczka, kryjówka | Idzi, komora celna | towar zakazany, przeszukania |

---

## 3. Zawartość slice'a

**Dzielnica portowa** (`district_port.json`): 140×112 kafli; warstwy `ground`, `water`,
`walls`, `gates`; 8 regionów (przystań, dolne miasto, plac targowy, podwórze garbarza,
dziedziniec kaplicy, podwórze Vagna, mola, zachodnia alejka); 24 budynki (11 z wnętrzami);
124 rekwizyty; 19 lamp; 3 bramy; 2 punkty szybkiej podróży; 4 spawnery.

**Wnętrza** (`interiors.json`): `int_tavern`, `int_smithy`, `int_scribe`, `int_warehouse`,
`int_chapel`, `int_bath`, `int_customs`, `int_vagn`, `int_room_john`, `int_guard`,
`int_guild`, `int_tannery`. Przejście do wnętrza to osobna scena (`World.travel()` z
260 ms przenikania), nie teleport „za kulisami".

**Zlecenia** (6):

| Id | Typ | Zleceniodawca | Sens w świecie |
|---|---|---|---|
| `q_prolog_debt` | `custom` / `debtPaid` | Gwidon, Dzicy Rycerze | główna oś: 10 000 koron w 30 dni |
| `q_coal_for_orlik` | `collect` | Orlik, kowal | węgiel do paleniska — uczciwa dniówka |
| `q_untaxed_salt` | `collect` / `custom` | Idzi | przemyt soli bez akcyzy — ryzyko i zysk |
| `q_marta_satchel` | `talk` / `collect` | Marta | odzyskanie sakiewki, nauka fachu |
| `q_hanna_tab` | `payGold` | Hanna, karczma | dług szynkowy — spłata albo reputacja |
| `q_vagn_respect` | `kill` / `gamble` | Vagn | szacunek podwórza: bójka albo kości |

**Przeciwnicy** (`enemies.json`): stworzenia `wolf`, `boar`, `deer`, `dog`, `crow`, `rat`,
`pike`, `goose`, `horse`, `wildKnight`; ludzie `bandit_weak`, `bandit`, `bandit_boss`,
`drunk`, `guard`, `knight_squire`. Presety trudności `story` / `normal` / `veteran` / `iron`
skalują HP i obrażenia wrogów, obrażenia gracza, okno parowania (0,30 → 0,13 s) i czas
nietykalności uniku (0,32 → 0,16 s).

**Rzemiosło:** 5 stanowisk (`forge`, `workbench`, `tanningRack`, `kitchen`, `brewery`),
18 receptur `r_*` z wymaganym poziomem umiejętności i bazową jakością.

---

## 4. Ręczny scenariusz testowy: jeden dzień pracy

Cel: poczuć pętlę. Przejście zajmuje ~15 minut.

1. **Start.** Nowa gra → John stoi na deskach przystani (`2016, 3216`), statek odpływa. HUD pokazuje porę, dług, sakiewkę, pogodę, miejsce.
2. **Sprawdź, czego nie masz.** Wciśnij `K`, `M`, `G` — gra odmawia i tłumaczy, że John nie ma notatnika ani mapy. To celowe.
3. **Idź do miasta.** `W A S D`, `Shift` bieg (wytrzymałość spada), `Ctrl` skradanie. Przejdź przez plac targowy — postać chowa się za straganem (Y-sorting).
4. **Zarobek dnia.** Podejdź do Orlika (`E`) → dialog → zlecenie `q_coal_for_orlik` → zbierz węgiel → wróć → zapłata. `J` pokazuje kartę zlecenia w dzienniku.
5. **Notatnik.** U Teodora (`E` → `scribe_shop`) kup notatnik i zwój mapy przystani. Teraz `K` i `M` działają, a `G` pokazuje stronę wprawy.
6. **Walka.** Za bramą albo na podwórzu Vagna: `LPM` atak, `PPM` blok (parowanie w oknie czasowym), `Spacja` unik. Sprawdź obrażenia warstwowe i krwawienie; opatrz się bandażem (`Q` → pas) albo idź do medyka Elen.
7. **Popołudnie i handel.** Sprzedaj nadwyżkę kupcowi — zwróć uwagę, że nie ma nieskończonej gotówki. `T` pokazuje godzinę; dzwon wybija pełne godziny.
8. **Wieczór.** `R` zapal pochodnię (zużywa olej). Zmierzch → noc: oświetlenie gaśnie, lampy i okna świecą, rośnie ryzyko.
9. **Hazard.** W karczmie Hanny podejdź do stołu (`E`) → kości. Oszukiwanie wymaga `deceit`; przyłapanie kończy się pobiciem i utratą reputacji.
10. **Spłata długu.** Przy bramie celnej znajdź Gwidona (`E`) → `payGold` / rata. `J` pokazuje zmniejszoną kwotę i dni do terminu.
11. **Sen.** Pokój Johna albo izba w karczmie (`room`) → sen do świtu: dzień +1, zmęczenie 0, wpis jakości snu w notatniku.
12. **Zapis i odczyt.** `ESC` → Zapis → slot. Zmień coś (konsola: `gold 500`, `day 12`) → `load` → stan świata wraca dokładnie taki, jaki był.
13. **Lokalizacja.** Konsola: `lang en` → cała oprawa, dialogi i HUD po angielsku, bez przeładowania gry.

---

## 5. Weryfikacja automatyczna

```bash
npm run verify     # typecheck + i18n:check + build + smoke
```

| Sprawdzenie | Wynik na tej gałęzi |
|---|---|
| `tsc --noEmit` (strict, ES2020) | **0 błędów** |
| `vite build` | OK |
| `tools/i18n/check.py` | 1425 kluczy PL i EN, **0 brakujących kluczy danych**, 141 kluczy z parametrami, **0 niezgodności** |
| `tools/smoke.mjs` (jsdom) | **55 kroków OK, 0 błędów, 0 ostrzeżeń** |

Test dymny przechodzi: rozruch → tytuł → nowa gra → ruch/unik/atak/blok → bramki
diegetyczne `K`/`M`/`G` (odmowa bez przedmiotu, otwarcie po kupnie) → `J`/`I`/`ESC` →
upływ czasu → zlecenia w dzienniku → noc/pochodnia/pogoda → zapis → mutacja → odczyt →
pełna lokalizacja EN → ekran zakończenia → plotki.

Raport: `tools/smoke-report.txt` (w `.gitignore`).

---

## 6. Znane odstępstwa i braki (uczciwie)

| Pozycja | Stan | Uwaga |
|---|---|---|
| Paleta 48–64 barw | ⚠️ **93 barwy** w `Palette.ts` | brief wymaga zawężenia; paleta jest spójna i ciepła, ale do przycięcia (nadmiar odcieni kamienia, skóry i tkanin) |
| Normal mapy + `Light2D` | ❌ brak | oświetlenie jest realizowane ciemnością globalną i źródłami światła rysowanymi na canvasie; normal mapy dojdą wraz z atlasami sprite'ów |
| Animacje 4-kierunkowe | ⚠️ częściowo | postaci mają kierunki i klatki ruchu rysowane proceduralnie; docelowo atlas klatek z plików |
| Atlas sprite'ów z plików | ❌ brak | wszystko rysowane proceduralnie (`Art.ts`, `Characters.ts`, `Buildings.ts`, `Icons.ts`) — zero binariów w repo, ale też zero „ręki artysty" |
| Audio z próbek | ❌ brak | syntezowane proceduralnie w WebAudio; docelowo lira korbowa, flet, lutnia, bęben |
| Jeden region wyspy | ✅ celowo | Etap 1: tylko dzielnica portowa; reszta wyspy to Etap 2+ |
| Weryfikacja wizualna / 60 FPS | ⚠️ do potwierdzenia | w środowisku CI sandboxa brak przeglądarki headless (brak `libnss3`), więc runtime sprawdzamy na jsdom; kadr i płynność do oceny w Live Preview |
| 8-kierunkowe animacje | ❌ | brief: tylko jeśli pozwoli budżet |
| Testy jednostkowe | ❌ | jest test dymny end-to-end; przy migracji do Godota: GUT/gdUnit4 |

---

## 7. Etap 2 — kandydaci

1. Warstwa artystyczna: atlas klatek, normal mapy, zawężenie palety, cienie
2. Kolejne regiony: dolne miasto w całości, wsie, lasy, bagna, kamieniołom, klify, ruiny, obóz Dzikich Rycerzy
3. Systemy z briefu poza Etapem 1: choroby i epidemie, towarzysze i najemnicy, własność i baza, transport (koń, wóz, łódź), polowania, zbieractwo, rybołówstwo, zlecenia proceduralne, losowe wydarzenia
4. Balans pętli ekonomicznej po playtestach (sól 12 → 24 przy blokadzie portu, zioła 30 → 90 przy zarazie)
5. Migracja do Godot 4.x — patrz [`GODOT_MIGRATION.md`](GODOT_MIGRATION.md)
