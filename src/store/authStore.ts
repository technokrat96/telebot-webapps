import { create } from "zustand";
import {
  persist,
  type PersistStorage,
  type StorageValue,
} from "zustand/middleware";
import { packText, unpackText } from "@/lib/localStorageCipher";

interface AuthStoreState {
  // Satu-satunya hal yang disimpan di client (localStorage): JWT token.
  // Nama, roles, dan status telegramLinked SENGAJA tidak disimpan di sini —
  // itu selalu diambil ulang dari server (/api/auth/me) tiap app dibuka,
  // supaya perubahan role/status di server langsung kepakai tanpa perlu
  // logout manual, dan localStorage tidak menyimpan data user selain token.
  token: string | null;
  setToken: (token: string) => void;
  clear: () => void;
}

type PersistedAuth = Pick<AuthStoreState, "token">;

// localStorage-nya dibungkus AES-GCM (lihat src/lib/localStorageCipher.ts)
// sebelum ditulis, dan dibongkar sebelum dibaca — cuma obfuscation ringan
// (bukan proteksi asli terhadap XSS, sudah dibahas), tapi cukup buat
// nyembunyiin token dari orang yang asal buka DevTools/localStorage.
const obfuscatedStorage: PersistStorage<PersistedAuth> = {
  async getItem(name) {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(name);
    if (!raw) return null;
    const plain = await unpackText(raw);
    if (!plain) return null;
    try {
      return JSON.parse(plain) as StorageValue<PersistedAuth>;
    } catch {
      return null;
    }
  },
  async setItem(name, value) {
    if (typeof window === "undefined") return;
    const packed = await packText(JSON.stringify(value));
    window.localStorage.setItem(name, packed);
  },
  async removeItem(name) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token: string) => set({ token }),
      clear: () => set({ token: null }),
    }),
    {
      name: "florist-app-auth",
      storage: obfuscatedStorage,
      partialize: (state) => ({ token: state.token }),
    },
  ),
);
