import { useEffect } from "react";
import useStore from "../store";
import { useShallow } from "zustand/react/shallow";
import { io } from "socket.io-client";
import { API_BASE_URL } from "./serverConfigHooks";
import { useHandleDialog } from "./dialogHooks";
import { readAndValidateFiles } from "./uploadHooks";

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

  const startUpload = () => {
    if (files.length === 0) return;
    socket.connect();
  };

  const createContext = (files) => {
    socket.emit("createContext", {
      filenames: files.map((f) => f.name),
    });
  };

  const uploadData = (data, contextId) => {
    console.debug(`(${contextId}): Uploading to server: ${data}`);
    socket.emit("dataUpload", { data: data, contextId: contextId });
  };

  useEffect(() => {
    const onConnect = async () => {
      console.debug("Socket connection to server established.");
      setUploading(true);
      setReadsProgressed(0);
      setBufferFill(0);
      setReadsFiltered(0);

      const { fqsAsText, lineCount, readCount } = await readAndValidateFiles(
        files,
        displayDialog,
      );
      setReadsTotal(readCount);
      createContext(files);
    };

    const onDisconnect = () => {
      console.debug("Socket disconnected.");
      setUploading(false);
    };

    const onDataRequest = (payload) => {
      // TODO: receive and update bufferFill, readsProgressed, readsFiltered
      const { bytes, contextId } = payload;
      console.debug(`(${contextId}): Server requested ${bytes} bytes.`);
      // TODO: Get the requested amount of data and send it
      const data = ["Test data"];
      uploadData(data, contextId);
    };

    const onContextCreationFailed = (payload) => {
      const { error } = payload;
      console.error(`Failed to create context: ${error}`);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("dataRequest", onDataRequest);
    socket.on("contextCreationFailed", onContextCreationFailed);

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
    startSocketUpload: startUpload,
    uploading,
    readsTotal,
    readsProgressed,
    readsFiltered,
    bufferFill,
  };
};
