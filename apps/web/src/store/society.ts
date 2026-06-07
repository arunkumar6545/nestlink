import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Society {
  id: string;
  name: string;
  address: string;
  city: string;
  logo_url: string | null;
  plan: "free" | "pro" | "enterprise";
}

interface SocietyState {
  societies: Society[];
  activeSocietyId: string | null;
  setSocieties: (societies: Society[]) => void;
  setActiveSociety: (id: string) => void;
  activeSociety: () => Society | null;
}

export const useSocietyStore = create<SocietyState>()(
  persist(
    (set, get) => ({
      societies: [],
      activeSocietyId: null,
      setSocieties: (societies) =>
        set((state) => ({
          societies,
          activeSocietyId:
            state.activeSocietyId && societies.some((s) => s.id === state.activeSocietyId)
              ? state.activeSocietyId
              : (societies[0]?.id ?? null),
        })),
      setActiveSociety: (id) => set({ activeSocietyId: id }),
      activeSociety: () => {
        const { societies, activeSocietyId } = get();
        return societies.find((s) => s.id === activeSocietyId) ?? null;
      },
    }),
    {
      name: "nestlink-society",
      partialize: (state) => ({
        activeSocietyId: state.activeSocietyId,
      }),
    }
  )
);
