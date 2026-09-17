import { TILE } from '../world/TileMap';

/** Kamera: płynne śledzenie, martwa strefa, ograniczenie do granic mapy, trzęsienie. */
export class Camera {
  x = 0; y = 0;           // lewy górny róg widoku w pikselach świata
  tx = 0; ty = 0;         // cel
  viewW = 640; viewH = 360;
  shake = 0; shakeT = 0;
  deadzone = { x: 44, y: 26 };
  smoothing = 8;
  bounds = { w: 140 * TILE, h: 112 * TILE };
  zoom = 1;

  setBounds(wTiles: number, hTiles: number) { this.bounds = { w: wTiles * TILE, h: hTiles * TILE }; }

  follow(px: number, py: number, dt: number, instant = false) {
    const cx = this.x + this.viewW / 2, cy = this.y + this.viewH / 2;
    let dx = px - cx, dy = py - cy;
    if (Math.abs(dx) < this.deadzone.x) dx = 0;
    if (Math.abs(dy) < this.deadzone.y) dy = 0;
    this.tx = this.x + dx; this.ty = this.y + dy;
    if (instant) { this.x = this.tx; this.y = this.ty; }
    else {
      const k = Math.min(1, this.smoothing * dt);
      this.x += (this.tx - this.x) * k;
      this.y += (this.ty - this.y) * k;
    }
    this.clamp();
  }

  clamp() {
    const maxX = Math.max(0, this.bounds.w - this.viewW), maxY = Math.max(0, this.bounds.h - this.viewH);
    this.x = Math.max(0, Math.min(maxX, this.x));
    this.y = Math.max(0, Math.min(maxY, this.y));
  }

  kick(amount: number) { this.shake = Math.min(6, this.shake + amount); this.shakeT = 0; }

  update(dt: number) {
    if (this.shake > 0) { this.shakeT += dt; this.shake = Math.max(0, this.shake - dt * 14); }
  }

  get ox() { return this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake * 2) : 0; }
  get oy() { return this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake * 2) : 0; }

  worldToScreen(x: number, y: number) { return { x: x - this.x + this.ox, y: y - this.y + this.oy }; }
  screenToWorld(x: number, y: number) { return { x: x + this.x - this.ox, y: y + this.y - this.oy }; }
  visible(x: number, y: number, pad = 48) {
    return x > this.x - pad && x < this.x + this.viewW + pad && y > this.y - pad && y < this.y + this.viewH + pad;
  }
}
