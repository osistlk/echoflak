const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);

async function extractKeyframes(videoPath, outputDir) {
    const command = `ffmpeg -i "${videoPath}" -vf "select='eq(pict_type,PICT_TYPE_I)'" -vsync vfr "${outputDir}/keyframe_%03d.jpg"`;
    await execAsync(command);
}

async function extractKeyframesForDirectory(directory) {
    let videoFiles = [];
    try {
        videoFiles = fs
            .readdirSync(directory)
            .filter((file) => file.endsWith(".mp4"));
    } catch (error) {
        console.error("An error occurred reading input files :", error);
    }
    // Start progress display
    let processed = 0;
    const total = videoFiles.length;
    console.log("\x1b[36m%s\x1b[0m", `Processing ${total} videos...`);
    for (const videoFile of videoFiles) {
        const videoPath = path.join(directory, videoFile);
        const outputDir = path.join(
            directory,
            "keyframes",
            path.basename(videoFile, ".mp4"),
        );
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            await extractKeyframes(videoPath, outputDir);
        }

        process.stdout.write(
            `\r\x1b[35mProgress: ${++processed}/${total} video keyframes extracted.\x1b[0m`,
        );
    }
}

module.exports = { extractKeyframesForDirectory };
