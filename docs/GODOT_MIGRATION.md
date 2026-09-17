# Migracja do Godot 4.x — mapowanie systemów na węzły

Dokument przekłada obecną implementację (Canvas 2D + TypeScript + Vite) na **Godot 4.x**.
Nie jest to „przepisanie gry od zera": **logika, dane i balans zostają**, zmienia się
warstwa prezentacji i sposób montowania scen.

Założenia:

- **Godot 4.3+** (2D, GDScript; C# tylko jeśli zespół woli — mapowanie jest identyczne)
- **Eksport Web (HTML5)** zachowany, żeby projekt nadal działał w Live Preview
- **`src/data/**.json` pozostaje źródłem prawdy** — Godot czyta te same pliki
- Nazwy zdarzeń, identyfikatory i klucze tłumaczeń **nie zmieniają się** (zero pracy przy balansie)

---

## 1. Ustawienia projektu

| Ustawienie (`project.godot`) | Wartość | Dlaczego |
|---|---|---|
| `display/window/size/viewport_width` × `height` | **640 × 360** | bufor wewnętrzny z `Renderer.ts` (`VIEW_W`, `VIEW_H`) |
| `display/window/size/window_width_override` × `height` | 1280 × 720 (lub ×3) | okno na starcie |
| `display/window/stretch/mode` | `viewport` | skalowanie renderu, nie okna |
| `display/window/stretch/aspect` | `keep` | czarne pasy zamiast rozciągania |
| `display/window/stretch/scale_mode` | **`integer`** | brief: skalowanie całkowitą wielokrotnością, bez rozmazywania |
| `rendering/textures/canvas_textures/default_texture_filter` | **`nearest`** | pixel-art bez interpolacji |
| `rendering/2d/snap/snap_2d_transforms_to_pixel` | `true` | brak „pływania" sprite'ów |
| `rendering/2d/snap/snap_2d_vertices_to_pixel` | `true` | jw. |
| `display/window/vsync/vsync_mode` | `enabled` | cel 60 FPS |
| `physics/common/physics_ticks_per_second` | 60 | stały krok symulacji |
| `rendering/environment/defaults/default_clear_color` | `#150f0b` (`PAL.ink0`) | spójne z paletą |

---

## 2. Drzewo sceny głównej

```
Main (Node)                         # ← src/main.ts + src/core/Game.ts
├── World (Node2D, y_sort_enabled)  # ← src/world/World.ts + Scene
│   ├── Ground (TileMapLayer)       # warstwa podłoża: ground/water
│   ├── Objects (Node2D, y_sort)    # budynki, rekwizyty, propsy (Buildings.ts)
│   ├── Actors (Node2D, y_sort)     # Player + NPC + wrogowie
│   ├── Roofs (TileMapLayer)        # dachy nad głową (draw_order / Y-Sort Origin)
│   └── Lights (Node2D)             # PointLight2D: lampy, okna, ognie, pochodnia
├── Player (CharacterBody2D)        # ← src/entities/Player.ts
│   ├── Sprite (AnimatedSprite2D)   # 4 kierunki × klatki
│   ├── Body (CollisionShape2D)
│   ├── InteractArea (Area2D)       # promień E: NPC, drzwi, stoły, rekwizyty
│   ├── HitBox (Area2D)             # cios gracza (łuk + reach broni)
│   ├── HurtBox (Area2D)
│   └── Torch (PointLight2D)        # R = zapal/zgaś
├── Camera (Camera2D)               # ← src/render/Camera.ts: limit, smoothing, deadzone
├── CanvasModulate                  # ← Lighting.ts: globalna ciemność doby/pogody
├── Weather (GPUParticles2D)        # ← WeatherParticles.ts: deszcz, śnieg, mgła
├── HUD (CanvasLayer)               # ← src/ui/UIManager.ts (warstwa nieprzewijana)
│   ├── Vitals, Clock, Debt, Place, Toasts, InteractPrompt
│   └── Overlays (Control)          # K/M/G/J/I/ESC — otwierane tylko z przedmiotem
├── Audio (Node)                    # ← src/core/AudioSystem.ts
│   ├── Music (AudioStreamPlayer)
│   ├── Ambience (AudioStreamPlayer)
│   └── Sfx2D (AudioStreamPlayer2D ×N)
└── Dialogue (CanvasLayer)          # ← src/systems/DialogueSystem.ts
```

> **Godot 4.3+**: `TileMap` został zastąpiony przez wiele węzłów `TileMapLayer`.
> W 4.0–4.2 użyj jednego `TileMap` z warstwami (`layer_0..n`).

---

## 3. Autoloady (singletons) ← `src/core`

Każdy moduł rdzenia staje się autoloadem — dzięki temu zachowujemy globalny dostęp
bez ciasnych sprzężeń (dokładnie tak jak dziś `gameSingleton.ts`).

| Dziś (TS) | Autoload w Godocie | Uwagi |
|---|---|---|
| `core/EventBus.ts` | `EventBus` (Node) | **tylko `signal`** — patrz sekcja 4 |
| `core/GameState.ts` | `GameState` (Node) | stan + `serialize()` / `deserialize()` → `Dictionary` |
| `core/Game.ts` | `Game` (Node) | pętla dnia, kolejność ticków, `advanceDay` tylko z rollovera |
| `core/TimeSystem.ts` | `TimeClock` (Node) | minuta gry na tick; sygnały `minute_tick`, `hour_chime`, `day_changed` |
| `core/InputManager.ts` | **`InputMap`** (wbudowany) + `Binds` (Node) | remap: `InputMap.action_erase_action` / `action_add_event`; zapis w `ConfigFile` |
| `core/Localization.ts` | **`TranslationServer`** (wbudowany) | `tr("klucz")` zamiast `t('klucz')`; parametry: `tr("k").format({})` |
| `core/SaveSystem.ts` | `SaveSystem` (Node) | `FileAccess.open("user://slot1.json", WRITE)` + `JSON.stringify` |
| `core/Settings.ts` | `Settings` (Node) | `ConfigFile` → `user://settings.cfg` |
| `core/RNG.ts` | **`RandomNumberGenerator`** | `seed = 1430`; `hash2(x,y)` → `RandomNumberGenerator` z ziarnem z pary |
| `core/AudioSystem.ts` | `Audio` (Node) + bus layout | patrz sekcja 9 |
| `core/DebugConsole.ts` | `DevConsole` (CanvasLayer) | `LineEdit` + historia; 43 polecenia 1:1 |

---

## 4. `EventBus` → sygnały Godota

Dzisiejsze 43 zdarzenia mapują się bezpośrednio na sygnały w autoloadzie `EventBus`.
Nazwy zostają (snake_case), payload jako `Dictionary` albo typowane argumenty.

```gdscript
# autoload/EventBus.gd
signal minute_tick(day: int, hour: int, minute: int)
signal hour_chime(hour: int, day: int)
signal day_changed(day: int)
signal weather_changed(kind: String, temp: int)
signal player_moved(x: float, y: float)
signal player_attack(actor: Node2D)
signal player_hit(dmg: float, part: String)
signal player_died()
signal item_acquired(item_id: String, qty: int)
signal item_lost(item_id: String, qty: int)
signal gold_changed(amount: int)
signal skill_used(skill_id: String, xp: float)
signal skill_level_up(skill_id: String, level: int)
signal perk_learned(perk_id: String)
signal dialogue_open(node_id: String, npc_id: String)
signal dialogue_close()
signal npc_witnessed(npc_id: String, what: String)
signal rumor_added(key: String, delay_h: float)
signal rumor_spread(key: String)
signal rep_changed(faction: String, delta: int)
signal crime_committed(kind: String, pos: Vector2)
signal guard_alerted(level: int)
signal player_arrested()
signal trade_done(item_id: String, qty: int, price: int, side: String)
signal market_shift(item_id: String, factor: float)
signal debt_paid(amount: int)
signal debt_extended(days: int)
signal collector_visit()
signal quest_started(id: String)
signal quest_advanced(id: String, stage: int)
signal quest_completed(id: String)
signal quest_failed(id: String)
signal note_added(text: String)
signal compendium_entry(kind: String, id: String)
signal notes_damaged(reason: String)
signal interact(target: Dictionary)
signal slept(hours: float, quality: float)
signal crafted(recipe_id: String, quality: float)
signal gamble_played(game: String, stake: int, won: int)
signal world_event(id: String)
signal save_game(slot: String)
signal load_game(slot: String)
signal dev_command(cmd: String)
```

**Kto emituje / nasłuchuje** — bez zmian względem TS:

| Zdarzenie | Emituje | Nasłuchuje |
|---|---|---|
| `day_changed` | `TimeClock` | `Game`, `DebtSystem`, `RumorSystem`, NPC (rutyny), `WeatherSystem` |
| `skill_used` | `SkillsSystem` | HUD, `NotesSystem` (wpisy), `QuestSystem` (typ `custom`) |
| `npc_witnessed` | `CrimeSystem` | `RumorSystem` (opóźnienie 6–18 h) |
| `crime_committed` | `CrimeSystem` | `ReputationSystem`, straż (`guard_alerted`) |
| `trade_done` | `EconomySystem` | `QuestSystem`, `RumorSystem`, `NotesSystem` |
| `notes_damaged` | `NotesSystem` | HUD (toast), `UIManager` |
| `slept` | `Game` | `NeedsSystem`, `QuestSystem`, `NotesSystem` |

---

## 5. Moduł → węzeł / klasa

### Render (`src/render/`)

| Plik | Odpowiednik Godota |
|---|---|
| `Palette.ts` | `Palette.gd` (const Dictionary) + **paleta jako tekstura 1×N** do shadera (swappable palettes) |
| `Art.ts` (`TILE = 32`) | `TileSet` z `tile_size = Vector2i(32, 32)`; atlas z PNG zamiast rysowania proceduralnego |
| `Buildings.ts` | prefabrykowane sceny `Building.tscn` (Node2D + Sprite2D/TileMapLayer + `Area2D` drzwi) albo `MultiMeshInstance2D` dla powtarzalnych brył |
| `Characters.ts` | `SpriteFrames` (atlas klatek, 4 kierunki) + `AnimatedSprite2D`; palety NPC przez `ShaderMaterial` |
| `Icons.ts` | atlas ikon 16×16 (`AtlasTexture`) — 73 ikony już zdefiniowane w danych |
| `Camera.ts` | `Camera2D`: `limit_*`, `position_smoothing_enabled`, `drag_*`, zoom = 1 (skalowanie robi okno) |
| `Lighting.ts` | **`CanvasModulate`** (ciemność doby/pogody) + **`PointLight2D`** (lampy, okna, ogień, pochodnia) + `DirectionalLight2D` dla miękkiego cienia w jednym kierunku |
| `WeatherParticles.ts` | `GPUParticles2D` (deszcz, śnieg, liście) + `ColorRect` z shaderem (mgła, upał) |
| `FloatingText.ts` | `Label`/`RichTextLabel` w `CanvasLayer` z `Tween` (obrażenia, złoto, XP) |
| `Renderer.ts` | **nie ma odpowiednika** — silnik rysuje sam; zostaje tylko kolejność warstw i Y-Sort |

### Świat (`src/world/`)

| Plik | Odpowiednik Godota |
|---|---|
| `TileMap.ts` (chunki 16×16, culling) | `TileMapLayer` — Godot sam robi quadranty/culling; chunki z JSON wczytywane przez `@tool` importer do `TileSet` |
| `Scene.ts` (`Region`, obiekty, `sortedObjects()`) | `World.gd` + `Node2D` z `y_sort_enabled = true`; region jako `Area2D` z `noteId` w metadanych |
| `Loaders.ts` | `FileAccess` + `JSON.parse_string` → instancjowanie scen |
| `World.ts` (interakcje, podróż, loot, łamanie zamków) | `World.gd`: `InteractArea` gracza + `Area2D` obiektów; `travel()` → `SceneTree.change_scene_to_packed` z przenikaniem (`AnimationPlayer` na `CanvasModulate`) |

### Encje (`src/entities/`)

| Plik | Odpowiednik Godota |
|---|---|
| `Actor.ts` (bazowy: HP, stany, obrażenia warstwowe) | `Actor.gd` (klasa bazowa) + `CharacterBody2D` |
| `Player.ts` | `Player.tscn` (`CharacterBody2D`), `_physics_process` = ruch 4-kier, `dodge()` z `Timer`em nietykalności |
| `NPCActor.ts` (rutyny, plotki, nauczanie) | `NPC.tscn` + `Schedule` (harmonogram z `npcs.json`) + `NavigationAgent2D` (ścieżki po `NavigationRegion2D`) |
| `EnemyActor.ts` (AI, loot, wpisy bestiariusza) | `Enemy.tscn` + maszyna stanów (`AnimationTree` / własny FSM); `AStarGrid2D` dla pościgu |

### Systemy (`src/systems/`) — **zostają jako klasy/autoloady, nie węzły sceny**

| Plik | Odpowiednik | Uwaga |
|---|---|---|
| `DialogueSystem.ts` | `DialogueSystem.gd` (autoload) lub addon **Dialogue Manager** | dane z `dialogues/{pl,en}.json`; warunki i efekty bez zmian |
| `QuestSystem.ts` | `QuestSystem.gd` (autoload) + `Quest` jako `Resource` | typy: `talk/collect/kill/gamble/custom/debtPaid/enterInterior/reachArea/payGold` |
| `SkillsSystem.ts` | `SkillsSystem.gd` (autoload) | 34 umiejętności, 34 perki, krzywa `levelXp` |
| `InventorySystem.ts` | `InventorySystem.gd` + `Inventory` (Resource) | kg/litry, warstwy ubioru, stan przedmiotów |
| `EconomySystem.ts` | `EconomySystem.gd` | kupno notatnika → `NotesSystem.acquire_notebook()`; `mapRegion` → `acquire_map()` |
| `CraftingSystem.ts` | `CraftingSystem.gd` + scena `Station.tscn` (`Area2D` + `StaticBody2D`) | 5 stanowisk, 18 receptur |
| `GamblingSystem.ts` | `GamblingSystem.gd` + scena `GambleTable.tscn` | kości/karty/kubki; oszukiwanie = `deceit` |
| `CrimeSystem.ts`, `ReputationSystem.ts`, `RumorSystem.ts` | autoloady | świadkowie, opóźnienia plotek, kary |
| `NeedsSystem.ts`, `WeatherSystem.ts`, `DebtSystem.ts`, `NotesSystem.ts` | autoloady | `Timer` + sygnały |

### UI (`src/ui/UIManager.ts`)

Dziś: jeden manager renderujący wszystkie oprawy do DOM. W Godocie:

```
HUD (CanvasLayer)
├── Vitals (Control)          # Health/Stamina/Hunger/Thirst/Rest/Cleanliness
├── Clock (Control)           # data, pora, pogoda, temperatura
├── DebtBar (Control)
├── Place (Control)
├── Toasts (VBoxContainer)    # hud:toast
├── InteractPrompt (Control)  # „E — porozmawiaj z Orlikiem"
├── Notebook (Control)        # K — 5 zakładek (TabContainer)
├── MapScroll (Control)       # M — TextureRect + warstwa mgły (ShaderMaterial)
├── Skills (Control)          # G — gałęzie jako AccordionList
├── Journal (Control)         # J
├── Satchel (Control)         # I — GridContainer + szczegóły przedmiotu
├── Pause (Control)           # ESC — zakładki
├── Dialogue (Control)        # RichTextLabel (BBCode) + opcje jako Button
└── Gamble / Trade / Craft / Ending (Control)
```

**Bramki diegetyczne w Godocie:**

```gdscript
func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed("notes"):
        if not GameState.notes.owned:
            EventBus.hud_toast.emit(tr("notes.notOwned"), "bad")   # brak menu — brak przedmiotu
            return
        Notebook.open()
```

---

## 6. Dane JSON w Godocie

**Rekomendacja: JSON zostaje źródłem prawdy**, Godot czyta go w runtime.

```gdscript
# autoload/DataStore.gd
var items: Dictionary = {}
func _ready() -> void:
    items = _load("res://data/items.json")["items"]
    for it in items: ItemIndex[it["id"]] = it

func _load(path: String) -> Variant:
    var f := FileAccess.open(path, FileAccess.READ)
    return JSON.parse_string(f.get_as_text())
```

| Dane | Sposób w Godocie |
|---|---|
| `world/district_port.json` | **`@tool` importer** → `TileSet` + sceny budynków/propsów; albo runtime `TileMapLayer.set_cell()` z warstw `ground/water/walls` |
| `world/interiors.json` | jedna scena `Interior.tscn` parametryzowana z JSON (12 wnętrz) |
| `npcs.json` | `Resource` `NPCDef` tworzony z JSON; harmonogram jako tablica `{hour, place}` |
| `merchants.json`, `items.json`, `skills.json`, `crafting.json`, `enemies.json`, `bestiary.json`, `quests.json` | autoload `DataStore` + słowniki indeksowane po `id` |
| `dialogues/{pl,en}.json` | addon Dialogue Manager (import z JSON) albo własny `DialogueSystem.gd` |
| `locales/{pl,en}.json` | **konwersja do CSV/PO** (skrypt w `tools/`) → `TranslationServer` |

Alternatywa: przekonwertować wszystko na `.tres` (`Resource`). Odradzam na tym etapie —
tracimy wspólny format z narzędziami audytu (`tools/i18n/*.py`) i diff w gicie.

---

## 7. Lokalizacja

1. Skrypt (Python lub GDScript `@tool`) zamienia `locales/{pl,en}.json` na `translations.csv`:
   `keys,en,pl`.
2. `Project Settings → Localization → Translations` → dodaj CSV; `locale` domyślne `pl`.
3. `t('klucz', {param})` → `tr("klucz").format({"param": value})` (lub `String.format`).
4. `lang en` z konsoli → `TranslationServer.set_locale("en")` + sygnał `locale_changed`,
   na który HUD i otwarte oprawy przerysowują teksty.
5. Audyt zostaje: `tools/i18n/check.py` dalej działa na JSON-ach (niezależnie od silnika).

---

## 8. Wejście (`InputMap`)

`DEFAULT_BINDS` z `InputManager.ts` → akcje w `project.godot`:

| Akcja Godota | Klawisze | Odpowiednik TS |
|---|---|---|
| `move_up/down/left/right` | `W/S/A/D` + strzałki | jw. |
| `dodge` | `Space` | **unik/przeskok — nie skok** |
| `sneak` | `Ctrl`, `C` | jw. |
| `run` | `Shift` | jw. |
| `interact` | `E` | jw. |
| `grab` | `F` | jw. |
| `attack` | `LPM` | jw. |
| `block` | `PPM` | jw. |
| `quickbelt` / `torch` | `Q` / `R` | jw. |
| `clock` / `notes` / `map` / `skills` / `journal` / `inventory` | `T` / `K` / `M` / `G` / `J` / `I` | jw. |
| `pause` | `Escape` | jw. |
| `quicksave` / `quickload` | `F5` / `F9` | jw. |
| `dev_console` | `` ` `` | jw. |

Remap w grze: `InputMap.action_erase_events(a)` + `action_add_event(a, ev)`, trwałe przez
`ConfigFile` (`Settings`). Gamepad: te same akcje, `InputEventJoypadButton`/`Axis`.
Uwaga: `Space`, `Tab`, `F5`, `F9` muszą być przechwycone (`set_input_as_handled()`),
żeby nie przewijały UI.

---

## 9. Audio

Dziś: **synteza proceduralna w WebAudio** (brak plików). W Godocie dwie drogi:

- **A (zalecana docelowo):** próbki WAV/OGG + `AudioStreamPlayer2D` (kroki po podłożu,
  uderzenia, dzwon) i `AudioStreamPlayer` (muzyka: lira korbowa, flet, lutnia, bęben).
  Bus layout: `Master → Music / SFX / Ambience`, ducking muzyki przy dialogu.
- **B (1:1 z prototypem):** `AudioStreamGenerator` + własny syntezator (szum, obwiednie) —
  przeniesienie `makeNoise()`/oscylatorów; sensowne tylko jako pomost.

---

## 10. Zapis i stan świata

`SaveSystem.ts` pisze `{meta, state, world, settingsLang}` do `localStorage`.
W Godocie: `user://` (w eksporcie Web → IndexedDB przez warstwę silnika).

```gdscript
func save(slot: String) -> void:
    var payload := {
        "meta": meta(slot),
        "state": GameState.serialize(),   # czas, dług, ekwipunek, umiejętności, perki,
                                          # zlecenia, reputacje, plotki, notatki, flagi
        "world": World.serialize(),       # pozycje i stany NPC, pojemniki, bramy, pogoda
        "settings_lang": Settings.data.lang,
    }
    var f := FileAccess.open("user://%s.json" % slot, FileAccess.WRITE)
    f.store_string(JSON.stringify(payload))
```

Zasada bez zmian: **zapis serializuje pełny stan świata**, nie tylko postać. Autozapis
przy zmianie lokacji i przy zleceniu; trudność Ironman = 1 slot, brak `F9`.

---

## 11. Testy

| Dziś | W Godocie |
|---|---|
| `tsc --noEmit` | `godot --headless --check-only --script` + CI z `godot --headless --quit` (łapie błędy parsowania scen) |
| `tools/smoke.mjs` (jsdom, 55 kroków) | **gdUnit4** lub **GUT**: scenariusz przeniesiony 1:1 (boot → nowa gra → ruch/unik/atak → bramki K/M/G → dziennik → noc → zapis/mutacja/odczyt → `lang en` → zakończenie) |
| `tools/i18n/check.py` | **bez zmian** — działa na JSON-ach, niezależnie od silnika |
| Brak testów wizualnych | `--headless --write-movie` / screenshoty scen + porównanie (opcjonalnie `GdUnit4` scene snapshots) |

Uruchomienie: `godot --headless --path . res://tests/run.gd`.

---

## 12. Kolejność migracji (fazy)

| Faza | Zakres | Kryterium ukończenia |
|---|---|---|
| **0** | Projekt, ustawienia okna 640×360 integer-scale, paleta jako `Palette.gd`, `EventBus` z 43 sygnałami | pusta scena skaluje się bez rozmazania; sygnały przechodzą test |
| **1** | `DataStore` + importer świata z `district_port.json` (TileSet, regiony, budynki, propsy, lampy) | dzielnica widoczna, kamera chodzi, Y-Sort działa (postać chowa się za straganem) |
| **2** | `Player` (ruch, bieg, skradanie, unik), `Camera2D`, kolizje, interakcja `E` | przejście z przystani na plac targowy, prompt przy Orliku |
| **3** | Czas, pogoda, oświetlenie (`CanvasModulate` + `PointLight2D`), potrzeby | doba mija, noc jest ciemna, pochodnia świeci, deszcz pada |
| **4** | NPC (rutyny, `NavigationAgent2D`), dialogi, zlecenia, dziennik | 28 NPC chodzi planem doby; 6 zleceń działa od startu do nagrody |
| **5** | Ekwipunek, handel, rzemiosło, hazard, notatnik/mapa/wprawa z bramkami diegetycznymi | `K`/`M`/`G` odmawiają bez przedmiotu i działają po kupnie |
| **6** | Walka (hitboxy, parowanie, obrażenia warstwowe, krwawienie), wrogowie, przestępczość, plotki, dług, zakończenia | pełna pętla „jeden dzień pracy" + 6 zakończeń |
| **7** | Zapis/odczyt, `DevConsole` (43 polecenia), lokalizacja PL/EN, testy gdUnit4, eksport Web | `verify`-equivalent zielony; build Web działa w Live Preview |

Każda faza kończy się **działającą grą**, nie półproduktem — tak jak w prototypie.

---

## 13. Ryzyka i pułapki

| Ryzyko | Mitigacja |
|---|---|
| Proceduralne rysowanie (`Art.ts`, `Characters.ts`, `Icons.ts`) nie ma odpowiednika 1:1 | Faza 1 wymaga atlasów PNG; tymczasem `@tool`-skrypt może wyeksportować obecne sprite'y z canvasu do PNG (jednorazowa konwersja) |
| Paleta 93 barwy vs brief 48–64 | Zawęzić **przed** migracją — inaczej shadery palet będą mieć za dużo wejść |
| `TileMap` w Godocie rysuje warstwy niezależnie od Y-Sort | Dachy i wysokie obiekty na osobnej warstwie z `y_sort_enabled`, albo jako sceny `Node2D` w `Objects` |
| Web export: `localStorage` → IndexedDB, inne limity pamięci | Testować build Web od fazy 1, nie na końcu; autozapis mniejszymi porcjami |
| `localStorage` trzyma też `elenem.binds.v2` | W Godocie: `ConfigFile` w `user://`; migracja starych zapisów nie jest wymagana |
| Determinizm (`RNG` mulberry32, `hash2`) | `RandomNumberGenerator.seed` + własna implementacja `hash2` — inaczej świat wygeneruje się inaczej niż w prototypie |
| WebAudio (proceduralne audio, `setTargetAtTime`) | Patrz sekcja 9 — w Godocie najprościej przejść od razu na próbki |
| jsdom-owy test dymny nie przenosi się dosłownie | Scenariusz (kroki i asercje) przenosimy, API nie; gdUnit4 ma `await` na sygnały |
| Dialogi PL/EN jako osobne pliki | W Godocie trzymać **jeden** plik dialogów z kluczami `tr()`, nie dwie kopie tekstu — dziś `dialogues/{pl,en}.json` to duplikacja struktury |

---

## 14. Co zostaje bez zmian

- **Wszystkie dane** (`src/data/**.json`) — kopiowane do `res://data/`
- **Nazwy zdarzeń i identyfikatory** — sygnały i `id` w JSON
- **Klucze tłumaczeń** (1425) — audyt `tools/i18n/check.py` działa dalej
- **Logika systemów** — przepisywana na GDScript funkcja po funkcji, z tymi samymi wzorami
- **Zasada diegetyczna (§0)** — nie podlega negocjacjom w żadnym silniku
