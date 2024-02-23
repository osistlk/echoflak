// Required Node.js modules
const fs = require("fs");

// Custom modules for processing videos
const { extractKeyframesForDirectory } = require("./keyframes");
const {
  findDuplicates,
  moveDuplicates,
  processLeftoverVideos,
} = require("./util");

// Script execution begins here, starting with extracting keyframes and detecting duplicates
console.log("\x1b[32m%s\x1b[0m", "Starting the duplicate detection process...");
console.time("Execution time");
const startUsage = process.memoryUsage();

const inputDir = "C:\\Users\\osistlk\\Videos\\edits\\input";
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
