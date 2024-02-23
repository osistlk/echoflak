const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

// Convert exec from callback-based to Promise-based for use with async/await.
const execAsync = util.promisify(exec);

// Defines an asynchronous function to extract keyframes from a single video file.
async function extractKeyframes(videoPath, outputDir) {
  // Construct the command to run ffmpeg, selecting only I-frames (keyframes) from the video
  // and outputting them as JPEG images in the specified output directory.
  const command = `ffmpeg -i "${videoPath}" -vf "select='eq(pict_type,PICT_TYPE_I)'" -vsync vfr "${outputDir}/keyframe_%03d.jpg"`;
  // Execute the ffmpeg command asynchronously.
  await execAsync(command);
}

// Defines an asynchronous function to extract keyframes from all video files in a directory.
async function extractKeyframesForDirectory(directory) {
  let videoFiles = [];
  try {
    // Read all files in the given directory and filter out those with a .mp4 extension.
    videoFiles = fs
      .readdirSync(directory)
      .filter((file) => file.endsWith(".mp4"));
  } catch (error) {
    // Log an error if reading the directory fails.
    console.error("An error occurred reading input files :", error);
  }

  // Display the total number of videos to process for user feedback.
  let processed = 0;
  const total = videoFiles.length;
  console.log("\x1b[36m%s\x1b[0m", `Processing ${total} videos...`);

  // Iterate over each video file in the directory.
  for (const videoFile of videoFiles) {
    // Construct the full path to the video file.
    const videoPath = path.join(directory, videoFile);
    // Construct the output directory path for the extracted keyframes, creating a unique folder for each video.
    const outputDir = path.join(
      directory,
      "keyframes",
      path.basename(videoFile, ".mp4"),
    );

    // Check if the output directory exists, if not, create it.
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      // Extract keyframes for the current video file.
      await extractKeyframes(videoPath, outputDir);
    }

    // Update and display the progress of keyframe extraction to the user.
    process.stdout.write(
      `\r\x1b[35mProgress: ${++processed}/${total} video keyframes extracted.\x1b[0m`,
    );
  }
}

module.exports = { extractKeyframesForDirectory };
