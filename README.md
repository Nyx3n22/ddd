# ELENEM — RPG 3D, otwarty świat, 1430 r.

**Tytuł roboczy:** Elenem  
**Gatunek:** RPG 3D z otwartym światem, immersive sim, survival light, symulacja życia  
**Perspektywa:** FPP z przełączeniem na TPP [C]  
**Setting:** Średniowiecze, rok 1430, wyspa Elenem — port, miasto, wsie, lasy, bagna, kopalnie, klify, ruiny  
**Ton:** Przyziemny, brudny realizm; magia jako zabobon i plotka  
**PEGI:** 16+

> **Prolog:** John, 36 lat, były najemnik o niejasnej przeszłości, przypływa statkiem do portowego miasta na wyspie Elenem. Ma 100 koron i dług 10 000 koron do spłaty w 30 dni u Dzikich Rycerzy — na wpół bandyckiego bractwa rycerskiego kontrolującego wyspę.

---

## ▶️ Uruchomienie

```bash
npm install
npm run dev
# otwórz http://localhost:5173
npm run build
```

**Live Preview:** Projekt działa w przeglądarce, 60 FPS na sprzęcie średniej klasy, świat ciągły bez ekranów ładowania (streaming chunków).

**Rekomendacja technologiczna (wybrana):**
- **Vite + TypeScript + Three.js** — szybki dev, moduły ES, optymalny bundle
- Architektura oparta na zdarzeniach (EventBus)
- Dane w JSON (dialogi, przedmioty, questy, ceny, tłumaczenia)
- Save system serializujący pełny stan świata do localStorage
- Pełna lokalizacja PL/EN przez pliki tłumaczeń

Alternatywy rozważone: Babylon.js (większy overhead), Godot Web (brak pełnej kontroli nad UI), Unity WebGL (ciężki).

---

## 🎮 Sterowanie

| Akcja | Domyślny | Opis |
|-------|----------|------|
| Ruch | WASD | Poruszanie |
| Skok | Spacja | Skok |
| Kucanie/skradanie | CTRL | Przytrzymanie lub przełącznik (opcja) |
| Bieg | Shift | Zużywa wytrzymałość |
| Interakcja | E | NPC, przedmioty, drzwi |
| Chwyt/przeciąganie | F | Ciała i obiekty |
| Atak / blok/parowanie | LPM / PPM | Kierunkowe ataki, parowanie w oknie czasowym |
| Koło szybkiego dostępu | Q | Pochodnia, bandaż, mikstura, broń |
| Latarnia/pochodnia | R | Zapal/zgaś |
| Przełączenie FPP/TPP | C | Kamera |
| Pauza/ustawienia | ESC | |
| Mapa | M | Mgła wojny, znaczniki gracza |
| Drzewko rozwoju | G | Punkty ograniczone, nauczyciele |
| Kompendium | K | Przedmioty, bestiariusz, zadania, zapiski Johna |
| Ekwipunek | I | Waga, jakość, rzemiosło |
| Dziennik zadań | J | Fabularne, poboczne, proceduralne |
| Zegar/kalendarz/dług | T | 30-dniowy kalendarz, licznik |
| Szybkie menu | TAB | Przełączanie zakładek |
| Szybki zapis/wczytanie | F5/F9 | Wyłączone w Hardcore |
| Konsola deweloperska | ~ | Komendy debug |

Wszystkie klawisze w pełni remapowalne w ESC → Ustawienia.

---

## 🧠 Systemy rdzeniowe

### 4.1 Drzewko rozwoju [G]
- Punkty ograniczone — nie da się odblokować wszystkiego.
- Źródła: misje, prace, odkrycia, kompendium, osiągnięcia.
- Gałęzie: Walka, Skradanie i Przestępczość, Rzemiosło, Handel i Perswazja, Przetrwanie, Wiedza.
- Perki wymagają nauczyciela, opłaty i reputacji.
- Wzrost przez używanie (hybryda: praktyka = poziom bazowy, punkty = perki).

### 4.2 Kompendium [K]
1. Przedmioty — zastosowanie, wartość, gdzie kupić/sprzedać
2. Bestiariusz i przyroda — odblokowywane przez obserwację/polowanie/zbieranie/rozmowę
3. Zadania — aktywne/ukończone/utracone
4. Zapiski Johna — przeszłość bohatera

### 4.3 Dialogi
- Każdy NPC ma dialog (2 linijki do rozbudowanych drzew).
- Warunki: Perswazja, Zastraszanie, Kłamstwo, reputacja, przedmioty, kompendium, pora dnia, strój.
- Widoczne zablokowane opcje z wymogiem `[Perswazja 4 — za niski poziom]`.
- Kłamstwa weryfikowane później — konsekwencje.

### 4.4 Mapa i eksploracja [M]
- Ciągła mapa: miasto portowe, wsie, lasy, bagna, kamieniołom, klify, ruiny, obóz Rycerzy.
- Odblokowywanie: przepustka, łapówka, kontakt, wierzchowiec, łódź, klucz, quest.
- Mgła wojny, kupno map u kartografa, wskazówki NPC, własne znaczniki.

---

## ⚙️ 20+ Dodatkowych Systemów (zaimplementowane)

1. **Czas, kalendarz, licznik długu** — cykl dnia/nocy, 30 dni, sen przyspiesza czas, sklepy/questy zależne od pory, ostatnie 5 dni = zaostrzona muzyka, poborcy, zmienione dialogi.
2. **Dynamiczny dług i raty** — spłata częściowa, negocjacje odroczenia, pożyczka u lichwiarza (30% odsetek), zastaw, oszustwo — różne zakończenia.
3. **Reputacja frakcji** — 6 frakcji -100..+100, ceny, questy, reakcje, obszary. Wzrost u jednych = spadek u innych.
4. **Renoma i plotki** — czyny z opóźnieniem (świadek musi dotrzeć), zabicie/przekupienie świadka, NPC komentują strój/majątek/wyczyny.
5. **Przestępczość, śledztwo, kary** — straż nie wie automatycznie. Liczą się świadkowie, ślady krwi, skradziony przedmiot, hałas, światło. Kary: grzywna, dyby, więzienie (utrata dni!), banicja, śmierć. Łapówki, przyznanie, ucieczka, walka.
6. **Dynamiczna ekonomia** — podaż/popyt, pory roku, wydarzenia (blokada portu → sól x2, zaraza → zioła x3). Wykup, przemyt, niszczenie konkurencji. Kupcy mają ograniczoną gotówkę.
7. **Przemyt i czarny rynek** — straż celna, przeszukania, kryjówki w wozach/beczkach, fałszywe dokumenty, towary zakazane (broń, alkohol bez akcyzy, relikwie, trucizny, ludzie).
8. **Rzemiosło** — kowalstwo, alchemia, garbarstwo, stolarstwo, gotowanie, warzenie piwa. Wymaga warsztatu, surowców, przepisu, poziomu. Jakość zależna od umiejętności.
9. **Walka** — stamina, ataki kierunkowe, blok, parowanie w oknie czasowym, zbicie gardy, chwyt. Bronie vs pancerze. 3 przeciwników = wyrok.
10. **Obrażenia lokalizacyjne** — kończyny/tułów/głowa, złamana noga spowalnia, rana ręki osłabia atak, krwotok zabija. Bandaże, szyny, zioła, medyk, łaźnia, blizny komentowane przez NPC.
11. **Potrzeby życiowe** — głód, pragnienie, zmęczenie, czystość jako modyfikatory (brudny = gorsze ceny, niewyspany = gorsze celowanie).
12. **Choroby, zatrucia, epidemie** — zakażone rany, zatrucie pokarmowe, gorączka bagienna, losowa zaraza zmieniająca mapę (kwarantanny, ceny, questy).
13. **Skradanie** — światło/dźwięk, gaszenie pochodni, miękkie podłoże, cień, odwracanie uwagi, wytrychy, kieszonkowstwo, ukrywanie ciał.
14. **Rutyny dobowe NPC** — harmonogram dom/praca/karczma/kościół/sen, obserwacja do planowania kradzieży/zasadzki, reakcje na zmiany (otwarte drzwi, brak towaru, zwłoki).
15. **Relacje, towarzysze, najemnicy** — zaufanie, przyjaźń, romans, sojusz, wrogość, najemnik dzienny, stały towarzysz z celami (może zdradzić).
16. **Własność i baza** — wynajem pokoju, zakup domu/warsztatu/magazynu, skrytka, stojak na broń, łóżko do zapisu, czynsz i podatki co tydzień.
17. **Transport** — konie (wytrzymałość, siodło, karmienie), wozy, łodzie, szybka podróż tylko do odkrytych bezpiecznych punktów kosztem czasu.
18. **Polowania, zbieractwo, rybołówstwo** — tropy, odgłosy, skórowanie, mięso/skóry, zioła/grzyby z ryzykiem pomyłki (kompendium pomaga).
19. **Zlecenia proceduralne** — tablice ogłoszeń, szablony (dostawa, eskorta, szkodniki, dług, zaginiony), losowi zleceniodawcy/lokacje/stawki, mniej opłacalne niż fabularne — siatka bezpieczeństwa.
20. **Losowe wydarzenia** — napady, karawany, wraki po sztormie, pożar, jarmark, egzekucja, procesja, obława, pojedynek. Wagi i cooldowny.
21. **Hazard i minigry** — kości, karty, zapasy, wyścigi konne, rzut podkową, oszukiwanie (umiejętność) i ryzyko pobicia/utraty reputacji.
22. **Pogoda i pory roku** — deszcz, mgła, śnieg, sztorm, upał, wpływ na widoczność/ślady/tropienie/ceny/dostępność morza/zachowanie NPC.
23. **Wiele zakończeń x6** — spłata uczciwie, spłata z przestępstwa, ucieczka z wyspy, wstąpienie do Dzikich Rycerzy, obalenie Rycerzy, śmierć/niewola. Epilog podsumowuje wyspę/frakcje/NPC.
24. **Zapis i trudność** — sloty ręczne, autozapis przy lokacji/queście, Hardcore/Ironman (1 zapis, brak F9, śmierć=koniec), osobne suwaki: walka, ekonomia, przestępczość.
25. **Dostępność** — FOV, skalowanie UI, napisy z tłem/wielkością, daltonizm, wyłączenie migotania/wstrząsów, pełny remapping, suwaki głośności, przytrzymaj/przełącz kucanie/bieg.

---

## 🏗️ Architektura

```
src/
  core/
    EventBus.ts          # szyna zdarzeń — systemy komunikują się bez sprzęgnięcia
    GameState.ts         # centralny stan gry, serializacja
    TimeSystem.ts        # czas, kalendarz, pory roku
    InputManager.ts      # remapowalne klawisze
    SaveSystem.ts        # localStorage, sloty
    Localization.ts      # PL/EN z JSON
    DebugConsole.ts      # konsola ~, komendy dev
  systems/
    DebtSystem.ts, ReputationSystem.ts, RumorSystem.ts, CrimeSystem.ts,
    EconomySystem.ts, WeatherSystem.ts, NeedsSystem.ts, InjurySystem.ts,
    CraftingSystem.ts, CombatSystem.ts, StealthSystem.ts, WorldEvents.ts,
    QuestSystem.ts, OtherSystems.ts (smuggling, disease, NPC schedule, companions, property, transport, hunting, gambling, endings)
  world/
    World.ts             # terrain, lokacje, NPC, chunk streaming, raycast
  player/
    PlayerState.ts       # skills, inventory, equipment
    PlayerController.ts  # FPP/TPP, ruch, grawitacja, pointer lock
  ui/
    UIManager.ts         # HUD, mapy, skill tree, kompendium, ekwipunek, dziennik, zegar, menu, toasty
  data/
    items.json, dialogues.json, quests.json
    translations/pl.json, en.json
```

**EventBus:** Wszystkie systemy emitują/obsługują zdarzenia (`dayChanged`, `debtPaid`, `goldChanged`, `plagueStart`, `randomEvent`, `teleport`, `perspectiveChanged`).

**Dane zewnętrzne:** JSON — dialogi, przedmioty, ceny, questy, eventy, tłumaczenia. Kod tylko interpretuje.

**Save:** `GameState.serialize()` → JSON → localStorage. Zapisuje pozycje NPC, ekonomię, reputacje, flagi questów, dzień/godzinę, majątek.

---

## 🎨 Styl artystyczny i audio (założenia)

- Paleta przygaszona, ziemista: brąz, szarość, zieleń mchu, rdzawa czerwień.
- Architektura: drewno, glina, kamień, strzecha; miasto ciasne i brudne.
- Muzyka: lira korbowa, flet, lutnia, bęben, dynamicznie reagująca na napięcie i licznik dni.
- Dźwięk: kroki po różnych podłożach, rozmowy NPC w tle, dzwon miejski odmierzający godziny.
- W prototypie: Three.js MeshStandardMaterial z vertex colors, mgła, PointLight w lokacjach, cienie PCFSoft.

---

## 🧪 Debug

Konsola [~]:
```
help, teleport x y z, addgold N, setday N, setreputation faction value,
spawn npc, weather [clear|rain|fog|storm|snow], plague, timeScale N,
godmode, quest list, save, load, clear, reputation, event, heal, pos
```

Przyciski dev w ESC → Systemy: +1000 koron, zaraza, losowe zdarzenie, max reputacje.

---

## 📜 Licencja / TODO

- Dodać modele 3D (gltf), animacje, dźwięki
- Rozbudować world streaming o LOD/instancing roślinności
- Multiplayer? Nie — single player immersive sim
- Fabuła: rozwinąć zapiski Johna, 6 zakończeń z epilogiem
- Balans ekonomii i czasu — playtesty

---

**Autor prototypu:** Arena AI Agent  
**Data:** 2026-09-17  
**Branch:** arena/01a0b020-ddd
