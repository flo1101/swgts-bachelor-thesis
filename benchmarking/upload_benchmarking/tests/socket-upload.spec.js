// @ts-check
import { expect, test } from "@playwright/test";
import path from "path";
import fs from "fs";

const URL = "https://swgts.albi.hhu.de/";
const UPLOAD_REPETITIONS = 5;
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

// TESTS
test("socket-upload performance test", async ({ page }) => {
  // Remove default timeout for this test since upload times can vary substantially depending on file size
  const testStartTime = new Date();
  test.setTimeout(0);

  const results = [];

  for (const file of FILES) {
    const uploadTimes = [];
    console.debug(`Test socket upload for ${file.fileSizeMB} MB file.`);

    // Execute upload multiple times for each file and take average of measured values
    for (let i = 0; i < UPLOAD_REPETITIONS; i++) {
      console.debug(`Starting upload ${i + 1}...`);
      await page.goto(URL);

      // Set input files
      await page
        .locator(".file-explorer-input")
        .setInputFiles(
          path.join(__dirname, "..", "data", "combined_samples", file.fileName),
        );

      // Start the upload and track time
      const startTime = new Date();
      await page.locator(".start-socket-upload-button").click();
      const headline = page.locator(".progress-monitor h1");

      try {
        // Wait for element to be present
        await headline.waitFor({ timeout: 60000 });
        await expect(headline).toHaveText("Upload finished", { timeout: 0 });
      } catch (error) {
        console.error(`Socket upload run ${i + 1} failed:`, error);
        return;
      }

      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;
      uploadTimes.push(duration);

      console.debug(
        `Finished upload ${i + 1}. Upload took ${duration} seconds.`,
      );
    }

    // Calculate and print the average upload time
    const averageUploadTime = (
      uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length
    ).toFixed(3);

    console.debug(
      `Average socket-upload performance for ${file.fileSizeMB} MB file: ${averageUploadTime} seconds.`,
    );

    results.push({
      ...file,
      averageUploadTime,
    });
  }

  // Write results to CSV
  console.debug("Writing results to CSV...");
  const csvHeader =
    "File Name,File Size (MB),Reads Human,Reads Covid,Average Upload Time (s)\n"; // CSV header
  const csvData = results
    .map(
      (result) =>
        `${result.fileName},${result.fileSizeMB},${result.readsHuman},${result.readsCovid},${result.averageUploadTime}`,
    )
    .join("\n");

  const csvContent = csvHeader + csvData;

  try {
    fs.writeFileSync(
      path.join(
        __dirname,
        "..",
        "upload_results",
        "http_upload_performance.csv",
      ),
      csvContent,
    );
    console.log(
      "Upload performance data written to socket_upload_performance.csv",
    );
  } catch (err) {
    console.error("Error writing to CSV file:", err);
  }

  const testEndTime = new Date();
  const testDuration = (testEndTime.getTime() - testStartTime.getTime()) / 1000;
  console.debug(
    `Successfully finished testing socket-upload performance. Test took ${testDuration} seconds.`,
  );
});

test("http-upload performance test", async ({ page }) => {
  // Remove default timeout for this test since upload times can vary substantially depending on file size
  const testStartTime = new Date();
  test.setTimeout(0);
  const results = [];

  // Warm up server upload, to give server values to make approximations for request time
  console.debug("Performing warmup upload...");
  await page.goto(URL);
  await page
    .locator(".file-explorer-input")
    .setInputFiles(
      path.join(__dirname, "..", "data", "combined_samples", FILES[0].fileName),
    );
  await page.locator(".start-http-upload-button").click();

  const headline = page.locator(".progress-monitor h1");
  try {
    await headline.waitFor({ timeout: 60000 });
    await expect(headline).toHaveText("Upload finished", { timeout: 0 });
  } catch (error) {
    console.error(`HTTP warmup upload failed:`, error);
    return;
  }

  for (const file of FILES) {
    const uploadTimes = [];
    console.debug(`Test http upload for ${file.fileSizeMB} MB file.`);

    // Execute upload multiple times for each file and take average of measured values
    for (let i = 0; i < UPLOAD_REPETITIONS; i++) {
      console.debug(`Starting upload ${i + 1}...`);
      await page.goto(URL);

      // Set input files
      await page
        .locator(".file-explorer-input")
        .setInputFiles(
          path.join(__dirname, "..", "data", "combined_samples", file.fileName),
        );

      // Start the upload and track time
      const startTime = new Date();
      await page.locator(".start-http-upload-button").click();
      const headline = page.locator(".progress-monitor h1");

      try {
        // Wait for element to be present
        await headline.waitFor({ timeout: 60000 });
        await expect(headline).toHaveText("Upload finished", { timeout: 0 });
      } catch (error) {
        console.error(`HTTP upload run ${i + 1} failed:`, error);
        return;
      }

      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;
      uploadTimes.push(duration);

      console.debug(
        `Finished upload ${i + 1}. Upload took ${duration} seconds.`,
      );
    }

    // Calculate and print the average upload time
    const averageUploadTime = (
      uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length
    ).toFixed(3);

    console.debug(
      `Average http-upload performance for ${file.fileSizeMB} MB file: ${averageUploadTime} seconds.`,
    );

    results.push({
      ...file,
      averageUploadTime,
    });
  }

  // Write results to CSV
  console.debug("Writing results to CSV...");
  const csvHeader =
    "File Name,File Size (MB),Reads Human,Reads Covid,Average Upload Time (s)\n"; // CSV header
  const csvData = results
    .map(
      (result) =>
        `${result.fileName},${result.fileSizeMB},${result.readsHuman},${result.readsCovid},${result.averageUploadTime}`,
    )
    .join("\n");

  const csvContent = csvHeader + csvData;

  try {
    fs.writeFileSync(
      path.join(
        __dirname,
        "..",
        "upload_results",
        "http_upload_performance.csv",
      ),
      csvContent,
    );
    console.log(
      "Upload performance data written to http_upload_performance.csv",
    );
  } catch (err) {
    console.error("Error writing to CSV file:", err);
  }

  const testEndTime = new Date();
  const testDuration = (testEndTime.getTime() - testStartTime.getTime()) / 1000;
  console.debug(
    `Successfully finished testing http-upload performance. Test took ${testDuration} seconds.`,
  );
});
