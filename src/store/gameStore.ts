import { create } from 'zustand';

interface GameState {
  rawImage: string | null;
  ships: any[];
  shots: any[];
  currentShotIndex: number;
  winner: string | null;
  isBattleFinished: boolean;

  setImage: (image: string) => void;
  setShips: (ships: any[]) => void;
  startBattle: () => void;
  nextShot: () => any;
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  rawImage: null,
  ships: [],
  shots: [],
  currentShotIndex: 0,
  winner: null,
  isBattleFinished: false,

  setImage: (image) => set({ rawImage: image }),
  setShips: (ships) => set({ ships }),
  startBattle: () => {
    set({ isBattleFinished: false, currentShotIndex: 0, shots: [] });
  },
  nextShot: () => {
    return null;
  },
  reset: () => set({
    rawImage: null,
    ships: [],
    shots: [],
    currentShotIndex: 0,
    winner: null,
    isBattleFinished: false,
  }),
}));