import { useEffect, useRef } from "react";
import useStore from "../store";
import { useShallow } from "zustand/react/shallow";
import { io } from "socket.io-client";
import { useHandleDialog } from "./dialogHooks";
import { readAndValidateFiles } from "./uploadHooks";
import { gzip } from "pako";
import { saveAs } from "file-saver";

export const useHandleSocketUpload = (files, downloadFiles) => {
  const {
    uploadStatus,
    setUploadStatus,
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
  } = useStore(
    useShallow((state) => ({
      uploadStatus: state.uploadStatus,
      setUploadStatus: state.setUploadStatus,
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
    })),
  );

  const socket = io({
    path: "/api/socket.io/",
    autoConnect: false,
    withCredentials: true,
    // transports: ["websocket"],
  });

  const { displayDialog } = useHandleDialog();
  // State that need to be accessed in socket event handlers need to be accessed via refs.
  // Otherwise state updates won't show up
  const linesRef = useRef(lines);
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

    // When all reads have been sent, return empty data to trigger context close
    if (i >= linesTotal) return { data, bytesSend: 0 };

    while (i < linesTotal) {
      const read = linesRef.current.map((fileLines) =>
        fileLines.slice(i, i + 4),
      );
      const readSize = read
        .map((readPart) => readPart[1].length)
        .reduce((sum, num) => sum + num);

      if (bytesSend + readSize >= bytes) break;
      data.push(read);
      i += 4;
      bytesSend += readSize;
    }

    setLinesOffset(i);
    linesOffsetRef.current = i;

    return { data, bytesSend };
  };

  const startDownload = (files, savedReads, fqsAsText) => {
    console.debug("SAVED READS:", savedReads);
    for (let i = 0; i < files.length; i++) {
      let fileText = fqsAsText[i]
        .filter((_, index) => savedReads.includes(fqsAsText[0][index * 4]))
        .join("\n");

      const blob =
        files[i].type === "application/gzip"
          ? new Blob([gzip(fileText)], { type: "application/gzip" })
          : new Blob([fileText], { type: "text/plain" });

      console.debug("Saving file:", files[i].name);
      saveAs(blob, `filtered.${files[i].name}`);
    }
  };

  const uploadData = (data, bytes, contextId) => {
    console.debug(`(${contextId}): Uploading ${bytes} bytes to server.`);
    socket.emit("dataUpload", {
      data: data,
      bytes: bytes,
      contextId: contextId,
    });
  };

  const resetUpload = () => {
    setUploadStatus(null);
    setReadsTotal(0);
    setReadsProgressed(0);
    setBufferFill(0);
    setLines(0);
    setLinesOffset(0);
    linesRef.current = null;
    linesOffsetRef.current = 0;
  };

  useEffect(() => {
    const onConnect = async () => {
      console.debug("Socket connection to server established.");
      setUploadStatus("UPLOADING");
      setReadsProgressed(0);
      setBufferFill(0);

      const { fqsAsText, readCount } = await readAndValidateFiles(
        files,
        displayDialog,
      );

      setReadsTotal(readCount);
      setLines(fqsAsText);
      linesRef.current = fqsAsText;
      createContext(files);
    };

    const onDisconnect = () => {
      console.debug("Socket disconnected.");
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
      // Download files
      if (downloadFiles) startDownload(files, savedReads, linesRef.current);
      setReadsProgressed(processedReads);
      socket.disconnect();
      setUploadStatus("SUCCESS");
    };

    const onConnectionError = (err) => {
      const { req, message, code, context } = err;
      setUploadStatus("ERROR");
      console.error(`Failed to connect to server:`);
      console.error(`Code: ${code}`);
      console.error(`Request: ${req}`);
      console.error(`Message: ${message}`);
      console.error(`Context: ${context}`);
    };

    const onContextCreationError = (payload) => {
      setUploadStatus("ERROR");
      const { message } = payload;
      console.error(`Failed to create context: ${message}`);
    };

    const onContextCloseError = (payload) => {
      setUploadStatus("ERROR");
      const { message } = payload;
      console.error(`Failed to close context: ${message}`);
    };

    const onDataUploadError = (payload) => {
      setUploadStatus("ERROR");
      const { message } = payload;
      console.error(`Failed to upload data: ${message}`);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("dataRequest", onDataRequest);
    socket.on("contextClosed", onContextClosed);
    socket.on("contextCloseError", onContextCloseError);
    socket.on("contextCreationError", onContextCreationError);
    socket.on("dataUploadError", onDataUploadError);
    socket.on("connect_error", onConnectionError);

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
    uploadStatus,
    setUploadStatus,
    readsTotal,
    readsProgressed,
    bufferFill,
    resetUpload,
  };
};
