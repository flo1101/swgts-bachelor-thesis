// @ts-check
import { expect, test } from "@playwright/test";
import path from "path";
import fs from "fs";

const URL = "https://swgts.albi.hhu.de/";
const UPLOAD_REPETITIONS = 3;
const CLIENT_COUNT = parseInt(process.env.CLIENT_COUNT) || 2;
const FILES = [
  {
    fileName: "corona_human_sample_1.fastq",
    fileSizeMB: 24.4,
    readsHuman: 2000,
    readsCovid: 16000,
  },
  // {
  //   fileName: "corona_human_sample_2.fastq",
  //   fileSizeMB: 47.7,
  //   readsHuman: 1000,
  //   readsCovid: 40000,
  // },
  // {
  //   fileName: "corona_human_sample_3.fastq",
  //   fileSizeMB: 97.6,
  //   readsHuman: 1000,
  //   readsCovid: 85000,
  // },
];

// Performs single upload test. Returns average measured runtime.
async function uploadTest(
  page,
  file,
  uploadButtonSelector,
  clientId,
  repetitions = 1,
) {
  const uploadTimes = [];

  for (let i = 0; i < repetitions; i++) {
    console.debug(
      `(Client ${clientId}): Start upload test ${i + 1} for ${file.fileSizeMB} MB ...`,
    );

    await page.goto(URL);

    // Set input files
    await page
      .locator(".file-explorer-input")
      .setInputFiles(
        path.join(__dirname, "..", "data", "combined_samples", file.fileName),
      );

    // Start the upload and track time
    const startTime = new Date();
    await page.locator(uploadButtonSelector).click();
    const headline = page.locator(".progress-monitor h1");

    try {
      // Wait for upload completion
      await headline.waitFor({ timeout: 60000 });
      await expect(headline).toHaveText("Upload finished", { timeout: 0 });
    } catch (error) {
      console.error(`Upload test ${i + 1} failed:`, error);
      return null;
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    uploadTimes.push(duration);

    console.debug(
      `(Client ${clientId}): Upload test ${i + 1} finished. Upload took ${duration} seconds.`,
    );
  }

  // Return average upload time
  return (
    uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length
  ).toFixed(3);
}

function addToCSV(file, data) {
  try {
    fs.appendFileSync(file, data);
  } catch (err) {
    console.error("Error writing results to CSV:", err);
  }
}

// Since state can't be shared between parallel running tests, each worker/test writes it's result in the file directly
const RESULTS_CSV = path.join(
  __dirname,
  "..",
  "upload_results",
  "socket",
  `socket_upload_performance_clients.csv`,
);

// Write header to CSV only if the file doesn't exist or is empty
if (!fs.existsSync(RESULTS_CSV) || fs.statSync(RESULTS_CSV).size === 0) {
  const csvHeader =
    "File Name,File Size (MB),Reads Human,Reads Covid,Average Upload Time (s),ClientID,Client Count,Repetitions\n";
  try {
    console.debug("Writing CSV Header.");
    fs.writeFileSync(RESULTS_CSV, csvHeader);
  } catch (err) {
    console.error("Error writing results to CSV:", err);
  }
}

// Simulate multiple clients by creating tests dynamically and running them in parallel
test.describe.configure({ mode: "parallel" });
const file = FILES[0];

console.debug(
  `Testing socket upload with ${CLIENT_COUNT} clients for ${file.fileSizeMB} MB file.`,
);

// Setup clients and start uploads
for (let clientId = 1; clientId <= CLIENT_COUNT; clientId++) {
  test(`(Client ${clientId}): Socket upload test`, async ({ page }) => {
    console.debug(`(Client ${clientId}): Starting socket upload test.`);
    // Remove default timeout for this test since upload times can vary substantially depending on file size
    test.setTimeout(0);

    // Perform uploads and measure performance for each file
    const averageUploadTime = await uploadTest(
      page,
      file,
      ".start-socket-upload-button",
      clientId,
      UPLOAD_REPETITIONS,
    );
    console.debug(
      `(Client ${clientId}): Average socket-upload performance for ${file.fileSizeMB} MB file: ${averageUploadTime} seconds.`,
    );
    console.debug(`(Client ${clientId}): Writing result to CSV.`);
    const resultString = `${file.fileName},${file.fileSizeMB},${file.readsHuman},${file.readsCovid},${averageUploadTime},${clientId},${CLIENT_COUNT},${UPLOAD_REPETITIONS}\n`;
    addToCSV(RESULTS_CSV, resultString);
  });
}
