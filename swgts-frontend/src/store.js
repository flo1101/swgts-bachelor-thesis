import { create } from "zustand";

const useStore = create((set) => ({
  // Server configuration
  serverConfig: null,
  setServerConfig: (serverConfig) => set({ serverConfig }),
  // Handle upload
  uploading: false,
  setUploading: (uploading) => set({ uploading }),
  readsTotal: null,
  setReadsTotal: (readCount) => set({ readCount }),
  readsProgressed: null,
  setReadsProgressed: (readsProgressed) => set({ readsProgressed }),
  readsFiltered: null,
  setReadsFiltered: (filtered) => set({ filtered }),
  bufferFill: null,
  setBufferFill: (bufferFill) => set({ bufferFill }),
  // Dialog
  showDialog: false,
  setShowDialog: (showDialog) => set({ showDialog }),
  dialogText: "",
  setDialogText: (dialogText) => set({ dialogText }),
}));

export default useStore;
