const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const execAsync = util.promisify(exec);

async function extractKeyframes(videoPath, outputDir) {
  const command = `ffmpeg -i "${videoPath}" -vf "select='eq(pict_type,PICT_TYPE_I)'" -vsync vfr "${outputDir}/keyframe_%03d.jpg"`;
  try {
    await execAsync(command);
  } catch (error) {
    console.error(`Failed to extract keyframes from ${videoPath}: ${error}`);
  }
}

async function extractKeyframesForDirectory(directory) {
  try {
    const files = await fs.readdir(directory);
    const videoFiles = files.filter((file) => file.endsWith(".mp4"));

    console.log(`\x1b[36mProcessing ${videoFiles.length} videos...\x1b[0m`);

    const tasks = videoFiles.map((videoFile) => async () => {
      const videoPath = path.join(directory, videoFile);
      const outputDir = path.join(
        directory,
        "keyframes",
        path.basename(videoFile, ".mp4"),
      );

      try {
        await fs.mkdir(outputDir, { recursive: true });
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
    console.error(`An error occurred reading input files: ${error}`);
  }
}

module.exports = { extractKeyframesForDirectory };
