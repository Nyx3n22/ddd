# Elenem - Design Document (rozszerzony)

## High Concept
John, były najemnik, 36 lat, dług 10k koron, 30 dni, wyspa Elenem 1430. Brudny realizm, brak magii, decyzje = czas.

## Core Loop
1. Obudź się w karczmie (pokój 5 koron/dzień)
2. Sprawdź czas/dług/pogodę [T]
3. Wybierz zlecenie: legalne (rzemiosło, handel, ochrona, polowanie) vs nielegalne (przemyt, kradzież, zabójstwo)
4. Wykonaj, uwzględniając rutyny NPC, światło/dźwięk, świadków, ekonomię
5. Sprzedaj łup, spłać część długu, zainwestuj w warsztat/konia/informację
6. Śpij — czas leci, plotki się roznoszą, poborcy bliżej

## Ekonomia - przykład
- Sól: baza 12. Blokada portu: 24. Przemyt: kup za 12, sprzedaj za 30, ryzyko 30% przeszukania.
- Kupiec ma 500-1500 koron. Nie skupi 100x sól. Trzeba jeździć.
- Zioła: baza 30. Zaraza: 90. Okazja dla bezwzględnych.

## Przestępczość - flow
1. Kradzież w nocy, gasisz pochodnię, chodzisz po sianie (cicho)
2. NPC śpi (harmonogram), ale może się obudzić jeśli hałas > 0.5
3. Zabierasz przedmiot — flaga `stolen` w ekwipunku
4. Świadek? Jeśli tak, rumor z delay 6-18h
5. Straż: `investigate()` — szansa wykrycia = witnesses*0.2 + evidence*0.15 + wanted*0.3
6. Kary: grzywna (bounty), dyby (reputacja -), więzienie (czas -3 dni!), banicja, śmierć

## Walka - detale
- Stamina 100, regen 15/s po 0.8s delay
- Miecz 15 stamina, 25 dmg, kierunki: góra 1.2x, dół 0.9x, pchnięcie 1.3x
- Parowanie: okno 0.3s, jeśli trafione → stamina -10, brak dmg
- Pancerz: mitigacja flat, np. kaftan 10
- 3 przeciwników = prawie zawsze przegrana — zachęta do skradania/przygotowania

## Zakończenia
1. Uczciwie: dług spłacony, bounty <100, rep wieśniacy >0
2. Przestępczo: dług spłacony, bounty >=100
3. Ucieczka: łódź + sztorm + noc
4. Wstąpienie: rep wildKnights >80
5. Obalenie: cityGuard >70 + villagers >70, quest obalenia
6. Śmierć/niewola: dzień 30, dług <10000

## Tech - streaming
- Chunk 100x100, renderDistance 2, NPC cull <150m
- W pełnej wersji: LOD, occlusion culling, instancing trawy (THREE.InstancedMesh)
- 60 FPS na GTX 1060 / Ryzen 5

## Audio - plan
- Lira korbowa: napięcie rośnie w ostatnich 5 dniach (filtr + tempo)
- Dzwon miejski co godzinę — gracz słyszy czas
- Kroki: drewno, błoto, kamień, siano — wpływa na stealth noiseLevel
