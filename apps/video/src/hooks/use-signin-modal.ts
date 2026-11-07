import { create } from "zustand";

interface useSigninModalStore {
  isOpen: boolean;
  callbackURL: string | null;
  onOpen: () => void;
  onOpenWithRedirect: (callbackURL: string) => void;
  onClose: () => void;
}

export const useSigninModal = create<useSigninModalStore>((set) => ({
  isOpen: false,
  callbackURL: null,
  onOpen: () => set({ isOpen: true, callbackURL: null }),
  onOpenWithRedirect: (callbackURL) => set({ isOpen: true, callbackURL }),
  onClose: () => set({ isOpen: false, callbackURL: null }),
}));
