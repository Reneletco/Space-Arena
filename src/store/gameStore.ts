import { create } from 'zustand';
import type { DetectedShip } from '../types/ships';
import type { BattleShip, ShotEvent } from '../types/battle';
import { simulateBattle } from '../battle/battleEngine';

interface GameState {
  rawImage:         string | null;
  detectedShips:    DetectedShip[];

  // состояние боя
  battleShips:      BattleShip[];
  events:           ShotEvent[];
  currentEventIdx:  number;
  winner:           string | null;
  isBattleReady:    boolean;

  // действия
  setImage:         (image: string) => void;
  setShips:         (ships: DetectedShip[]) => void;
  updateShip:       (id: string, patch: Partial<DetectedShip>) => void;
  addShip:          (ship: DetectedShip) => void;
  removeShip:       (id: string) => void;
  startBattle:      () => void;
  nextEvent:        () => void;
  prevEvent:        () => void;
  reset:            () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  rawImage:        null,
  detectedShips:   [],
  battleShips:     [],
  events:          [],
  currentEventIdx: -1,  // -1 — ещё показываем инициативу, до первого выстрела
  winner:          null,
  isBattleReady:   false,

  setImage:  image  => set({ rawImage: image }),
  setShips:  ships  => set({ detectedShips: ships }),

  updateShip: (id, patch) => set(state => ({
    detectedShips: state.detectedShips.map(s => s.id === id ? { ...s, ...patch } : s),
  })),

  addShip: ship => set(state => ({
    detectedShips: [...state.detectedShips, ship],
  })),

  removeShip: id => set(state => ({
    detectedShips: state.detectedShips.filter(s => s.id !== id),
  })),

  startBattle: () => {
    const { detectedShips } = get();
    if (!detectedShips.length) return;
    const { ships, events, winner } = simulateBattle(detectedShips);
    set({
      battleShips:     ships,
      events,
      winner,
      currentEventIdx: -1,
      isBattleReady:   true,
    });
  },

  nextEvent: () => {
    const { currentEventIdx, events } = get();
    if (currentEventIdx < events.length - 1) {
      set({ currentEventIdx: currentEventIdx + 1 });
    }
  },

  prevEvent: () => {
    const { currentEventIdx } = get();
    if (currentEventIdx > -1) {
      set({ currentEventIdx: currentEventIdx - 1 });
    }
  },

  reset: () => set({
    rawImage:        null,
    detectedShips:   [],
    battleShips:     [],
    events:          [],
    currentEventIdx: -1,
    winner:          null,
    isBattleReady:   false,
  }),
}));
