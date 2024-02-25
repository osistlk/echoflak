// FILEPATH: /c:/Users/osistlk/Documents/Code/echoflak/test/keyframes.test.js
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const { extractKeyframesForDirectory } = require("../src/lib/keyframes");
const { beforeEach } = require("node:test");
jest.mock("fs");
jest.mock("path");
jest.mock("child_process", () => ({
  exec: jest.fn(),
}));
jest.mock("util", () => ({
  promisify: (fn) => fn,
}));

describe("extractKeyframesForDirectory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call fs.readdirSync with correct directory", async () => {
    fs.readdirSync.mockReturnValue(["apple.txt"]);
    await extractKeyframesForDirectory("test/dir");
    expect(fs.readdirSync).toHaveBeenCalledWith("test/dir");
  });

  it("should filter out non-mp4 files", async () => {
    fs.readdirSync.mockReturnValue(["video1.mp4", "video2.avi", "video3.mp4"]);
    await extractKeyframesForDirectory("test/dir");
    expect(fs.readdirSync).toHaveBeenCalledWith("test/dir");
  });

  it("should call fs.existsSync with correct directory", async () => {
    fs.readdirSync.mockReturnValue(["video1.mp4"]);
    path.join
      .mockReturnValueOnce("test/dir/video1.mp4")
      .mockReturnValueOnce("test/dir/keyframes/video1");
    fs.existsSync.mockReturnValue(false);
    await extractKeyframesForDirectory("test/dir");
    expect(fs.existsSync).toHaveBeenCalledWith("test/dir/keyframes/video1");
  });

  it("should call fs.mkdirSync with correct directory and options if directory does not exist", async () => {
    fs.readdirSync.mockReturnValue(["video1.mp4"]);
    path.join
      .mockReturnValueOnce("test/dir/video1.mp4")
      .mockReturnValueOnce("test/dir/keyframes/video1");
    fs.existsSync.mockReturnValue(false);
    await extractKeyframesForDirectory("test/dir");
    expect(fs.mkdir).toHaveBeenCalledWith("test/dir/keyframes/video1", {
      recursive: true,
    });
  });
});
