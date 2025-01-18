import axios from "axios";
import { gzip, ungzip } from "pako";
import { saveAs } from "file-saver";
import { useHandleDialog } from "./dialogHooks";
import useStore from "../store";
import { useShallow } from "zustand/react/shallow";
import { API_BASE_URL } from "./serverConfigHooks";

const PACKAGE_SIZE = 100;
const WORKER_THREADS = 4;
const MAX_ATTEMPTS = 5;

// Sends a package of FASTQ lines
const sendFASTQPackage = async (lines, context) => {
  try {
    return await axios.post(`${API_BASE_URL}/context/${context}/reads`, lines);
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
  setReadsProgressed,
  setBufferFill,
  setReadsFiltered,
  bufferSize,
) => {
  let buffer = [];
  let currentSize = 0;
  let processedReads = 0; // TODO: keep track of and update processed reads

  for (let i = 0; i < lines[0].length; i += 4) {
    const readSize = lines
      .map((lines) => lines[i + 1].length)
      .reduce((sum, num) => sum + num);

    if (
      (currentSize + readSize >= bufferSize || i === lines[0].length - 4) &&
      currentSize !== 0
    ) {
      console.debug("Dispatching package of size ", currentSize);
      let attempts = 0;

      while (true) {
        if (attempts >= MAX_ATTEMPTS) throw new Error("Max attempts reached");

        try {
          const response = await sendFASTQPackage(buffer, context);

          if (response.status === 200) {
            setBufferFill(response.data.pendingBytes);
            break;
          } else {
            throw new Error(`Unexpected response: ${response.status}`);
          }
        } catch (error) {
          if (error.response?.status === 422) {
            const { pendingBytes, processedReads, retryAfter } =
              error.response.data;

            console.debug(
              `422 response received, slowing down... Retry after ${retryAfter} seconds`,
            );
            setBufferFill(pendingBytes);
            setReadsFiltered(processedReads);
            await sleep(retryAfter * 1000);
          } else {
            attempts++;
            console.error("Unexpected server error:", error.toString());
          }
        }
      }

      buffer = [];
      currentSize = 0;
    }

    buffer.push(lines.map((lines) => lines.slice(i, i + 4)));
    currentSize += readSize;
    setReadsProgressed(1);
  }
};

// Helper function to transform the async file reader into a pseudo-sync-able call
async function fastqFileToLines(file) {
  let data = await new Promise((resolve) => {
    let fileReader = new FileReader();
    fileReader.onload = (e) => resolve(fileReader.result);
    if (file.type === "application/gzip") {
      fileReader.readAsArrayBuffer(file);
    } else {
      fileReader.readAsText(file);
    }
  });

  if (file.name.split(".").pop().toLowerCase() === "gz") {
    return ungzip(new Uint8Array(data), { to: "string" }).trim().split("\n");
  } else {
    return data.trim().split("\n");
  }
}

// Create and handle worker threads
const createAndHandleThreads = async (
  fqsAsText,
  lineCount,
  contextId,
  updateReadsProgressed,
  setBufferFill,
  setReadsFiltered,
  bufferSize,
) => {
  const readCount = lineCount / 4;
  const workerCount = Math.min(WORKER_THREADS, readCount);
  const readsPerWorker = Math.ceil(readCount / workerCount);
  console.debug(
    `Starting ${workerCount} worker threads with ${readsPerWorker} reads each`,
  );

  const promises = Array.from({ length: workerCount }).map((_, threadId) => {
    const start = threadId * readsPerWorker * 4;
    const end = Math.min(start + readsPerWorker * 4, lineCount);
    const linesForWorker = fqsAsText.map((lines) => lines.slice(start, end));

    return workerThread(
      linesForWorker,
      contextId,
      updateReadsProgressed,
      setBufferFill,
      setReadsFiltered,
      bufferSize,
    );
  });

  return Promise.allSettled(promises);
};

// Read and validate uploaded files
const readAndValidateFiles = async (files, displayDialog) => {
  const fqsAsText = await Promise.all(
    files.map((file) => fastqFileToLines(file)),
  );
  const lineCounts = fqsAsText.map((f) => f.length);

  if (lineCounts[0] % 4 !== 0) {
    displayDialog("Invalid file format: lines not divisible by 4.");
    return null;
  }
  if (!lineCounts.every((count) => count === lineCounts[0])) {
    displayDialog("File line counts do not match.");
    return null;
  }

  const readCount = lineCounts[0] / 4;
  return {
    fqsAsText: fqsAsText,
    lineCount: lineCounts[0],
    readCount: readCount,
  };
};

const startDownload = (files, savedReads, fqsAsText) => {
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

// Creates a context and returns id of created context
const createContext = async (files) => {
  const { data } = await axios.post(`${API_BASE_URL}context/create`, {
    filenames: files.map((f) => f.name),
  });
  return data.context;
};

// Closes the context and returns saved reads
const closeContext = async (
  contextId,
  setBufferFill,
  updateReadsProgressed,
) => {
  try {
    const { data } = await axios.post(
      `${API_BASE_URL}/context/${contextId}/close`,
      {
        context: contextId,
      },
    );
    return data.saved;
  } catch (error) {
    // When data processing isn't finished yet, call closeContext recursively after timeout
    if (error.response?.status === 503) {
      const { pendingBytes, processedReads, retryAfter } = error.response.data;
      console.debug(
        `Server still working. Context ${contextId} can't be closed. Retry after ${retryAfter} seconds`,
      );
      setBufferFill(pendingBytes);
      updateReadsProgressed(processedReads);
      await sleep(retryAfter * 1000);
      return await closeContext(
        contextId,
        setBufferFill,
        updateReadsProgressed,
      );
    } else {
      console.error("Unexpected server error:", error.toString());
    }
  }
};

export const useHandleUpload = (files, downloadFiles = false, bufferSize) => {
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

  const { displayDialog } = useHandleDialog();

  const updateReadsProgressed = (value) => {
    setReadsProgressed((prev) => prev + value);
  };

  const startUpload = async () => {
    try {
      setUploading(true);
      setReadsFiltered(0);
      setReadsProgressed(0);

      // Read files
      const { fqsAsText, lineCount, readCount } = await readAndValidateFiles(
        files,
        displayDialog,
      );
      setReadsTotal(readCount);

      // Create context
      const contextId = await createContext(files);

      // TODO: merge workers into single async function for sending data
      // Create threads to handle file transmission
      await createAndHandleThreads(
        fqsAsText,
        lineCount,
        contextId,
        updateReadsProgressed,
        setBufferFill,
        setReadsFiltered,
        bufferSize,
      );

      // Close context
      const savedReads = await closeContext(
        contextId,
        setBufferFill,
        updateReadsProgressed,
      );
      console.debug("Context closed:", contextId);

      // Download filtered files
      console.debug(savedReads);
      if (downloadFiles) startDownload(files, savedReads, fqsAsText);
    } catch (error) {
      setUploading(false);
      console.error("Error during upload:", error);
      displayDialog(`Error during upload: ${error.message}`);
    }
  };

  return {
    startUpload,
    uploading,
    readsTotal: readsTotal,
    readsProgressed: readsProgressed,
    readsFiltered: readsFiltered,
    bufferFill,
  };
};
