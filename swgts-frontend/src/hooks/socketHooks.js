import { useEffect } from "react";
import useStore from "../store";
import { useShallow } from "zustand/react/shallow";
import { io } from "socket.io-client";
import { API_BASE_URL } from "./serverConfigHooks";

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

  const startSocketUpload = () => {
    if (files.length === 0) return;
    socket.connect();
  };

  useEffect(() => {
    const onConnect = () => {
      console.debug(
        "Socket connection to server established. Starting upload...",
      );
      setUploading(true);
      setReadsProgressed(0);
      setBufferFill(0);
      setReadsTotal(0);
      setReadsFiltered(0);
    };

    socket.on("connect", onConnect);

    return () => {
      socket.off("connect");
      socket.disconnect();
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
