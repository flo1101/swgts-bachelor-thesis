import axios from "axios";
import { gzip, ungzip } from "pako";
import { saveAs } from "file-saver";

const PACKAGE_SIZE = 100;
const WORKER_THREADS = 4;
const MAX_ATTEMPTS = 5;

async function sendFASTQPackage(lines, context) {
  console.log("Sending: ", lines);
  return new Promise(async (resolve, reject) => {
    try {
      let response = await axios.post(
        "/api/context/" + context + "/reads",
        lines,
      );
      resolve(response);
    } catch (error) {
      reject(error);
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function workerThread(
  lines_per_readfile,
  context,
  updateProgressCallback,
  updateBufferFillCallback,
  updateFilteredCallback,
  buffer_size,
) {
  return new Promise(async (resolve, reject) => {
    //console.log("Hi, this is me, a worker thread, I am working with this data here:",lines_per_readfile)
    let buffer = [];
    let current_size = 0;
    let processed_reads = 0;
    for (let i = 0; i < lines_per_readfile[0].length; i += 4) {
      let read_size = lines_per_readfile
        .map((readfile_lines) => readfile_lines[i + 1].length)
        .reduce((sum, num) => sum + num);
      if (
        (current_size + read_size >= buffer_size ||
          i === lines_per_readfile[0].length - 4) &&
        current_size !== 0
      ) {
        console.log("Dispatching package of size ", current_size);
        let attempts = 0;
        while (true) {
          //Do not loop forever, if at some point we exceed a set amount of attempts we surrender
          if (attempts >= MAX_ATTEMPTS) {
            reject(); //TODO: Return some more info to display in browser
          }
          try {
            //The actual chunk send, we (pseudo) block here and WAIT
            let response = await sendFASTQPackage(buffer, context);
            //Handling of Responses
            if (response.status === 200) {
              updateBufferFillCallback(response.data["pending bytes"]);
              break;
              //Everything is ok, everything is fine
            } else {
              //Weird response code from server ...
              reject(response.status);
            }
          } catch (error) {
            if (error.response.status === 422) {
              console.log(error.response.data);
              updateBufferFillCallback(error.response.data["pending bytes"]);
              updateFilteredCallback(error.response.data["processed reads"]);
              console.log(
                'got an "orderly" 422 response asking me to slow down ...',
              );
              let timeout = parseFloat(
                error.response.headers.get("retry-after"),
              );
              console.log(error.response.headers.get("retry-after"));
              console.log(`sleeping for ${timeout} seconds zzzzzzzz`);
              //await sleep(timeout*1000);
              await sleep(10000);
            } else {
              console.log(
                "got an unexpected error from the server side:",
                error.toString(),
              );
              //Escalate error and show issue graphically to user
              attempts += 1;
            }
          }
        }

        buffer = [];
        current_size = 0;
      }
      buffer.push(
        lines_per_readfile.map((readfile_lines) =>
          readfile_lines.slice(i, i + 4),
        ),
      );
      current_size += read_size;
      updateProgressCallback(1);
    }
    //TODO: Return true/false
    resolve();
  });
}

//Helper function to transform the async file reader into a pseudo-sync-able call
async function fastqFileToLines(f) {
  let data = await new Promise((resolve) => {
    let fileReader = new FileReader();
    fileReader.onload = (e) => resolve(fileReader.result);
    if (f.type === "application/gzip") {
      fileReader.readAsArrayBuffer(f);
    } else {
      fileReader.readAsText(f);
    }
  });

  if (f.name.split(".").pop().toLowerCase() === "gz") {
    return ungzip(new Uint8Array(data), { to: "string" }).trim().split("\n");
  } else {
    return data.trim().split("\n");
  }
}

/**
 * TODO: move state from parameters into zustand store
 */
async function uploadFASTQ(
  files,
  downloadFiles,
  bufferSize,
  // Params whose state to move:
  updateProgress,
  setTotal,
  setBufferFill,
  setFiltered,
  displayDialog,
) {
  console.log("Uploading files: ", files);
  try {
    const fqsAsText = await Promise.all(files.map((f) => fastqFileToLines(f)));
    //Read the file and perform basic sanity checks
    const lineCounts = fqsAsText.map((f) => f.length);
    //Use the first file as placeholder and check for valid linecount
    if (lineCounts[0] % 4 !== 0) {
      displayDialog(
        `Found a number of lines not divisible by 4 (${lineCounts[0].length}), likely a corrupted file!`,
      );
      return;
    }
    //For paired read files: Check match between read counts
    if (!lineCounts.every((f) => f === lineCounts[0])) {
      displayDialog(
        `The files have a different linecount (${lineCounts}) and can therefore not be paired!`,
      );
      return;
    }
    const readCounts = lineCounts.map((x) => x / 4);

    let a = await axios.post("/api/context/create", {
      filenames: files.map((f) => f.name),
    });
    const context = a.data.context;

    //Calculate Read Count
    setTotal(readCounts[0]);
    console.log("Found a total of " + readCounts[0] + " reads");

    //For edge cases: Limit workers if less reads are in the file
    let worker_threads = Math.min(readCounts[0], WORKER_THREADS);

    //Calculate the lines per worker
    const readsPerWorker = Math.ceil(readCounts[0] / worker_threads);
    console.log(`Using ${readsPerWorker} read(s) per worker`);
    //Stores one promise per worker thread
    const promisesPerWorker = [];

    for (let threadid = 0; threadid < worker_threads; threadid += 1) {
      const start = threadid * readsPerWorker * 4;
      const end = Math.min((threadid + 1) * readsPerWorker * 4, lineCounts[0]);
      //edge case for few reads and many workers
      if (start >= lineCounts[0]) {
        continue;
      }
      const linesForWorker = fqsAsText.map((a) => a.slice(start, end));
      console.log(
        "Starting worker with ID:" +
          threadid +
          " that will process reads from " +
          start / 4 +
          " to " +
          end / 4,
      );
      promisesPerWorker.push(
        workerThread(
          linesForWorker,
          context,
          updateProgress,
          setBufferFill,
          setFiltered,
          bufferSize,
        ),
      );
    }

    //Join on all async threads
    await Promise.allSettled(promisesPerWorker);

    //We end the session and close the remote context
    while (true) {
      //TODO: Enable graceful termination

      try {
        let response = await axios.post("/api/context/" + context + "/close", {
          context: context,
        });
        //Handling of Responses
        if (response.status === 200) {
          displayDialog(
            response.data.saved.length +
              "/" +
              response.data.total +
              " reads kept.",
          );
        } else {
          //Weird response code from server ...
          throw new Error("Weird response code from server!");
        }

        //Reconstruct the files if downloading is selected
        if (downloadFiles) {
          //Reconstruct fastqs
          for (let file_index = 0; file_index < files.length; file_index += 1) {
            let lines = fqsAsText[file_index];
            let text = ""; //Excessive memory consumption but just locally :)
            for (let i = 0; i < lines.length; i += 4) {
              if (response.data.saved.includes(fqsAsText[0][i])) {
                //Server only responds by sending back the read ids from the first file (in paired mode)
                text += lines[i] + "\n";
                text += lines[i + 1] + "\n";
                text += lines[i + 2] + "\n";
                text += lines[i + 3] + "\n";
              }
            }
            if (files[file_index].type === "application/gzip") {
              const compressed_array = gzip(text);
              let blob = new Blob([compressed_array], {
                type: "application/gzip;charset=octet-stream",
              });
              saveAs(blob, "filtered." + files[file_index].name);
            } else {
              let blob = new Blob([text], { type: "text/plain;charset=utf-8" });
              saveAs(blob, "filtered." + files[file_index].name);
            }
          }
        }
        break;
      } catch (error) {
        if (error.response.status === 503) {
          console.log(error.response.data);
          setBufferFill(error.response.data["pending bytes"]);
          setFiltered(error.response.data["processed reads"]);
          console.log(
            'got an "orderly" 422 response asking me to slow down ...',
          );
          const timeout = error.response.headers["Retry-After"];
          console.log(`sleeping for ${timeout} seconds zzzzzzzz`);
          await sleep(timeout * 1000);
        } else {
          throw error;
          //Escalate error and show issue graphically to user
        }
      }
    }
  } catch (e) {
    //TODO: Differentiate and send a more informative response based on the nature of the issue
    console.log(e);
    displayDialog(e.toString());
  }
}

export { uploadFASTQ };
