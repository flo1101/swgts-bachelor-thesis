import { create } from "zustand";

const useStore = create((set) => ({
  // Server configuration
  serverConfig: null,
  setServerConfig: (serverConfig) => set({ serverConfig }),
  // Handle upload
  uploading: false,
  setUploading: (uploading) => set({ uploading }),
  readsTotal: 0,
  setReadsTotal: (readsTotal) => set({ readsTotal }),
  readsProgressed: 0,
  setReadsProgressed: (readsProgressed) => set({ readsProgressed }),
  readsFiltered: 0,
  setReadsFiltered: (filtered) => set({ filtered }),
  bufferFill: 0,
  setBufferFill: (bufferFill) => set({ bufferFill }),
  // Dialog
  showDialog: false,
  setShowDialog: (showDialog) => set({ showDialog }),
  dialogText: "",
  setDialogText: (dialogText) => set({ dialogText }),
}));

export default useStore;
