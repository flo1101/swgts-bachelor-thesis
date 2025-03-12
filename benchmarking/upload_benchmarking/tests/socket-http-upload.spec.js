// @ts-check
import { expect, test } from "@playwright/test";
import path from "path";
import fs from "fs";

const URL = "https://swgts.albi.hhu.de/";
const UPLOAD_REPETITIONS = 3;
const FILES = [
  {
    fileName: "corona_human_sample_1.fastq",
    fileSizeMB: 12.2,
    readsHuman: 1000,
    readsCovid: 8000,
  },
  {
    fileName: "corona_human_sample_2.fastq",
    fileSizeMB: 47.7,
    readsHuman: 1000,
    readsCovid: 40000,
  },
  {
    fileName: "corona_human_sample_3.fastq",
    fileSizeMB: 97.6,
    readsHuman: 1000,
    readsCovid: 85000,
  },
];

// Performs single upload test. Returns average measured runtime.
async function uploadTest(
  page,
  file,
  uploadButtonSelector,
  repetitions = UPLOAD_REPETITIONS,
) {
  const uploadTimes = [];

  for (let i = 0; i < repetitions; i++) {
    console.debug(`Start upload test ${i + 1} for ${file.fileSizeMB} MB ...`);

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
      `Upload test ${i + 1} finished. Upload took ${duration} seconds.`,
    );
  }

  // Return average upload time
  return (
    uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length
  ).toFixed(3);
}

function writeResultsToCSV(filename, results) {
  console.debug("Writing results to CSV...");
  const csvHeader =
    "File Name,File Size (MB),Reads Human,Reads Covid,Average Upload Time (s)\n"; // CSV header
  const csvData = results
    .map(
      (result) =>
        `${result.fileName},${result.fileSizeMB},${result.readsHuman},${result.readsCovid},${result.averageUploadTime}`,
    )
    .join("\n");

  try {
    fs.writeFileSync(
      path.join(__dirname, "..", "upload_results", filename),
      csvHeader + csvData,
    );
    console.log(`Upload performance data written to ${filename}`);
  } catch (err) {
    console.error("Error writing to CSV file:", err);
  }
}

test("socket-upload performance test", async ({ page }) => {
  const testStartTime = new Date();
  const results = [];
  // Remove default timeout for this test since upload times can vary substantially depending on file size
  test.setTimeout(0);

  // Perform uploads and measure performance for each file
  for (const file of FILES) {
    console.debug(`Test socket-upload for ${file.fileSizeMB} MB file.`);
    const averageUploadTime = await uploadTest(
      page,
      file,
      ".start-socket-upload-button",
    );
    console.debug(
      `Average socket-upload performance for ${file.fileSizeMB} MB file: ${averageUploadTime} seconds.`,
    );
    results.push({
      ...file,
      averageUploadTime,
    });
  }

  writeResultsToCSV("socket/socket_upload_performance.csv", results);
  const testEndTime = new Date();
  const testDuration = (testEndTime.getTime() - testStartTime.getTime()) / 1000;
  console.debug(
    `Successfully finished testing socket-upload performance. Test took ${testDuration} seconds.`,
  );
});

test("http-upload performance test", async ({ page }) => {
  const testStartTime = new Date();
  const results = [];
  // Remove default timeout for this test since upload times can vary substantially depending on file size
  test.setTimeout(0);

  // Warm up upload, to give server values to make approximations for request time
  await uploadTest(page, FILES[0], ".start-http-upload-button", 1);

  for (const file of FILES) {
    console.debug(`Test http upload for ${file.fileSizeMB} MB file.`);
    // Calculate and print the average upload time
    const averageUploadTime = await uploadTest(
      page,
      file,
      ".start-http-upload-button",
    );
    console.debug(
      `Average http-upload performance for ${file.fileSizeMB} MB file: ${averageUploadTime} seconds.`,
    );
    results.push({
      ...file,
      averageUploadTime,
    });
  }

  writeResultsToCSV("http/http_upload_performance.csv", results);
  const testEndTime = new Date();
  const testDuration = (testEndTime.getTime() - testStartTime.getTime()) / 1000;
  console.debug(
    `Successfully finished testing http-upload performance. Test took ${testDuration} seconds.`,
  );
});
