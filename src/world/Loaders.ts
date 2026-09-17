import { TileMap, GROUND_TYPES } from './TileMap';
import { Scene, SceneObject, SceneLight } from './Scene';
import { TILE, getProp, PROPS, propOffset, GroundType } from '../render/Art';
import { renderBuilding, renderInteriorWalls, BuildingDef, InteriorDef } from '../render/Buildings';
import districtJson from '../data/world/district_port.json';
import interiorsJson from '../data/world/interiors.json';

/* ============================================================================
   ŁADOWANIE ŚWIATA Z DANYCH ZEWNĘTRZNYCH (brief, sekcja 8:
   „Dane w plikach zewnętrznych; kod ich nie zawiera").
   Współrzędne w JSON są w kaflach — tu przeliczane na piksele świata.
   ========================================================================== */

interface JsonBuilding {
  id: string; nameKey: string; tx: number; ty: number; tw: number; td: number;
  wallH: number; roof: BuildingDef['roof']; wall: string; trim: string; roofColor?: string;
  halfTimber?: boolean; stories?: number; chimney?: boolean; balcony?: boolean; stairs?: boolean;
  doorX?: number; doorW?: number; windows?: number; sign?: { textKey: string; color: string };
  flowerBoxes?: boolean; ruin?: boolean; interior?: string;
}
interface JsonGate {
  id: string; x: number; y: number; w: number; kind: string; nameKey: string;
  needsPass?: boolean; passItem?: string; bribe?: number; guardNpc?: string;
  hoursOpen?: [number, number]; lockedMsgKey?: string; hidden?: boolean; needsSkill?: string; needsLevel?: number;
}
interface DistrictJson {
  id: string; nameKey: string; sizeTiles: [number, number];
  spawn: { x: number; y: number; dir: number; fromShip?: boolean };
  ground: { base: GroundType; patches: Array<[GroundType, number, number, number, number]> };
  water: Array<[number, number, number, number, number]>;
  walls: Array<{ x: number; y: number; w: number; h: number; kind: string }>;
  gates: JsonGate[];
  regions: Array<{ nameKey: string; x: number; y: number; w: number; h: number; noteId?: string }>;
  buildings: JsonBuilding[];
  props: Array<[string, number, number, number?]>;
  lamps: Array<[number, number]>;
  spawners: Record<string, { count: number; points?: Array<[number, number]>; areas?: Array<[number, number, number, number]> }>;
  fastTravel: Array<{ id: string; nameKey: string; tx: number; ty: number }>;
  ambience: { birds: number; smoke: Array<[number, number]> };
}

const DISTRICT = districtJson as unknown as DistrictJson;
const INTERIORS = (interiorsJson as any).interiors as InteriorDef[];

export interface LoadedWorld {
  district: Scene;
  interiors: Map<string, Scene>;
  spawn: { x: number; y: number; dir: number };
  buildings: Map<string, SceneObject>;
  gates: Map<string, SceneObject>;
  fastTravel: Array<{ id: string; nameKey: string; x: number; y: number }>;
  spawners: DistrictJson['spawners'];
  ambience: DistrictJson['ambience'];
}

export function loadDistrict(): LoadedWorld {
  const [w, h] = DISTRICT.sizeTiles;
  const tm = new TileMap(w, h, DISTRICT.ground.base);
  const scene = new Scene(DISTRICT.id, DISTRICT.nameKey, tm, false);

  // --- woda (blokuje ruch) ---
  for (const [tx, ty, tw, th, deep] of DISTRICT.water) {
    tm.fillRect(tx, ty, tw, th, deep ? 'waterDeep' : 'water');
    tm.blockRect(tx, ty, tw, th, true);
  }
  // --- podłoże: nakładane PO wodzie, bo pomosty i nabrzeża muszą być przejezdne ---
  for (const [type, tx, ty, tw, th] of DISTRICT.ground.patches) {
    if (!GROUND_TYPES.includes(type)) { console.warn('[world] nieznany typ podłoża:', type); continue; }
    tm.fillRect(tx, ty, tw, th, type);
    if (type !== 'water' && type !== 'waterDeep') tm.blockRect(tx, ty, tw, th, false);
  }
  // brzeg: piach przy wodzie
  for (let tx = 0; tx < w; tx++) {
    for (let ty = 0; ty < h; ty++) {
      if (tm.isWater(tx, ty)) {
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]] as const) {
          const nx = tx + dx, ny = ty + dy;
          if (tm.inside(nx, ny) && !tm.isWater(nx, ny) && tm.groundAt(nx, ny) === 'grass') tm.setGround(nx, ny, 'sand');
        }
      }
    }
  }

  // --- mury ---
  for (const wl of DISTRICT.walls) {
    const horizontal = wl.w >= wl.h;
    const len = horizontal ? wl.w : wl.h;
    for (let i = 0; i < len; i++) {
      const tx = horizontal ? wl.x + i : wl.x;
      const ty = horizontal ? wl.y : wl.y + i;
      tm.setBlocked(tx, ty, true);
      const art = getProp(horizontal ? 'wallH' : 'wallV', (tx + ty) % 3, false);
      scene.add({
        kind: 'wall', type: horizontal ? 'wallH' : 'wallV', id: `wall_${tx}_${ty}`,
        x: tx * TILE + TILE / 2, y: (ty + 1) * TILE,
        box: { x: tx * TILE + 2, y: ty * TILE + 10, w: TILE - 4, h: TILE - 12 },
        sortY: (ty + 1) * TILE, tall: true, art, dx: propOffset(horizontal ? 'wallH' : 'wallV').dx,
        dy: propOffset(horizontal ? 'wallH' : 'wallV').dy, solid: true, variant: (tx + ty) % 3
      });
    }
  }

  // --- budynki ---
  const buildings = new Map<string, SceneObject>();
  for (const b of DISTRICT.buildings) {
    const def: BuildingDef = {
      id: b.id, x: b.tx * TILE, y: (b.ty + 1) * TILE, w: b.tw * TILE, d: b.td * TILE,
      wallH: b.wallH, roof: b.roof, wall: b.wall, trim: b.trim, roofColor: b.roofColor,
      halfTimber: b.halfTimber, stories: b.stories, chimney: b.chimney, balcony: b.balcony,
      stairs: b.stairs, doorX: b.doorX, doorW: b.doorW, windows: b.windows, sign: b.sign,
      flowerBoxes: b.flowerBoxes, ruin: b.ruin, interior: b.interior
    };
    const rb = renderBuilding(def, b.tx * 31 + b.ty * 17);
    const lights: SceneLight[] = rb.lights.map(l => ({
      x: l.x, y: l.y, r: l.r, color: l.color, flicker: l.flicker, onlyDark: true, source: b.id
    }));
    const obj = scene.add({
      kind: 'building', type: b.id, id: `bld_${b.id}`,
      x: def.x + def.w / 2, y: def.y,
      box: { x: def.x - 2, y: def.y - def.d, w: def.w + 4, h: def.d + 4 },
      sortY: def.y + 6, tall: true, art: rb.canvas,
      dx: rb.ox - def.w / 2, dy: rb.oy,
      lights, solid: true, variant: 0, data: { def, rendered: rb }, nameKey: b.nameKey
    });
    buildings.set(b.id, obj);
    tm.blockRect(b.tx, b.ty - b.td + 1, b.tw, b.td, true);

    // drzwi
    if (rb.door) {
      const doorObj = scene.add({
        kind: 'door', type: 'door', id: `door_${b.id}`,
        x: rb.door.x + rb.door.w / 2, y: def.y + 4,
        box: null, sortY: def.y + 8, tall: false, art: null,
        interactId: b.interior ? `door:${b.interior}` : `door:${b.id}`,
        nameKey: b.nameKey, data: { building: b.id, interior: b.interior ?? null, def }
      });
      doorObj.hidden = false;
    }
  }

  // --- bramy ---
  const gates = new Map<string, SceneObject>();
  for (const g of DISTRICT.gates) {
    const cx = (g.x + g.w / 2) * TILE;
    const cy = (g.y + 1) * TILE;
    const art = g.kind === 'gatehouse' ? getProp('cityGate', g.id.length % 2, false) : null;
    const obj = scene.add({
      kind: 'gate', type: g.kind, id: `gate_${g.id}`,
      x: cx, y: cy,
      box: { x: g.x * TILE, y: g.y * TILE + 8, w: g.w * TILE, h: TILE - 8 },
      sortY: cy + 10, tall: true, art, dx: art ? -art.width / 2 : 0, dy: art ? -art.height + 8 : 0,
      solid: true, interactId: `gate:${g.id}`, nameKey: g.nameKey, dynamic: true,
      data: { def: g, open: false, state: 'closed' }
    });
    gates.set(g.id, obj);
    // domyślnie zablokowane — otwarcie zmienia `applyGateState`
    tm.blockRect(g.x, g.y, g.w, 1, true);
    if (g.kind === 'gatehouse') {
      for (const side of [-1, 1]) {
        const tx = g.x + (side < 0 ? -1 : g.w);
        scene.add({
          kind: 'prop', type: 'wallTower', id: `tower_${g.id}_${side}`,
          x: tx * TILE + TILE / 2, y: cy, box: { x: tx * TILE, y: g.y * TILE, w: TILE, h: TILE },
          sortY: cy + 12, tall: true, art: getProp('wallTower', 0, false),
          dx: -20, dy: -62 + 8, solid: true
        });
      }
    }
  }

  // --- propsy ---
  for (const p of DISTRICT.props) {
    const [type, tx, ty, variant] = p;
    const d = PROPS[type];
    if (!d) { console.warn('[world] nieznany props:', type); continue; }
    const v = variant ?? ((tx * 7 + ty * 13) % 3);
    const art = getProp(type, v, true);
    if (!art) continue;
    const ax = tx * TILE + TILE / 2, ay = (ty + 1) * TILE;
    const solid = d.solid;
    const bw = Math.max(10, Math.round(d.w * 0.55)), bh = Math.max(6, Math.round(d.h * 0.3));
    const off = propOffset(type);
    scene.add({
      kind: 'prop', type, id: `prop_${type}_${tx}_${ty}`,
      x: ax, y: ay,
      box: solid ? { x: ax - bw / 2, y: ay - bh, w: bw, h: bh } : null,
      sortY: ay, tall: d.tall, art, dx: off.dx, dy: off.dy, variant: v,
      solid, grabbable: d.grabbable, dynamic: d.grabbable, nameKey: `prop.${type}`
    });
  }

  // --- latarnie (światła uliczne) ---
  for (const [tx, ty] of DISTRICT.lamps) {
    scene.lights.push({
      x: tx * TILE + 16, y: ty * TILE + 6, r: 92, color: '#ffc76a',
      flicker: 0.22, onlyDark: true, source: 'lamp'
    });
  }

  // --- regiony ---
  for (const r of DISTRICT.regions) {
    scene.regions.push({ nameKey: r.nameKey, x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE, noteId: r.noteId });
  }

  // --- punkty spawnu / szybkiej podróży ---
  for (const ft of DISTRICT.fastTravel) scene.spawnPoints[ft.id] = { x: ft.tx * TILE + 16, y: (ft.ty + 1) * TILE };
  scene.spawnPoints['spawn_ship'] = { x: DISTRICT.spawn.x, y: DISTRICT.spawn.y };

  // --- dymy z kominów ---
  for (const [tx, ty] of DISTRICT.ambience.smoke) scene.smokeSources.push({ x: tx * TILE + 16, y: ty * TILE });

  // --- wnętrza ---
  const interiors = new Map<string, Scene>();
  for (const def of INTERIORS) interiors.set(def.id, loadInterior(def));

  return {
    district: scene, interiors,
    spawn: { x: DISTRICT.spawn.x, y: DISTRICT.spawn.y, dir: DISTRICT.spawn.dir },
    buildings, gates,
    fastTravel: DISTRICT.fastTravel.map(ft => ({ id: ft.id, nameKey: ft.nameKey, x: ft.tx * TILE + 16, y: (ft.ty + 1) * TILE })),
    spawners: DISTRICT.spawners,
    ambience: DISTRICT.ambience
  };
}

export function loadInterior(def: InteriorDef): Scene {
  const tm = new TileMap(def.w, def.h, def.floor as GroundType);
  const scene = new Scene(def.id, def.nameKey, tm, true);
  // ściany jako tło
  const bg = renderInteriorWalls(def);
  scene.add({
    kind: 'decal', type: 'walls', id: `${def.id}_walls`, x: (def.w * TILE) / 2, y: 0,
    box: null, sortY: -1e9, tall: false, art: bg, dx: -bg.width / 2, dy: 0, solid: false
  });
  // blokada krawędzi
  tm.blockRect(0, 0, def.w, 2, true);
  tm.blockRect(0, 0, 1, def.h, true);
  tm.blockRect(def.w - 1, 0, 1, def.h, true);
  tm.blockRect(0, def.h - 1, def.w, 1, true);

  for (const p of def.props) {
    const [type, tx, ty, variant] = p as [string, number, number, number?];
    const d = PROPS[type]; if (!d) { console.warn('[interior] nieznany props:', type); continue; }
    const v = variant ?? 0;
    const art = getProp(type, v, true); if (!art) continue;
    const ax = tx * TILE + TILE / 2, ay = (ty + 1) * TILE;
    const bw = Math.max(10, Math.round(d.w * 0.6)), bh = Math.max(6, Math.round(d.h * 0.32));
    const off = propOffset(type);
    scene.add({
      kind: 'prop', type, id: `${def.id}_prop_${type}_${tx}_${ty}`, x: ax, y: ay,
      box: d.solid ? { x: ax - bw / 2, y: ay - bh, w: bw, h: bh } : null,
      sortY: ay, tall: d.tall, art, dx: off.dx, dy: off.dy, variant: v,
      solid: d.solid, grabbable: d.grabbable, nameKey: `prop.${type}`
    });
  }
  for (const l of def.lights) {
    const [tx, ty, r, color] = l as [number, number, number, string];
    scene.lights.push({ x: tx * TILE + 16, y: ty * TILE + 16, r, color, flicker: 0.18, onlyDark: false, source: 'interior' });
  }
  for (const e of def.exits) {
    tm.blockRect(e.tx, e.ty, e.w, 1, false);
    scene.add({
      kind: 'exit', type: 'exit', id: `${def.id}_exit_${e.tx}`, x: (e.tx + e.w / 2) * TILE, y: e.ty * TILE + TILE,
      box: null, sortY: e.ty * TILE + TILE, tall: false, art: null,
      interactId: `exit:${e.to}`, data: { to: e.to, spawnX: e.spawnX, spawnY: e.spawnY },
      nameKey: 'station.exit'
    });
    // mata podłogowa przy wyjściu
    tm.setOverlay(e.tx, e.ty - 1, 3, 0.6);
  }
  for (const s of def.stations ?? []) {
    scene.add({
      kind: 'station', type: s.kind, id: `${def.id}_st_${s.kind}_${s.tx}_${s.ty}`,
      x: s.tx * TILE + 16, y: s.ty * TILE + TILE - 4, box: null,
      sortY: s.ty * TILE + TILE, tall: false, art: null,
      interactId: `station:${s.kind}`, nameKey: s.labelKey, data: { ...s, interior: def.id }
    });
  }
  for (const r of (def as any).rooms ?? []) {
    scene.add({
      kind: 'station', type: r.kind ?? 'bed', id: `${def.id}_room_${r.id}`,
      x: (r.tx + r.tw / 2) * TILE, y: (r.ty + r.th) * TILE, box: null,
      sortY: (r.ty + r.th) * TILE, tall: false, art: null,
      interactId: `station:${r.kind ?? 'bed'}`, nameKey: r.labelKey, data: { ...r, interior: def.id }
    });
  }
  scene.interiorAmbient = 0.42;
  return scene;
}

/** Zmiana stanu bramy: otwarta/zamknięta → kolizja i wygląd. */
export function applyGateState(scene: Scene, gateObj: SceneObject, open: boolean) {
  const g = gateObj.data?.def as JsonGate | undefined;
  if (!g) return;
  gateObj.data.open = open;
  gateObj.data.state = open ? 'open' : 'closed';
  scene.tilemap.blockRect(g.x, g.y, g.w, 1, !open);
  if (gateObj.art) gateObj.art = getProp('cityGate', open ? 1 : 0, false);
  scene.invalidate();
}

export { DISTRICT, INTERIORS };
