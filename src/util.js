const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const { generatePerceptualHash } = require("./phash");

// File paths for storing and reading duplicate data, and base directory for videos
const videosBaseDir = "C:\\Users\\osistlk\\Videos\\edits\\input";
const duplicatesFilePath = "duplicates.json";

/**
 * Compares two sets of hashes to find matches based on a threshold and match percentage.
 * @param {Array} hashSet1 - The first set of hashes to compare.
 * @param {Array} hashSet2 - The second set of hashes to compare.
 * @param {Number} threshold - The maximum difference between hashes to consider a match.
 * @param {Number} matchPercentage - The minimum percentage of matches needed to consider the sets similar.
 * @returns {Boolean} - Whether the match ratio meets or exceeds the match percentage.
 */
function compareHashSets(
  hashSet1,
  hashSet2,
  threshold = 5,
  matchPercentage = 0.5,
) {
  let matches = 0;
  hashSet1.forEach((hash1) => {
    hashSet2.forEach((hash2) => {
      // Calculate the difference between two hashes
      let difference = hash1
        .split("")
        .filter((bit, index) => bit !== hash2[index]).length;
      if (difference <= threshold) {
        matches++;
      }
    });
  });

  // Calculate the match percentage
  const minSize = Math.min(hashSet1.length, hashSet2.length);
  const matchRatio = matches / minSize;

  return matchRatio >= matchPercentage;
}

/**
 * Finds duplicate videos within a directory by comparing their perceptual hashes.
 * @param {String} directory - The directory to search for duplicate videos.
 * @returns {Object} - A map of video directories to their duplicates.
 */

async function findDuplicates(directory) {
  // Get all video directories within the specified directory
  const videoDirs = fs
    .readdirSync(directory)
    .filter((file) => fs.statSync(path.join(directory, file)).isDirectory());
  const videoHashes = {};
  const duplicatesMap = {};

  // Progress display initialization
  let processed = 0;
  const total = videoDirs.length;
  console.log("");
  console.log("\x1b[36m%s\x1b[0m", `Processing ${total} directories...`);

  for (const videoDir of videoDirs) {
    // Process each video directory to extract keyframes and generate hashes
    const keyframeDir = path.join(directory, videoDir);
    const keyframeFiles = fs
      .readdirSync(keyframeDir)
      .filter((file) => path.extname(file) === ".jpg");
    videoHashes[videoDir] = [];

    for (const file of keyframeFiles) {
      // Generate and store perceptual hash for each keyframe
      const hash = await generatePerceptualHash(path.join(keyframeDir, file));
      videoHashes[videoDir].push(hash);
    }

    // Update progress for each processed directory
    processed++;
    process.stdout.write(
      `\r\x1b[35mProgress: ${processed}/${total} directories processed.\x1b[0m`,
    );
  }

  // Compare hashes of all videos to find duplicates
  videoDirs.forEach((videoDir, index) => {
    duplicatesMap[videoDir] = [];
    for (let i = 0; i < videoDirs.length; i++) {
      if (i !== index) {
        const otherVideoDir = videoDirs[i];
        if (
          compareHashSets(videoHashes[videoDir], videoHashes[otherVideoDir])
        ) {
          // If duplicates are found, store them in the map
          duplicatesMap[videoDir].push(otherVideoDir);
        }
      }
    }
  });

  return duplicatesMap;
}

/**
 * Moves duplicate videos to a designated duplicates directory.
 */

async function moveDuplicates() {
  // Read duplicate data from JSON file
  const duplicatesData = JSON.parse(
    fs.readFileSync(duplicatesFilePath, "utf8"),
  );
  const duplicatesDir = path.join(videosBaseDir, "duplicates");

  // Create the duplicates directory if it doesn't exist
  if (!fs.existsSync(duplicatesDir)) {
    fs.mkdirSync(duplicatesDir, { recursive: true });
  }

  // A set to keep track of videos that have already been processed
  const processedVideos = new Set();

  // Iterate over the duplicates map
  Object.entries(duplicatesData).forEach(([videoDir, duplicateDirs]) => {
    // Always process the first directory as it contains the original
    if (!processedVideos.has(videoDir)) {
      processedVideos.add(videoDir);
    }

    duplicateDirs.forEach((dupDir) => {
      // Move the video only if it has not been processed yet
      if (!processedVideos.has(dupDir)) {
        const originalPath = path.join(videosBaseDir, dupDir) + ".mp4";
        const targetPath = path.join(duplicatesDir, dupDir) + ".mp4";
        if (fs.existsSync(originalPath)) {
          fs.renameSync(originalPath, targetPath);
          console.log(`Moved ${dupDir} to duplicates.`);
        }
        // Mark this video as processed to avoid moving it again
        processedVideos.add(dupDir);
      }
    });
  });
}

/**
 * Generates a file list for concatenation from remaining MP4 files in the input directory.
 * @param {String} inputDir - The input directory containing MP4 files.
 * @returns {String} - The path to the generated file list.
 */

async function generateFileListForConcat(inputDir) {
  // Filter MP4 files that haven't been moved to duplicates
  const videoFiles = fs
    .readdirSync(inputDir)
    .filter(
      (file) =>
        path.extname(file) === ".mp4" &&
        !fs.existsSync(path.join(inputDir, "duplicates", file)),
    );
  const fileListPath = path.join(inputDir, "filelist.txt");
  // Create content for the file list in ffmpeg's required format
  const fileContent = videoFiles.map((file) => `file '${file}'`).join("\n");
  fs.writeFileSync(fileListPath, fileContent);
  return fileListPath;
}

/**
 * Concatenates video files using ffmpeg based on a list of file paths.
 * @param {String} fileListPath - The path to the text file containing video file paths.
 * @param {String} outputFilePath - The path for the output concatenated video file.
 */
function concatVideos(fileListPath, outputFilePath) {
  // ffmpeg command to concatenate videos listed in the file list
  const command = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputFilePath}"`;
  try {
    execSync(command);
    console.log("Videos have been concatenated successfully.");
  } catch (error) {
    console.error("An error occurred during video concatenation:", error);
  }
}

/**
 * Processes leftover videos after moving duplicates by concatenating them into a single file.
 */

async function processLeftoverVideos() {
  const fileListPath = await generateFileListForConcat(videosBaseDir);
  const outputFilePath = path.join(videosBaseDir, "concatenated_video.mp4");
  concatVideos(fileListPath, outputFilePath);
}

module.exports = { findDuplicates, moveDuplicates, processLeftoverVideos };
