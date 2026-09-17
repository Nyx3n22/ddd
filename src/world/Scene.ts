import { TileMap } from './TileMap';
import { TILE } from '../render/Art';

/* ============================================================================
   SCENA — wspólna reprezentacja dzielnicy (świat) i wnętrz.
   Obiekty mają kotwicę w dolnym środku i klucz Y-sortingu, dzięki czemu postać
   chowa się za budynkiem, beczką czy straganem (brief, sekcja 8).
   ========================================================================== */

export type ObjectKind = 'prop' | 'building' | 'wall' | 'gate' | 'station' | 'exit' | 'door' | 'decal' | 'marker';

export interface SceneLight {
  x: number; y: number; r: number; color: string;
  /** 0..1 — jak bardzo migocze */
  flicker: number;
  /** świeci tylko po zmroku */
  onlyDark: boolean;
  source?: string;
  /** światło przenośne (pochodnia gracza) */
  dynamic?: boolean;
}

export interface SceneObject {
  kind: ObjectKind;
  id: string;
  type: string;
  /** kotwica: środek podstawy, w px świata */
  x: number; y: number;
  /** prostokąt kolizji w px świata */
  box: { x: number; y: number; w: number; h: number } | null;
  /** klucz sortowania (im większy, tym bliżej kamery) */
  sortY: number;
  /** rysowany po postaciach (zasłania je) */
  tall: boolean;
  art: HTMLCanvasElement | null;
  /** przesunięcie rysowania względem kotwicy */
  dx: number; dy: number;
  variant: number;
  lights: SceneLight[];
  data: any;
  nameKey?: string;
  interactId?: string;
  solid: boolean;
  grabbable: boolean;
  hidden: boolean;
  alpha: number;
  /** obiekt dynamiczny (beczka do przesunięcia, wrota) */
  dynamic: boolean;
}

export interface Region { nameKey: string; x: number; y: number; w: number; h: number; noteId?: string }

let objCounter = 0;

export class Scene {
  id: string;
  nameKey: string;
  tilemap: TileMap;
  objects: SceneObject[] = [];
  lights: SceneLight[] = [];
  regions: Region[] = [];
  isInterior: boolean;
  /** kolor/współczynnik światła zastępczego we wnętrzu */
  interiorAmbient = 0.35;
  exits: SceneObject[] = [];
  stations: SceneObject[] = [];
  doors: SceneObject[] = [];
  gates: SceneObject[] = [];
  /** punkty szybkiej podróży / spawnu */
  spawnPoints: Record<string, { x: number; y: number }> = {};
  /** kominy (dym) i ptaki — dane dla warstwy cząsteczek */
  smokeSources: Array<{ x: number; y: number }> = [];
  private sortedDirty = true;
  private sorted: SceneObject[] = [];

  constructor(id: string, nameKey: string, tilemap: TileMap, isInterior = false) {
    this.id = id; this.nameKey = nameKey; this.tilemap = tilemap; this.isInterior = isInterior;
  }

  add(o: Partial<SceneObject> & { kind: ObjectKind; type: string; x: number; y: number }): SceneObject {
    const full: SceneObject = {
      id: o.id ?? `obj${++objCounter}`, kind: o.kind, type: o.type, x: o.x, y: o.y,
      box: o.box ?? null, sortY: o.sortY ?? o.y, tall: o.tall ?? false, art: o.art ?? null,
      dx: o.dx ?? 0, dy: o.dy ?? 0, variant: o.variant ?? 0, lights: o.lights ?? [],
      data: o.data ?? null, nameKey: o.nameKey, interactId: o.interactId,
      solid: o.solid ?? false, grabbable: o.grabbable ?? false, hidden: o.hidden ?? false,
      alpha: o.alpha ?? 1, dynamic: o.dynamic ?? false
    };
    this.objects.push(full);
    if (full.box && full.solid) this.applyBox(full.box, true);
    for (const l of full.lights) this.lights.push(l);
    if (full.kind === 'exit') this.exits.push(full);
    if (full.kind === 'station') this.stations.push(full);
    if (full.kind === 'door') this.doors.push(full);
    if (full.kind === 'gate') this.gates.push(full);
    this.sortedDirty = true;
    return full;
  }

  remove(o: SceneObject) {
    const i = this.objects.indexOf(o); if (i >= 0) this.objects.splice(i, 1);
    for (const l of o.lights) { const j = this.lights.indexOf(l); if (j >= 0) this.lights.splice(j, 1); }
    if (o.box && o.solid) this.applyBox(o.box, false);
    this.exits = this.exits.filter(e => e !== o);
    this.stations = this.stations.filter(e => e !== o);
    this.sortedDirty = true;
  }

  private applyBox(b: { x: number; y: number; w: number; h: number }, v: boolean) {
    const tx0 = Math.floor(b.x / TILE), ty0 = Math.floor(b.y / TILE);
    const tx1 = Math.floor((b.x + b.w) / TILE), ty1 = Math.floor((b.y + b.h) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) this.tilemap.setBlocked(tx, ty, v);
  }

  /** Statyczne obiekty posortowane po Y (do łączenia z aktorami w kadrze). */
  sortedObjects(): SceneObject[] {
    if (this.sortedDirty) {
      this.sorted = [...this.objects].sort((a, b) => a.sortY - b.sortY || a.x - b.x);
      this.sortedDirty = false;
    }
    return this.sorted;
  }

  invalidate() { this.sortedDirty = true; }

  byId(id: string): SceneObject | undefined { return this.objects.find(o => o.id === id); }
  byInteract(id: string): SceneObject | undefined { return this.objects.find(o => o.interactId === id); }
  byType(type: string): SceneObject[] { return this.objects.filter(o => o.type === type); }

  /** Obiekty w promieniu (do podpowiedzi interakcji i AI). */
  near(x: number, y: number, r: number, kinds?: ObjectKind[]): SceneObject[] {
    const out: SceneObject[] = [];
    const r2 = r * r;
    for (const o of this.objects) {
      if (o.hidden) continue;
      if (kinds && !kinds.includes(o.kind)) continue;
      const d = (o.x - x) ** 2 + (o.y - y) ** 2;
      if (d < r2) out.push(o);
    }
    return out.sort((a, b) => ((a.x - x) ** 2 + (a.y - y) ** 2) - ((b.x - x) ** 2 + (b.y - y) ** 2));
  }

  regionAt(x: number, y: number): Region | null {
    // najmniejszy pasujący region (najbardziej szczegółowy)
    let best: Region | null = null, bestArea = Infinity;
    for (const r of this.regions) {
      if (x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h) {
        const a = r.w * r.h;
        if (a < bestArea) { bestArea = a; best = r; }
      }
    }
    return best;
  }

  lightLevelAt(x: number, y: number, darkness: number): number {
    if (this.isInterior) return 1 - this.interiorAmbient * (1 - darkness * 0.3);
    let level = 1 - darkness;
    for (const l of this.lights) {
      if (l.onlyDark && darkness < 0.25) continue;
      const d = Math.hypot(l.x - x, l.y - y);
      if (d < l.r) level += (1 - d / l.r) * 0.85;
    }
    return Math.min(1.4, level);
  }

  serialize(): any {
    return {
      id: this.id,
      dynamic: this.objects.filter(o => o.dynamic || o.hidden || o.kind === 'gate')
        .map(o => ({ id: o.id, x: o.x, y: o.y, hidden: o.hidden, data: o.data?.state }))
    };
  }
  deserialize(d: any) {
    if (!d || d.id !== this.id) return;
    for (const s of d.dynamic ?? []) {
      const o = this.byId(s.id); if (!o) continue;
      if (typeof s.x === 'number') { o.x = s.x; o.y = s.y; }
      o.hidden = !!s.hidden;
      if (o.data) o.data.state = s.data ?? o.data.state;
    }
    this.invalidate();
  }
}
