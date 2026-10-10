# ELENEM — RPG 2D z widokiem z góry, rok 1430

**Gatunek:** RPG 2D, pixel art, rzut 3/4 z góry, immersive sim z elementami przetrwania
**Setting:** średniowiecze, rok 1430, portowe miasto na wyspie Elenem
**Ton:** przyziemny, brudny realizm; magia tylko jako zabobon i plotka
**Stan:** grywalny wycinek (vertical slice): dzielnica portowa i 12 wnętrz

> **Prolog:** John, 36 lat, były najemnik, schodzi ze statku na keję. Ma miecz, 100 koron i 10 000 koron długu u Dzikich Rycerzy — na wpół bandyckiego bractwa, które trzyma wyspę. Na spłatę ma 30 dni.

---

## ▶️ Uruchomienie

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produkcyjny bundle w dist/
npm run verify     # typy + tłumaczenia + test dymny
```

Wymagany Node 18+. Gra działa w przeglądarce, bez wtyczek i bez zewnętrznych assetów — cała grafika i dźwięk są generowane w kodzie.

---

## 🎮 Sterowanie

| Akcja | Klawisz | Uwagi |
|---|---|---|
| Ruch | WASD / strzałki | 8 kierunków |
| Bieg | Shift | zużywa wytrzymałość |
| Skradanie | Ctrl / C | ciszej, wolniej |
| Unik | Spacja | przewrót z krótką nietykalnością |
| Atak | LPM | cios w stronę kursora |
| Blok / parowanie | PPM | blok w pierwszym ułamku sekundy = parowanie |
| Interakcja | E | rozmowa, drzwi, skrzynie, studnia, tablica… |
| Dźwiganie | F | skrzynki, beczki, ciała |
| Pochodnia | R | |
| Pas szybkiego dostępu | Q | |
| Sakwa | I | |
| Dziennik zadań i długu | J | |
| Notatnik / umiejętności | K / G | wymaga notatnika (przedmiot) |
| Mapa | M | wymaga mapy (przedmiot) |
| Zegar | T | dokładnie tylko z zegarkiem |
| Pauza i ustawienia | Esc | |
| Szybki zapis / odczyt | F5 / F9 | wyłączone w trybie hardcore |
| Konsola deweloperska | ` | `help` wypisuje komendy |

Klawisze można zmienić w Esc → Sterowanie. Obsługiwany jest też pad.

---

## 🧭 Zasada projektowa: diegetyczność

To, co widzisz, ma uzasadnienie w świecie gry. Notatnik, mapa i zegarek to przedmioty, które trzeba zdobyć (i które można stracić). Umiejętności rosną z używania, a perków uczą żywi nauczyciele za opłatą. Przestępstwo istnieje tylko wtedy, gdy ktoś je zobaczył.

---

## ⚙️ Systemy

- **Czas i dług** — cykl dnia i nocy, dzwon co godzinę, 30-dniowy termin, raty, odsetki.
- **Potrzeby** — zdrowie, wytrzymałość, głód, pragnienie, zmęczenie, czystość, ciepło.
- **Rany** — obrażenia konkretnych części ciała, krwawienie, choroby, zakażenia.
- **Walka** — kierunkowe ciosy, blok, parowanie z ripostą, unik, kombinacje. Wrogowie sygnalizują atak, a nad rannymi widać pasek zdrowia.
- **Przestępczość** — świadkowie, donosy, poszukiwanie, grzywny i dyby. Straż atakuje dopiero poszukiwanego Johna.
- **Reputacja** — 6 frakcji (straż, Rycerze, cech kupiecki, Kościół, przemytnicy, mieszkańcy) i relacje z każdym NPC.
- **Plotki** — wieści o czynach Johna rozchodzą się z opóźnieniem.
- **Ekonomia** — handel, usługi (pokój, łaźnia, medyk), ceny zależne od reputacji i wydarzeń.
- **Rzemiosło** — kuźnia, warsztat, garbarnia, kuchnia, stół zielarki.
- **Hazard** — kości i karty, z możliwością oszukiwania.
- **Zadania** — 6 fabularnych, codzienne zlecenia z tablicy ogłoszeń i 7 zakończeń.
- **Pogoda** — deszcz, mgła, burza, śnieg, upał, epidemie.
- **NPC** — 28 postaci z rozkładem dnia i dialogami, przechodnie krążący po mieście, zwierzęta, nocne wilki.
- **Zapis** — sloty ręczne, autozapis, tryb hardcore (jedno życie).
- **Dostępność** — skalowanie UI, napisy, wyłączenie błysków i wstrząsów, przełączanie biegu i skradania.
- **Język** — pełna lokalizacja PL i EN.

---

## 🏗️ Architektura

```
src/
  main.ts              punkt wejścia
  core/                pętla gry, stan, czas, wejście, zapis, lokalizacja, audio, konsola
  world/               scena, mapa kafelkowa, ładowanie dzielnicy i wnętrz, logika świata
  entities/            Actor → Player (John), NPCActor, EnemyActor
  systems/             dług, potrzeby, walka/przestępstwa, ekonomia, zadania, dialogi, rzemiosło…
  render/              renderer 2D (bufor 640×360), kamera, światło, pogoda,
                       postacie, zwierzęta, budynki, efekty walki
  ui/                  HUD, nakładki, dialogi
  data/                cała treść gry w JSON: świat, NPC, dialogi, przedmioty,
                       zadania, umiejętności, tłumaczenia
tools/
  smoke.mjs            test dymny bundla w jsdom (rozgrywka krok po kroku)
  i18n/                build.py generuje src/data/locales/*.json; check.py sprawdza parametry
```

- **Renderowanie:** wewnętrzny bufor 640×360 skalowany całkowitą wielokrotnością (ostre piksele), Y-sorting postaci i obiektów, światło mnożone z bufora niskiej rozdzielczości.
- **Komunikacja:** systemy rozmawiają przez `EventBus`, a `Game` tylko je taktuje.
- **Treść:** w kodzie nie ma tekstów widocznych dla gracza — wszystko pochodzi z JSON i tłumaczeń.
- **Tłumaczenia:** edytuj `tools/i18n/build.py`, a potem uruchom `npm run i18n:build`.

---

## 🧪 Konsola deweloperska (`)

Najczęściej używane komendy: `help`, `godmode`, `tp x y`, `scene int_tavern`, `time 22`, `day 10`, `advance 1440`, `weather rain`, `spawn wolf`, `give pocket_watch`, `notebook`, `map`, `quest list`, `rep cityGuard -50`, `wanted 3`, `ending end_honest`, `lang en`.
