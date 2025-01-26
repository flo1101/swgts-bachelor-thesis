import { useEffect } from "react";
import useStore from "../store";
import { useShallow } from "zustand/react/shallow";
import { io } from "socket.io-client";
import { API_BASE_URL } from "./serverConfigHooks";
import { useHandleDialog } from "./dialogHooks";

export const useHandleSocketUpload = (files, bufferSize) => {
  const {
    uploading,
    setUploading,
    readsTotal,
    setReadsTotal,
    readsProgressed,
    setReadsProgressed,
    readsFiltered,
    setReadsFiltered,
    bufferFill,
    setBufferFill,
  } = useStore(
    useShallow((state) => ({
      uploading: state.uploading,
      setUploading: state.setUploading,
      readsTotal: state.readsTotal,
      setReadsTotal: state.setReadsTotal,
      readsProgressed: state.readsProgressed,
      setReadsProgressed: state.setReadsProgressed,
      readsFiltered: state.readsFiltered,
      setReadsFiltered: state.setReadsFiltered,
      bufferFill: state.bufferFill,
      setBufferFill: state.setBufferFill,
    })),
  );

  const socket = io(API_BASE_URL, { autoConnect: false });

  const { displayDialog } = useHandleDialog();

  const startSocketUpload = () => {
    if (files.length === 0) return;
    socket.connect();
  };

  const uploadData = (data) => {
    console.debug("Uploading data to server:", data);
    socket.emit("dataUpload", data);
  };

  useEffect(() => {
    const onConnect = () => {
      console.debug("Socket connection to server established.");
      setUploading(true);
      setReadsProgressed(0);
      setBufferFill(0);
      setReadsTotal(0);
      setReadsFiltered(0);
    };

    const onDisconnect = () => {
      console.debug("Socket disconnected.");
      setUploading(false);
    };

    const onDataRequest = () => {
      console.debug("Server requested data.");
      // TODO: Get the requested amount of data
      const data = ["Test data"];
      uploadData(data);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("dataRequest", onDataRequest);

    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [
    socket,
    setUploading,
    setReadsProgressed,
    setBufferFill,
    setReadsTotal,
    setReadsFiltered,
  ]);

  return {
    startSocketUpload,
    uploading,
    readsTotal,
    readsProgressed,
    readsFiltered,
    bufferFill,
  };
};
