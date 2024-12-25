import { create } from "zustand";

const useStore = create((set) => ({
  // Server configuration (buffer size, uptime, version...)
  serverConfig: {},
  setServerConfig: (serverConfig) => set({ serverConfig }),
}));

export default useStore;
