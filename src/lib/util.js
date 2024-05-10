const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Import a custom module to generate a perceptual hash of video frames.
const { generatePerceptualHash } = require("./phash");

// Define base directory paths for video files and the path for storing data on duplicates.
const videosBaseDir = "input";
const duplicatesFilePath = "duplicates.json";

/**
 * This function compares two sets of perceptual hashes to identify duplicates.
 * It calculates the difference between each pair of hashes and determines if they
 * are similar enough to be considered duplicates based on the provided threshold and match percentage.
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

async function findDuplicates(directory) {
  // Check if the keyframe dir exists
  await fs.mkdirSync(directory);

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
          // remove the duplicate from the videoDirs array to avoid redundant comparisons
          videoDirs.splice(i, 1);
          i--;
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

  // A set to keep track of videos that have been moved, ensuring no original is moved
  const movedVideos = new Set();
  const videoDirs = Object.keys(duplicatesData);

  videoDirs.forEach((videoDir) => {
    const duplicateDirs = duplicatesData[videoDir];

    duplicateDirs.forEach((dupDir) => {
      const originalPath = path.join(videosBaseDir, dupDir) + ".mp4";
      const targetPath = path.join(duplicatesDir, dupDir) + ".mp4";
      if (fs.existsSync(originalPath)) {
        fs.renameSync(originalPath, targetPath);
        console.log(`Moved ${dupDir} to duplicates.`);
        // Mark this video as moved to avoid considering it as original in future
        movedVideos.add(dupDir);
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
 * Processes leftover videos after moving duplicates.
 * It generates a list of videos to be concatenated and then merges them using ffmpeg.
 */

async function processLeftoverVideos() {
  const fileListPath = await generateFileListForConcat(videosBaseDir);
  const outputFilePath = path.join(videosBaseDir, "concatenated_video.mp4");
  concatVideos(fileListPath, outputFilePath);
}

module.exports = { findDuplicates, moveDuplicates, processLeftoverVideos };
