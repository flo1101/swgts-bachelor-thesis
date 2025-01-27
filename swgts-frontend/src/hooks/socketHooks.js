import { useEffect, useRef } from "react";
import useStore from "../store";
import { useShallow } from "zustand/react/shallow";
import { io } from "socket.io-client";
import { API_BASE_URL } from "./serverConfigHooks";
import { useHandleDialog } from "./dialogHooks";
import { readAndValidateFiles } from "./uploadHooks";

export const useHandleSocketUpload = (files) => {
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
    lines,
    setLines,
    linesOffset,
    setLinesOffset,
    readSize,
    setReadSize,
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
      lines: state.lines,
      setLines: state.setLines,
      linesOffset: state.linesOffset,
      setLinesOffset: state.setLinesOffset,
      readSize: state.readSize,
      setReadSize: state.setReadSize,
    })),
  );

  const socket = io(API_BASE_URL, { autoConnect: false });

  const { displayDialog } = useHandleDialog();
  // State that need to be accessed in socket event handlers need to be accessed via refs.
  // Otherwise state updates won't show up
  const linesRef = useRef(lines);
  const readSizeRef = useRef(readSize);
  const linesOffsetRef = useRef(linesOffset);

  const startUpload = () => {
    if (files.length === 0) return;
    socket.connect();
  };

  const createContext = (files) => {
    socket.emit("createContext", {
      filenames: files.map((f) => f.name),
    });
  };

  const getUploadData = async (bytes) => {
    const data = [];
    let bytesSend = 0;
    let i = linesOffsetRef.current;
    while (bytesSend + readSizeRef.current < bytes) {
      data.push(linesRef.current.map((fileLines) => fileLines.slice(i, i + 4)));
      i += 4;
      bytesSend += readSizeRef.current;
    }
    setLinesOffset(i);
    linesOffsetRef.current = i;

    return { data, bytesSend };
  };

  const uploadData = (data, bytes, contextId) => {
    console.debug(`(${contextId}): Uploading ${bytes} bytes to server.`);
    socket.emit("dataUpload", {
      data: data,
      bytes: bytes,
      contextId: contextId,
    });
  };

  useEffect(() => {
    const onConnect = async () => {
      console.debug("Socket connection to server established.");
      setUploading(true);
      setReadsProgressed(0);
      setBufferFill(0);
      setReadsFiltered(0);

      const { fqsAsText, readCount } = await readAndValidateFiles(
        files,
        displayDialog,
      );
      const readSize = fqsAsText
        .map((lines) => lines[1].length)
        .reduce((sum, num) => sum + num);

      setReadsTotal(readCount);
      setLines(fqsAsText);
      setReadSize(readSize);
      linesRef.current = fqsAsText;
      readSizeRef.current = readSize;
      createContext(files);
    };

    const onDisconnect = () => {
      console.debug("Socket disconnected.");
      setUploading(false);
    };

    const onDataRequest = async (payload) => {
      // TODO: receive and update bufferFill, readsProgressed, readsFiltered
      const { bytes, contextId } = payload;
      console.debug(`(${contextId}): Server requested ${bytes} bytes.`);

      if (linesRef.current) {
        const { data, bytesSend } = await getUploadData(bytes);
        uploadData(data, bytesSend, contextId);
      }
    };

    const onContextCreationFailed = (payload) => {
      const { error } = payload;
      console.error(`Failed to create context: ${error}`);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("dataRequest", onDataRequest);
    socket.on("contextCreationFailed", onContextCreationFailed);

    // TODO: clean up listeners when socket gets disconnected.
    //  when done here listeners get removed immedeatly
    // return () => {
    //   console.debug("Remove listeners");
    //   socket.off("connect", onConnect);
    //   socket.off("disconnect", onDisconnect);
    //   socket.off("dataRequest", onDataRequest);
    //   socket.off("contextCreationFailed", onContextCreationFailed);
    // };
  }, [socket]);

  return {
    startSocketUpload: startUpload,
    uploading,
    readsTotal,
    readsProgressed,
    readsFiltered,
    bufferFill,
  };
};
