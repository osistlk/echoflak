const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const { exit } = require("process");

const execAsync = util.promisify(exec);

async function extractKeyframes(videoPath, outputDir) {
  const command = `ffmpeg -y -hwaccel cuda -i "${videoPath}" -vf "select='eq(pict_type,PICT_TYPE_I)'" -vsync vfr "${outputDir}/keyframe_%03d.jpg"`;
  try {
    await execAsync(command);
  } catch (error) {
    console.error(`Failed to extract keyframes from ${videoPath}: ${error}`);
  }
}

async function extractKeyframesForDirectory(directory) {
  try {
    const files = fs.readdirSync(directory);
    const videoFiles = files.filter((file) => file.endsWith(".mp4"));
    if (videoFiles.length === 0) throw new Error("No input files");

    console.log(`\x1b[36mProcessing ${videoFiles.length} videos...\x1b[0m`);

    const tasks = videoFiles.map((videoFile) => async () => {
      const videoPath = path.join(directory, videoFile);
      const outputDir = path.join(
        directory,
        "keyframes",
        path.basename(videoFile, ".mp4"),
      );

      try {
        fs.mkdirSync(outputDir, { recursive: true });
        await extractKeyframes(videoPath, outputDir);
        console.log(`\x1b[32mExtracted keyframes from ${videoFile}\x1b[0m`);
      } catch (error) {
        console.error(`Error processing ${videoFile}: ${error}`);
      }
    });

    const maxParallel = 100;
    for (let i = 0; i < tasks.length; i += maxParallel) {
      const batch = tasks.slice(i, i + maxParallel).map((task) => task());
      await Promise.all(batch);
    }
  } catch (error) {
    console.error(`An error occurred reading input files: ${error.message}`);
    exit();
  }
}

module.exports = { extractKeyframesForDirectory };
