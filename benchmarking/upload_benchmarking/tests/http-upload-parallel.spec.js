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
const RESULTS_CSV = path.join(
  __dirname,
  "..",
  "upload-test-results",
  "http",
  `http_upload_performance_parallel.csv`,
);

// Performs single upload test. Returns measured upload times.
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
    uploadTimes.push(duration.toFixed(3));

    console.debug(
      `(Client ${clientId}): Upload test ${i + 1} finished. Upload took ${duration} seconds.`,
    );
  }
  return uploadTimes;
}

function addToCSV(file, data) {
  try {
    fs.appendFileSync(file, data);
  } catch (err) {
    console.error("Error writing results to CSV:", err);
  }
}

// Write header to CSV only if the file doesn't exist or is empty
if (!fs.existsSync(RESULTS_CSV) || fs.statSync(RESULTS_CSV).size === 0) {
  const csvHeader =
    "File Name,File Size (MB),Reads Human,Reads Covid,Upload Time (s),ClientID,Client Count,Repetition\n";
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
  `Testing HTTP upload with ${CLIENT_COUNT} clients for ${file.fileSizeMB} MB file.`,
);

for (let clientId = 1; clientId <= CLIENT_COUNT; clientId++) {
  test(`(Client ${clientId}): HTTP upload test`, async ({ page }) => {
    console.debug(`(Client ${clientId}): Starting HTTP upload test.`);
    // Remove default timeout since upload times can vary substantially depending on file size
    test.setTimeout(0);

    // Perform uploads and measure performance for each file
    const measuredUploadTimes = await uploadTest(
      page,
      file,
      ".start-http-upload-button",
      clientId,
      UPLOAD_REPETITIONS,
    );
    console.debug(
      `(Client ${clientId}): HTTP-upload performance for ${file.fileSizeMB} MB file: ${measuredUploadTimes} seconds.`,
    );

    // Since state can't be shared between parallel running tests, each client/test writes its result in the csv directly
    console.debug(`(Client ${clientId}): Writing result to CSV.`);
    measuredUploadTimes.forEach((uploadTime, i) => {
      const resultString = `${file.fileName},${file.fileSizeMB},${file.readsHuman},${file.readsCovid},${uploadTime},${clientId},${CLIENT_COUNT},${i + 1}\n`;
      addToCSV(RESULTS_CSV, resultString);
    });
  });
}
