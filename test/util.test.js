// FILEPATH: /c:/Users/osistlk/Documents/Code/echoflak/test/util.test.js
const fs = require("fs");
const path = require("path");
jest.mock("fs");
jest.mock("path");

const { moveDuplicates } = require("../src/lib/util");

describe("moveDuplicates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should create duplicates directory if it does not exist", async () => {
    path.join.mockReturnValue("mocked/duplicates/dir");
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        video1: ["dup1", "dup2"],
        video2: ["dup3", "dup4"],
      }),
    );
    await moveDuplicates();
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
      recursive: true,
    });
  });

  it("should not create duplicates directory if it exists", async () => {
    fs.existsSync.mockReturnValue(true);
    await moveDuplicates();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it("should move duplicate videos to duplicates directory", async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        video1: ["dup1", "dup2"],
        video2: ["dup3", "dup4"],
      }),
    );
    await moveDuplicates();
    expect(fs.renameSync).toHaveBeenCalledTimes(4);
    expect(fs.renameSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
    );
  });

  it("should not move the first duplicate video in alphabetical order", async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        video1: ["dup1", "dup2"],
        video2: ["dup3", "dup4"],
      }),
    );
    await moveDuplicates();
    expect(fs.renameSync).not.toHaveBeenCalledWith(
      expect.stringContaining("dup1"),
      expect.any(String),
    );
    expect(fs.renameSync).not.toHaveBeenCalledWith(
      expect.stringContaining("dup3"),
      expect.any(String),
    );
  });
});
