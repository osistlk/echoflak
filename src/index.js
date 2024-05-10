const {
  existsSync,
  readFileSync,
  rmSync,
  readdirSync,
  mkdirSync,
  statSync,
  renameSync,
  writeFileSync,
} = require("fs");
const { exit } = require("process");
const { join, basename, extname } = require("path");
const util = require("util");
const { execSync } = require("child_process");
const exec = util.promisify(require("child_process").exec);
const { generatePerceptualHash } = require("./lib/phash");
const { compareHashSets } = require("./lib/util");

const cleanBefore = () => {
  console.log("Cleaning up...");
  const inputDir = config.inputDir;
  const keyframesDir = `${inputDir}/keyframes`;
  if (existsSync(keyframesDir))
    rmSync(keyframesDir, { recursive: true, force: true });
  console.log("Cleanup complete.");
};

console.clear();
console.log("Welcome to EchoFlak NVIDIA Highlights deduplication tool.");

const configFilePath = "config.json";
console.log("Reading config file from path: ");
console.log(configFilePath);

if (!existsSync(configFilePath)) {
  console.log("No config file present.");
  exit();
}

const config = JSON.parse(readFileSync(configFilePath));
console.log("Config file loaded.");

if (config.printConfig) console.log(config);

if (config.cleanBefore) cleanBefore();

if (!config.inputDir || !existsSync(config.inputDir)) {
  console.error("No valid input directory.");
  exit();
}

if (!config.outputDir || !existsSync(config.outputDir)) {
  console.error("No valid output directory.");
  exit();
}

// Begin the process by logging to the console and starting a timer to track execution time.
console.log("\x1b[32m%s\x1b[0m", "Starting the duplicate detection process...");
console.time("Execution time");

const inputDir = config.inputDir;

const files = readdirSync(inputDir);
const videoFiles = files.filter((file) => file.endsWith(".mp4"));
if (videoFiles.length === 0) throw new Error("No input files");

console.log(`\x1b[36mProcessing ${videoFiles.length} videos...\x1b[0m`);

const tasks = videoFiles.map((videoFile) => async () => {
  const videoPath = join(inputDir, videoFile);
  const keyframeOutputDir = join(
    inputDir,
    "keyframes",
    basename(videoFile, ".mp4"),
  );

  mkdirSync(keyframeOutputDir, { recursive: true });
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
  if (!existsSync(inputDir)) mkdirSync(inputDir);

  // Get all video directories within the specified directory
  let videoDirs = readdirSync(keyframesDir).filter((file) =>
    statSync(join(keyframesDir, file)).isDirectory(),
  );
  const videoHashes = {};
  const duplicatesMap = {};

  // Progress display initialization
  let processed = 0;
  const total = videoDirs.length;
  console.log("");
  console.log("\x1b[36m%s\x1b[0m", `Processing ${total} directories...`);

  for (const videoDir of videoDirs) {
    // Process each video directory to extract keyframes and generate hashes
    const keyframeDir = join(keyframesDir, videoDir);
    const keyframeFiles = readdirSync(keyframeDir).filter(
      (file) => extname(file) === ".jpg",
    );
    videoHashes[videoDir] = [];

    for (const file of keyframeFiles) {
      // Generate and store perceptual hash for each keyframe
      const hash = await generatePerceptualHash(join(keyframeDir, file));
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
  writeFileSync("duplicates.json", JSON.stringify(duplicatesMap, null, 2));

  // Read duplicate data from JSON file
  const duplicatesData = JSON.parse(readFileSync("duplicates.json", "utf8"));
  const duplicatesDir = join(inputDir, "duplicates");

  // Create the duplicates directory if it doesn't exist
  if (!existsSync(duplicatesDir)) {
    mkdirSync(duplicatesDir, { recursive: true });
  }

  // A set to keep track of videos that have been moved, ensuring no original is moved
  const movedVideos = new Set();
  videoDirs = Object.keys(duplicatesData);

  videoDirs.forEach((videoDir) => {
    const duplicateDirs = duplicatesData[videoDir];

    duplicateDirs.forEach((dupDir) => {
      const originalPath = join(inputDir, dupDir) + ".mp4";
      const targetPath = join(duplicatesDir, dupDir) + ".mp4";
      if (existsSync(originalPath)) {
        renameSync(originalPath, targetPath);
        console.log(`Moved ${dupDir} to duplicates.`);
        // Mark this video as moved to avoid considering it as original in future
        movedVideos.add(dupDir);
      }
    });
  });

  console.log();
  console.log("Duplicates moved.");

  // Filter MP4 files that haven't been moved to duplicates
  const videoFiles = readdirSync(inputDir).filter(
    (file) =>
      extname(file) === ".mp4" &&
      !existsSync(join(inputDir, "duplicates", file)),
  );
  const fileListPath = join(inputDir, "filelist.txt");
  // Create content for the file list in ffmpeg's required format
  const fileContent = videoFiles.map((file) => `file '${file}'`).join("\n");
  writeFileSync(fileListPath, fileContent);

  const outputFilePath = join(config.outputDir, `${config.outputFilename}.mp4`);

  // ffmpeg command to concatenate videos listed in the file list
  const command = `ffmpeg -y -f concat -safe 0 -i "${fileListPath}" -c copy "${outputFilePath}"`;
  execSync(command);
  console.log("Videos have been concatenated successfully.");

  console.log();
  console.timeEnd("Execution time");

  try {
    if (config.clean.logs) rmSync(`${inputDir}\\filelist.txt`);
    if (config.clean.keyframes)
      rmSync(`${keyframesDir}`, { recursive: true, force: true });
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
