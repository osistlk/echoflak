const fs = require("fs");

// Import custom modules that provide functionality for processing videos.
// 'extractKeyframesForDirectory' extracts keyframes from all videos in a directory.
// 'findDuplicates' identifies duplicate videos based on the extracted keyframes.
// 'moveDuplicates' moves identified duplicates to a separate directory.
// 'processLeftoverVideos' concatenates non-duplicate videos into a single video file.
const { extractKeyframesForDirectory } = require("./keyframes");
const {
  findDuplicates,
  moveDuplicates,
  processLeftoverVideos,
} = require("./util");

// Begin the process by logging to the console and starting a timer to track execution time.
console.log("\x1b[32m%s\x1b[0m", "Starting the duplicate detection process...");
console.time("Execution time");
const startUsage = process.memoryUsage();

// Define the directory paths for input videos and where to store the extracted keyframes.
const inputDir = "input";
const keyframesDir = `${inputDir}/keyframes`;

// The main process flow is initiated here.
// First, extract keyframes from all videos in the specified input directory.
extractKeyframesForDirectory(inputDir).then(() => {
  // After extracting keyframes, find duplicates among them.
  findDuplicates(keyframesDir)
    .then((duplicatesMap) => {
      // Write the results of the duplicate detection to a JSON file.
      fs.writeFileSync(
        "duplicates.json",
        JSON.stringify(duplicatesMap, null, 2),
      );
      console.log(
        "\n\x1b[32m%s\x1b[0m",
        "Duplicate detection complete. Results saved to duplicates.json",
      );
      // Move the identified duplicates to a designated directory.
      moveDuplicates()
        .then(() => {
          console.log(
            "\n\x1b[32m%s\x1b[0m",
            "Duplicates moved to the duplicates directory.",
          );
          // Process the remaining videos by concatenating them into a single file.
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
      // Once all processes are complete, or if an error occurs, log the memory usage and total execution time.
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
