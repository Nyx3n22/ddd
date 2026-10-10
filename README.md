# ELENEM — RPG 2D z widokiem z góry, rok 1430

**Gatunek:** RPG 2D, pixel art, rzut 3/4 z góry, immersive sim z elementami przetrwania
**Setting:** średniowiecze, rok 1430, portowe miasto na wyspie Elenem
**Ton:** przyziemny, brudny realizm; magia tylko jako zabobon i plotka
**Stan:** grywalny wycinek (vertical slice): portowe miasto, las i wieś Brzezina, ponad 50 wnętrz

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
| Pas szybkiego dostępu | Q / 1–4 | 1–4 od razu używa przedmiotu z pasa |
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

## 📜 Fabuła i zakończenia

Prolog prowadzi od Baldwina na kei do karczmy i Hanny. Potem gracz sam wybiera, w które wątki wejdzie:

- **Księga Kruka** — prawda o pożarze w Vranoviu. Odpis księgi długów leży w kantorze celnym (lepiej iść nocą). Księgę można oddać straży, Kościołowi (−3000 długu) albo samemu Baldwinowi (−5000 długu).
- **Rachunek dla Kruka** — spisek z sierżantem Rawiczem: cech, dzwony ojca Teodora, ludzie Vagna i nocne wystąpienie.
- **Ostatni prom** — znak przewozowy od Idziego i łódź na końcu środkowej kei nocą. W sztorm lepiej nie płynąć.
- **Płaszcz Kruka** — przysięga Dzikim Rycerzom zamiast długu.
- **Relikwiarz świętego Elenema** — ruiny opactwa za zachodnim murem. Relikwiarz można oddać albo sprzedać.

**Zadania poboczne (11):** Wataha nad Brzeziną, Koło młyńskie, Łaciata, Czerwona czapka (zaginiony drwal), Skóry bez pieczęci, Pismo do Brzeziny, Sukno dla rady, Zakład Ambrożego, Kaszel Kuby, Trzewiki na zaręczyny i Grób bez imienia (nocą, na cmentarzu przy kaplicy w Brzezinie).

**13 zakończeń:** Uczciwy dłużnik, Mieszczanin, Przy szynkwasie, Człowiek z zaułka, Król portu, Ten, który odpłynął, Morze nie wybacza, Koniec dziesiątej części, Kruk w służbie, Azyl, Na żołdzie straży, Więzień długu i Zapomniany. Tydzień po terminie Rycerze przychodzą po Johna. Epilog opisuje losy frakcji i postaci, a menu główne pokazuje odkryte zakończenia i osiągnięcia.

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
- **Zadania** — 22 zadania (fabularne i poboczne), codzienne zlecenia z tablicy ogłoszeń i 13 zakończeń.
- **Pogoda** — deszcz, mgła, burza, śnieg, upał, epidemie.
- **NPC** — 41 postaci z rozkładem dnia, domem i dialogami (każda opowie o sobie i swoim miejscu), przechodnie krążący po mieście i wsi, zwierzęta, nocne wilki.
- **Świat** — miasto z portem i 7 nowymi kamienicami, 9 chat rybackich, gęsty las (sosny, dęby, paprocie, grzyby) z obozowiskiem drwali i chatą myśliwego, wieś Brzezina z placem, młynem, kaplicą, cmentarzem, polami, ulami i zagrodami. Wóz kursuje między portem, rynkiem i wsią.
- **Wnętrza i meble** — każdy dom urządzony inaczej (rodzinny, biedny, bogaty, tkacki, szewski, rybacki, zielarski): łoża, sienniki, kołyski, kanapy, fotele, krzesła, szafy, kredensy, komody, krosna, kołowrotki, miednice. Na ławach, krzesłach i fotelach da się usiąść, a szafy i komody przeszukać. Małe izby są wyśrodkowane na ekranie.
- **Zapis** — sloty ręczne, autozapis, tryb hardcore (jedno życie).
- **Dostępność** — skalowanie UI, napisy, wyłączenie błysków i wstrząsów, przełączanie biegu i skradania.
- **Język** — pełna lokalizacja PL i EN.
- **Orientacja** — strzałka do celu zadania, minimapa (gdy John ma mapę), imiona nad głowami w kolorze relacji, wóz przewoźnika między rynkiem a portem.
- **Skradanie** — oko widoczności, stożki widzenia straży, „!” nad świadkami, cios z zaskoczenia.
- **Czynności** — łowienie ryb z kei (z haczykiem), odpoczynek na ławkach, modlitwa przy kapliczce, ognisko.
- **Klimat** — mewy, ptaki, motyle, świetliki, cienie chmur, tęcza po deszczu, dymki z kwestiami mieszkańców.
- **Wygoda** — samouczek kontekstowy, 18 osiągnięć, autopauza, autozapis przy zmianie lokacji, dziennik rozmów i karta nowego dnia. Każdy z tych elementów da się wyłączyć w ustawieniach.

---

## 🏗️ Architektura

```
src/
  main.ts              punkt wejścia
  core/                pętla gry, stan, czas, wejście, zapis, lokalizacja, audio, konsola
  world/               scena, mapa kafelkowa, ładowanie dzielnicy i wnętrz, logika świata,
                       zagospodarowanie dzielnicy (WorldDecor: trawa, ścieżki, roślinność)
  entities/            Actor → Player (John), NPCActor, EnemyActor
  systems/             dług, potrzeby, walka/przestępstwa, ekonomia, zadania, dialogi, rzemiosło…
  render/              renderer 2D (bufor 640×360), kamera, światło, pogoda,
                       postacie, zwierzęta, budynki, efekty walki,
                       HUD w świecie (WorldHud), klimat (Ambient)
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

Najczęściej używane komendy: `help`, `godmode`, `tp x y`, `scene int_tavern`, `time 22`, `day 10`, `advance 1440`, `weather rain`, `spawn wolf`, `give pocket_watch`, `notebook`, `map`, `quest list`, `rep cityGuard -50`, `wanted 3`, `ending end_honest`, `lang en`, `talk teodor`, `endinglist`.
