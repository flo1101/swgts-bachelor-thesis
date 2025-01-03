import axios from "axios";
import { gzip, ungzip } from "pako";
import { saveAs } from "file-saver";
import { useStore } from "zustand";
import {useHandleDialog} from "./dialogHooks";

const PACKAGE_SIZE = 100;
const WORKER_THREADS = 4;
const MAX_ATTEMPTS = 5;

// Sends a package of FASTQ lines
const sendFASTQPackage = async (lines, context) => {
  try {
    return await axios.post(`/api/context/${context}/reads`, lines);
  } catch (error) {
    throw error;
  }
};

// Sleep function to handle delays
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Worker thread to process chunks of FASTQ data
const workerThread = async (
  lines,
  context,
  updateProgress,
  updateBufferFill,
  updateFiltered,
  bufferSize,
) => {
  let buffer = [];
  let currentSize = 0;

  for (let i = 0; i < lines[0].length; i += 4) {
    const readSize = lines
      .map((lines) => lines[i + 1].length)
      .reduce((sum, num) => sum + num);

    if (
      (currentSize + readSize >= bufferSize || i === lines[0].length - 4) &&
      currentSize !== 0
    ) {
      console.log("Dispatching package of size ", currentSize);
      let attempts = 0;

      while (true) {
        if (attempts >= MAX_ATTEMPTS) throw new Error("Max attempts reached");

        try {
          const response = await sendFASTQPackage(buffer, context);

          if (response.status === 200) {
            updateBufferFill(response.data["pending bytes"]);
            break;
          } else {
            throw new Error(`Unexpected response: ${response.status}`);
          }
        } catch (error) {
          if (error.response?.status === 422) {
            console.log("422 response received, slowing down...");
            updateBufferFill(error.response.data["pending bytes"]);
            updateFiltered(error.response.data["processed reads"]);
            const retryAfter = error.response.headers["Retry-After"];
            console.debug("retry after:", retryAfter);
            await sleep(10000); // Default sleep for 10 seconds
          } else {
            attempts++;
            console.error("Unexpected server error:", error);
          }
        }
      }

      buffer = [];
      currentSize = 0;
    }

    buffer.push(lines.map((lines) => lines.slice(i, i + 4)));
    currentSize += readSize;
    updateProgress(1);
  }
};

// Read and parse FASTQ files
const fastqFileToLines = async (file) => {
  const data = await new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(fileReader.result);
    fileReader[
      file.type === "application/gzip" ? "readAsArrayBuffer" : "readAsText"
    ](file);
  });

  return file.name.endsWith(".gz")
    ? ungzip(new Uint8Array(data), { to: "string" }).trim().split("\n")
    : data.trim().split("\n");
};

// Create amd handle worker threads
const createAndHandleThreads = async (
  fqsAsText,
  lineCount,
  contextId,
  setProgress,
  setBufferFill,
  setFiltered,
  bufferSize,
) => {
  const readCount = lineCount / 4;
  const workerCount = Math.min(WORKER_THREADS, readCount);
  const readsPerWorker = Math.ceil(readCount / workerCount);

  const promises = Array.from({ length: workerCount }).map((_, threadId) => {
    const start = threadId * readsPerWorker * 4;
    const end = Math.min(start + readsPerWorker * 4, lineCount);
    const lines = fqsAsText.map((fileLines) => fileLines.slice(start, end));

    return workerThread(
      lines,
      contextId,
      setProgress,
      setBufferFill,
      setFiltered,
      bufferSize,
    );
  });

  return Promise.allSettled(promises);
};

// Read and validate uploaded files
const readAndValidateFiles = async (files, displayDialog) => {
  const fqsAsText = await Promise.all(files.map(fastqFileToLines));
  const lineCounts = fqsAsText.map((f) => f.length);

  if (lineCounts[0] % 4 !== 0) {
    displayDialog("Invalid file format: lines not divisible by 4.");
    return null;
  }
  if (!lineCounts.every((count) => count === lineCounts[0])) {
    displayDialog("File line counts do not match.");
    return null;
  }

  const readCounts = lineCounts[0] / 4;
  return { fqsAsText: fqsAsText, lineCount: lineCounts[0], readCounts };
};

const startDownload = (files, savedReads, fqsAsText) => {
  for (let i = 0; i < files.length; i++) {
    let fileText = fqsAsText[i]
      .filter((_, index) => savedReads.saved.includes(fqsAsText[0][index * 4]))
      .join("\n");

    const blob =
      files[i].type === "application/gzip"
        ? new Blob([gzip(fileText)], { type: "application/gzip" })
        : new Blob([fileText], { type: "text/plain" });

    saveAs(blob, `filtered.${files[i].name}`);
  }
};

// Creates a context and returns id of created context
const createContext = async (files) => {
  const { data } = await axios.post("/api/context/create", {
    filenames: files.map((f) => f.name),
  });
  return data.context;
};

// Closes the context and returns saved reads
const closeContext = async (contextId) => {
  const { data } = await axios.post(`/api/context/${contextId}/close`, {
    context: contextId,
  });
  return data.saved;
};

export const useHandleUpload = (files, downloadFiles = false, bufferSize) => {
  const {
    uploading,
    setUploading,
    readCount,
    setReadCount,
    progress,
    setProgress,
    filtered,
    setFiltered,
    bufferFill,
    setBufferFill,
  } = useStore((state) => ({
    uploading: state.uploading,
    setUploading: state.setUploading,
    readCount: state.readCount,
    setReadCount: state.setReadCount,
    progress: state.progress,
    setProgress: state.setProgress,
    filtered: state.filtered,
    setFiltered: state.setFiltered,
    bufferFill: state.bufferFill,
    setBufferFill: state.setBufferFill,
  }));

  const {displayDialog} = useHandleDialog();

  const startUpload = async () => {
    try {
      setUploading(true)
      setFiltered(0);
      setProgress(0);

      // Read files
      const { fqsAsText, lineCount, readCount } = readAndValidateFiles(
        files,
        displayDialog,
      );
      setReadCount(readCount);

      // Create context
      const contextId = await createContext(files);

      // Create threads to handle file transmission
      await createAndHandleThreads(
        fqsAsText,
        lineCount,
        contextId,
        setProgress,
        setBufferFill,
        setFiltered,
        bufferSize,
      );

      // Close context
      const savedReads = closeContext(contextId);

      // Download filtered files
      if (downloadFiles) startDownload(files, savedReads, fqsAsText);
    } catch (error) {
      setUploading(false)
      displayDialog(`Error during upload: ${error.message}`);
    }
  };

  return { startUpload, uploading, readCount, progress, filtered, bufferFill };
};
