import { create } from "zustand";

const useStore = create((set) => ({
  // Server configuration
  serverConfig: null,
  setServerConfig: (serverConfig) => set({ serverConfig }),
  // Handle upload
  uploadStatus: null, // Values: null , 'UPLOADING', 'SUCCESS', 'ERROR'
  setUploadStatus: (uploadStatus) => set({ uploadStatus }),
  readsTotal: 0,
  setReadsTotal: (readsTotal) => set({ readsTotal }),
  readsProgressed: 0,
  setReadsProgressed: (readsProgressed) => set({ readsProgressed }),
  bufferFill: 0,
  setBufferFill: (bufferFill) => set({ bufferFill }),
  // Dialog
  showDialog: false,
  setShowDialog: (showDialog) => set({ showDialog }),
  dialogText: "",
  setDialogText: (dialogText) => set({ dialogText }),
  lines: null,
  setLines: (lines) => set({ lines }),
  linesOffset: 0,
  setLinesOffset: (linesOffset) => set({ linesOffset }),
}));

export default useStore;
