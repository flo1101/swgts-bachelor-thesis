import { create } from "zustand";

const useStore = create((set) => ({
  // Server configuration
  serverConfig: null,
  setServerConfig: (serverConfig) => set({ serverConfig }),
  // Handle upload
  uploading: false,
  setUploading: (uploading) => set({ uploading }),
  readCount: null,
  setReadCount: (readCount) => set({ readCount }),
  progress: null,
  setProgress: (progress) => set({ progress }),
  filtered: null,
  setFiltered: (filtered) => set({ filtered }),
  bufferFill: null,
  setBufferFill: (bufferFill) => set({ bufferFill }),
  // Dialog
  showDialog: false,
  setShowDialog: (showDialog) => set({ showDialog }),
  dialogText: "",
  setDialogText: (dialogText) => set({ dialogText }),
}));

export default useStore;
