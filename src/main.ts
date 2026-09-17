import { Game } from './core/Game';
import { setGame } from './core/gameSingleton';
import { settings } from './core/Settings';
import { audio } from './core/AudioSystem';
import { bus } from './core/EventBus';

/* ============================================================================
   ELENEM v2.0 — punkt wejścia
   2D pixel-art, 3/4 top-down, bufor 640×360 skalowany całkowitą wielokrotnością.
   Cała treść gry (świat, NPC, dialogi, przedmioty, questy, umiejętności,
   tłumaczenia) pochodzi z plików JSON w src/data — w kodzie nie ma ani jednego
   łańcucha widocznego dla gracza (brief 8).
   ========================================================================== */

function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!canvas) { console.error('[boot] brak canvasu #game'); return; }
  document.documentElement.style.setProperty('--ui-scale', String(settings.data.uiScale));
  const game = new Game();
  setGame(game);
  (window as any).ELENEM = game;          // uchwyt dla konsoli debug i testów

  // audio wymaga gestu użytkownika — odblokuj przy pierwszym kliknięciu/klawiszu
  const unlock = () => { audio.init(); audio.resume(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // prawy przycisk myszy = blok, nie menu kontekstowe
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  game.boot(canvas).then(() => {
    bus.emit('boot:done', {});
    console.info('%cELENEM v2.0 — vertical slice', 'color:#d8b25c;font-weight:bold');
    console.info('Konsola debug: klawisz ` (backquote). Komendy: help');
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
