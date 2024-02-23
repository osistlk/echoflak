// Required Node.js modules
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Custom modules for processing videos
const { extractKeyframesForDirectory } = require("./keyframes");
const { generatePerceptualHash } = require("./phash");

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

// File paths for storing and reading duplicate data, and base directory for videos
const duplicatesFilePath = "duplicates.json";
const videosBaseDir = "input";

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

    // Move each duplicate video to the duplicates directory
    for (const [videoDir, duplicateDirs] of Object.entries(duplicatesData)) {
        duplicateDirs.forEach((dupDir) => {
            const originalPath = path.join(videosBaseDir, dupDir) + ".mp4";
            const targetPath = path.join(duplicatesDir, dupDir) + ".mp4";
            if (fs.existsSync(originalPath)) {
                fs.renameSync(originalPath, targetPath);
                console.log(`Moved ${dupDir} to duplicates.`);
            }
        });
    }
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
    const fileListPath = await generateFileListForConcat(inputDir);
    const outputFilePath = path.join(inputDir, "concatenated_video.mp4");
    concatVideos(fileListPath, outputFilePath);
}

// Exporting the findDuplicates function to make it available for other modules
module.exports = { findDuplicates };

// Script execution begins here, starting with extracting keyframes and detecting duplicates
console.log("\x1b[32m%s\x1b[0m", "Starting the duplicate detection process...");
console.time("Execution time");
const startUsage = process.memoryUsage();

const inputDir = "input";
const keyframesDir = `${inputDir}/keyframes`;

// Main process flow: Extract keyframes, find duplicates, move duplicates, and process leftover videos
extractKeyframesForDirectory(inputDir).then(() => {
    findDuplicates(keyframesDir)
        .then((duplicatesMap) => {
            fs.writeFileSync(
                "duplicates.json",
                JSON.stringify(duplicatesMap, null, 2),
            );
            console.log(
                "\n\x1b[32m%s\x1b[0m",
                "Duplicate detection complete. Results saved to duplicates.json",
            );
            moveDuplicates()
                .then(() => {
                    console.log(
                        "\n\x1b[32m%s\x1b[0m",
                        "Duplicates moved to the duplicates directory.",
                    );
                    processLeftoverVideos()
                        .then(() => {
                            console.log(
                                "\n\x1b[32m%s\x1b[0m",
                                "Leftover videos have been concatenated.",
                            );
                        })
                        .catch(console.error);
                })
                .catch(console.error);
        })
        .catch((err) => {
            console.error("\x1b[31m", "\nAn error occurred:", err, "\x1b[0m");
        })
        .finally(() => {
            const endUsage = process.memoryUsage();
            const usedMemory =
                (endUsage.heapUsed - startUsage.heapUsed) / 1024 / 1024;
            console.log(
                "\n\x1b[33m%s\x1b[0m",
                `Memory used: ${usedMemory.toFixed(2)} MB`,
            );
            console.timeEnd("Execution time");
            console.log(
                "\x1b[33m%s\x1b[0m",
                "Thank you for using the duplicate detection script!",
            );
        });
});
