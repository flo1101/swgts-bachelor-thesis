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

  const closeContext = (contextId) => {
    if (contextId)
      socket.emit("closeContext", {
        contextId: contextId,
      });
  };

  const getUploadData = async (bytes) => {
    const data = [];
    let bytesSend = 0;
    let i = linesOffsetRef.current;
    const linesTotal = linesRef.current[0].length;

    // When all reads have been sent, return empty data to close context
    if (i >= linesTotal) return { data, bytesSend: 0 };

    while (i < linesTotal) {
      const read = linesRef.current.map((fileLines) =>
        fileLines.slice(i, i + 4),
      );
      const readSize = read[0][1].length;
      if (bytesSend + readSize >= bytes) break;
      data.push(read);
      i += 4;
      bytesSend += readSize;
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

    const onDisconnect = (reason, details) => {
      console.debug("Socket disconnected");
      // Logs for debugging connection issues:
      // console.debug("Reason:", reason);
      // console.debug("Message:", details.message);
      // console.debug("Description:", details.description);
      // console.debug("Context:", details.context);
    };

    const onConnectionError = (err) => {
      const { req, message, code, context } = err;
      console.error(`Failed to connect to server:`);
      console.error(`Code: ${code}`);
      console.error(`Request: ${req}`);
      console.error(`Message: ${message}`);
      console.error(`Context: ${context}`);
    };

    const onDataRequest = async (payload) => {
      const { bytes, contextId, bufferFill, processedReads } = payload;
      console.debug(`(${contextId}): Server requested ${bytes} bytes.`);
      setBufferFill(bufferFill);
      setReadsProgressed(processedReads);

      if (linesRef.current) {
        const { data, bytesSend } = await getUploadData(bytes);

        if (data.length === 0) {
          console.debug(
            `(${contextId}): All reads sent. Request closing context.`,
          );
          closeContext(contextId);
        } else uploadData(data, bytesSend, contextId);
      }
    };

    // Received on successful close of context
    const onContextClosed = (payload) => {
      const { contextId, processedReads, savedReads } = payload;
      console.debug(
        `(${contextId}): Context closed. ${processedReads} reads processed.`,
      );
      // TODO: download filtered reads
      setReadsProgressed(processedReads);
      socket.disconnect();
      // setUploading(false);
    };

    const onContextCreationError = (payload) => {
      const { message } = payload;
      console.error(`Failed to create context: ${message}`);
    };

    const onContextCloseError = (payload) => {
      const { message } = payload;
      console.error(`Failed to close context: ${message}`);
    };

    const onDataUploadError = (payload) => {
      const { message } = payload;
      console.error(`Failed to upload data: ${message}`);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connectionError", onConnectionError);
    socket.on("dataRequest", onDataRequest);
    socket.on("contextClosed", onContextClosed);
    socket.on("contextCloseError", onContextCloseError);
    socket.on("contextCreationError", onContextCreationError);
    socket.on("dataUploadError", onDataUploadError);

    // TODO: clean up listeners when socket gets disconnected.
    //  when done here listeners get removed immedeatly
    // return () => {
    //   console.debug("Remove listeners");
    //   socket.off("connect", onConnect);
    //   socket.off("disconnect", onDisconnect);
    //   socket.off("dataRequest", onDataRequest);
    //   socket.off("contextCreationError", onContextCreationError);
    // sokcet.off("dataUploadError", onDataUploadError);
    // };
  }, [socket]);

  return {
    startSocketUpload: startUpload,
    uploading,
    readsTotal,
    readsProgressed,
    bufferFill,
  };
};
