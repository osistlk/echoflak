const fs = require("fs");
const process = require("process");
const path = require("path");
const util = require("util");
const child_process = require("child_process");
const exec = util.promisify(child_process.exec);
const { generatePerceptualHash } = require("./lib/phash");
const { compareHashSets } = require("./lib/util");

const cleanBefore = () => {
  console.log("Cleaning up...");
  const inputDir = config.inputDir;
  const keyframesDir = `${inputDir}/keyframes`;
  if (fs.existsSync(keyframesDir))
    fs.rmSync(keyframesDir, { recursive: true, force: true });
  console.log("Cleanup complete.");
};

console.clear();
console.log("Welcome to EchoFlak NVIDIA Highlights deduplication tool.");

const configFilePath = "config.json";
console.log("Reading config file from path: ");
console.log(configFilePath);

if (!fs.existsSync(configFilePath)) {
  console.log("No config file present.");
  process.exit();
}

const config = JSON.parse(fs.readFileSync(configFilePath));
console.log("Config file loaded.");

if (config.printConfig) console.log(config);

if (config.cleanBefore) cleanBefore();

if (!config.inputDir || !fs.existsSync(config.inputDir)) {
  console.error("No valid input directory.");
  process.exit();
}

if (!config.outputDir || !fs.existsSync(config.outputDir)) {
  console.error("No valid output directory.");
  process.exit();
}

// Begin the process by logging to the console and starting a timer to track execution time.
console.log("\x1b[32m%s\x1b[0m", "Starting the duplicate detection process...");
console.time("Execution time");

const inputDir = config.inputDir;

const files = fs.readdirSync(inputDir);
const videoFiles = files.filter((file) => file.endsWith(".mp4"));
if (videoFiles.length === 0) throw new Error("No input files");

console.log(`\x1b[36mProcessing ${videoFiles.length} videos...\x1b[0m`);

const tasks = videoFiles.map((videoFile) => async () => {
  const videoPath = path.join(inputDir, videoFile);
  const keyframeOutputDir = path.join(
    inputDir,
    "keyframes",
    path.basename(videoFile, ".mp4"),
  );

  fs.mkdirSync(keyframeOutputDir, { recursive: true });
  const command = `ffmpeg -i "${videoPath}" -vf "select='eq(pict_type,PICT_TYPE_I)'" -vsync vfr "${keyframeOutputDir}/keyframe_%03d.jpg"`;
  await exec(command);
  console.log(`\x1b[32mExtracted keyframes from ${videoFile}\x1b[0m`);
});

async function runBatch() {
  const maxParallel = 100;
  for (let i = 0; i < tasks.length; i += maxParallel) {
    const batch = tasks.slice(i, i + maxParallel).map((task) => task());
    await Promise.all(batch);
  }
}

async function main() {
  await runBatch();

  const keyframesDir = `${inputDir}\\keyframes`;
  // Check if the keyframe dir exists
  if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir);

  // Get all video directories within the specified directory
  let videoDirs = fs
    .readdirSync(keyframesDir)
    .filter((file) => fs.statSync(path.join(keyframesDir, file)).isDirectory());
  const videoHashes = {};
  const duplicatesMap = {};

  // Progress display initialization
  let processed = 0;
  const total = videoDirs.length;
  console.log("");
  console.log("\x1b[36m%s\x1b[0m", `Processing ${total} directories...`);

  for (const videoDir of videoDirs) {
    // Process each video directory to extract keyframes and generate hashes
    const keyframeDir = path.join(keyframesDir, videoDir);
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
    // eslint-disable-next-line no-undef
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
  fs.writeFileSync("duplicates.json", JSON.stringify(duplicatesMap, null, 2));

  // Read duplicate data from JSON file
  const duplicatesData = JSON.parse(fs.readFileSync("duplicates.json", "utf8"));
  const duplicatesDir = path.join(inputDir, "duplicates");

  // Create the duplicates directory if it doesn't exist
  if (!fs.existsSync(duplicatesDir)) {
    fs.mkdirSync(duplicatesDir, { recursive: true });
  }

  // A set to keep track of videos that have been moved, ensuring no original is moved
  const movedVideos = new Set();
  videoDirs = Object.keys(duplicatesData);

  videoDirs.forEach((videoDir) => {
    const duplicateDirs = duplicatesData[videoDir];

    duplicateDirs.forEach((dupDir) => {
      const originalPath = path.join(inputDir, dupDir) + ".mp4";
      const targetPath = path.join(duplicatesDir, dupDir) + ".mp4";
      if (fs.existsSync(originalPath)) {
        fs.renameSync(originalPath, targetPath);
        console.log(`Moved ${dupDir} to duplicates.`);
        // Mark this video as moved to avoid considering it as original in future
        movedVideos.add(dupDir);
      }
    });
  });

  console.log();
  console.log("Duplicates moved.");

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

  const outputFilePath = path.join(
    config.outputDir,
    `${config.outputFilename}.mp4`,
  );

  // ffmpeg command to concatenate videos listed in the file list
  const command = `ffmpeg -y -f concat -safe 0 -i "${fileListPath}" -c copy "${outputFilePath}"`;
  child_process.execSync(command);
  console.log("Videos have been concatenated successfully.");

  console.log();
  console.timeEnd("Execution time");

  try {
    if (config.clean.logs) fs.rmSync(`${inputDir}\\filelist.txt`);
    if (config.clean.keyframes)
      fs.rmSync(`${keyframesDir}`, { recursive: true, force: true });
  } catch {
    console.log("Error during cleanup.");
  }

  console.log(
    "\x1b[33m%s\x1b[0m",
    "Thank you for using the duplicate detection script!",
  );
  console.log("Goodbye.");
}

main();
