// FILEPATH: /Users/osistlk/edits/phash.test.js
const { findDuplicates } = require("../src");
const fs = require("fs");

jest.mock("fs");

describe("findDuplicates", () => {
  // Test with no videos
  it("should return an empty object for a directory with no videos", async () => {
    fs.readdirSync.mockReturnValue([]);
    const duplicates = await findDuplicates("input/keyframes");
    expect(duplicates).toEqual({});
  });

  // Test with one video
  it("should return an object with one key and an empty array for a directory with one video", async () => {
    fs.readdirSync.mockReturnValue(["video1"]);
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    const duplicates = await findDuplicates("input/keyframes");
    expect(duplicates).toEqual({ video1: [] });
  });

  // Test with two identical videos
  it("should return an object with each video as a key and the other video as a duplicate", async () => {
    fs.readdirSync.mockReturnValue(["video1", "video2"]);
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    const duplicates = await findDuplicates("input/keyframes");
    expect(duplicates).toEqual({ video1: [], video2: [] });
  });

  // Test with two different videos
  it("should return an object with each video as a key and no duplicates", async () => {
    fs.readdirSync.mockReturnValue(["video1", "video2"]);
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    const duplicates = await findDuplicates("input/keyframes");
    expect(duplicates).toEqual({ video1: [], video2: [] });
  });
});
