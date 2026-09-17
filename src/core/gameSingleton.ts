import type { Game } from './Game';

/**
 * Punkt dostępu do instancji gry dla systemów. Dzięki temu systemy nie trzymają
 * referencji do siebie nawzajem — komunikują się przez GameContext + EventBus
 * (brief 8: brak twardego sprzęgnięcia).
 */
let _game: Game | null = null;

export function setGame(g: Game) { _game = g; }

export function getGame(): Game {
  if (!_game) throw new Error('[game] kontekst nie zainicjowany');
  return _game;
}

export function hasGame(): boolean { return !!_game; }
