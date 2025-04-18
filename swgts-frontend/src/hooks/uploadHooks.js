import axios from "axios";
import { gzip, ungzip } from "pako";
import { saveAs } from "file-saver";
import { useHandleDialog } from "./dialogHooks";
import useStore from "../store";
import { useShallow } from "zustand/react/shallow";
import { FLASK_API_URL } from "./serverConfigHooks";

const WORKER_THREADS = 4;
const MAX_ATTEMPTS = 5;

// Sends a package of FASTQ lines
const sendFASTQPackage = async (lines, context) => {
  try {
    return await axios.post(`${FLASK_API_URL}context/${context}/reads`, lines);
  } catch (error) {
    throw error;
  }
};

// Sleep function to handle delays
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Worker thread to process chunks of FASTQ data
const workerThread = async (
  lines,
  contextId,
  setReadsProgressed,
  setBufferFill,
  requestSize,
) => {
  let buffer = [];
  let currentSize = 0;

  for (let i = 0; i < lines[0].length; i += 4) {
    const readSize = lines
      .map((lines) => lines[i + 1].length)
      .reduce((sum, num) => sum + num);

    if (
      (currentSize + readSize >= requestSize || i === lines[0].length - 4) &&
      currentSize !== 0
    ) {
      console.debug("Dispatching package of size ", currentSize);
      let attempts = 0;

      while (true) {
        if (attempts >= MAX_ATTEMPTS) throw new Error("Max attempts reached");

        try {
          const response = await sendFASTQPackage(buffer, contextId);

          if (response.status === 200) {
            const { processedReads, pendingBytes } = response.data;
            setReadsProgressed(processedReads);
            setBufferFill(pendingBytes);
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
            setReadsProgressed(processedReads);
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
  }
};

// Helper function to transform the async file reader into a pseudo-sync-able call
export async function fastqFileToLines(file) {
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
    // FIXME: for large fastq.gz files the decompressed data is too large to be stored in a single string and throws an error
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
  setReadsProgressed,
  setBufferFill,
  requestSize,
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
      setReadsProgressed,
      setBufferFill,
      requestSize,
    );
  });

  return Promise.allSettled(promises);
};

// Read and validate uploaded files
export const readAndValidateFiles = async (files, displayDialog) => {
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
  const { data } = await axios.post(`${FLASK_API_URL}context/create`, {
    filenames: files.map((f) => f.name),
  });
  return data.context;
};

// Closes the context and returns saved reads
const closeContext = async (contextId, setBufferFill, setReadsProgressed) => {
  try {
    const { data } = await axios.post(
      `${FLASK_API_URL}context/${contextId}/close`,
      {
        context: contextId,
      },
    );
    const { readsProcessed, readsSaved } = data;
    setReadsProgressed(readsProcessed);
    return readsSaved;
  } catch (error) {
    // When data processing isn't finished yet, call closeContext recursively after timeout
    if (error.response?.status === 503) {
      const {
        pendingBytes,
        processedReads,
        retryAfter = 1,
      } = error.response.data;
      console.debug(
        `Context ${contextId} can't be closed - server still working. Retry after ${retryAfter} seconds`,
      );
      if (pendingBytes) setBufferFill(pendingBytes);
      if (processedReads) setReadsProgressed(processedReads);
      await sleep(retryAfter * 1000);
      return await closeContext(contextId, setBufferFill, setReadsProgressed);
    } else {
      console.error("Unexpected server error:", error.toString());
    }
  }
};

export const useHandleUpload = (files, downloadFiles = false, requestSize) => {
  const {
    uploadStatus,
    setUploadStatus,
    readsTotal,
    setReadsTotal,
    readsProgressed,
    setReadsProgressed,
    bufferFill,
    setBufferFill,
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
    })),
  );

  const { displayDialog } = useHandleDialog();

  const startUpload = async () => {
    try {
      setUploadStatus("UPLOADING");
      setReadsProgressed(0);
      setBufferFill(0);

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
        setReadsProgressed,
        setBufferFill,
        requestSize,
      );

      // Close context
      const savedReads = await closeContext(
        contextId,
        setBufferFill,
        setReadsProgressed,
      );
      setReadsProgressed(readCount);
      setBufferFill(0);
      setUploadStatus("SUCCESS");

      // Download filtered files
      if (downloadFiles) startDownload(files, savedReads, fqsAsText);
    } catch (error) {
      setUploadStatus("ERROR");
      console.error("Error during upload:", error);
      displayDialog(`Error during upload: ${error.message}`);
    }
  };

  return {
    startUpload,
    readsTotal,
    readsProgressed,
    bufferFill,
    uploadStatus,
    setUploadStatus,
  };
};
