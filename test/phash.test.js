// FILEPATH: /c:/Users/osistlk/Documents/Code/echoflak/test/phash.test.js
const sharp = require("sharp");
const { generatePerceptualHash } = require("../src/lib/phash");
jest.mock("sharp");

describe("generatePerceptualHash", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call sharp with correct image path", async () => {
    const imagePath = "test.jpg";
    sharp.mockReturnValue({
      resize: jest.fn().mockReturnThis(),
      grayscale: jest.fn().mockReturnThis(),
      raw: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(new Buffer(32 * 32)),
    });
    await generatePerceptualHash(imagePath);
    expect(sharp).toHaveBeenCalledWith(imagePath);
  });

  it("should call sharp methods in correct order", async () => {
    const resizeMock = jest.fn().mockReturnThis();
    const grayscaleMock = jest.fn().mockReturnThis();
    const rawMock = jest.fn().mockReturnThis();
    const toBufferMock = jest.fn().mockResolvedValue(new Buffer(32 * 32));
    sharp.mockReturnValue({
      resize: resizeMock,
      grayscale: grayscaleMock,
      raw: rawMock,
      toBuffer: toBufferMock,
    });
    await generatePerceptualHash("test.jpg");
    expect(resizeMock.mock.invocationCallOrder[0]).toBeLessThan(
      grayscaleMock.mock.invocationCallOrder[0],
    );
    expect(grayscaleMock.mock.invocationCallOrder[0]).toBeLessThan(
      rawMock.mock.invocationCallOrder[0],
    );
    expect(rawMock.mock.invocationCallOrder[0]).toBeLessThan(
      toBufferMock.mock.invocationCallOrder[0],
    );
  });

  it("should return a binary string", async () => {
    sharp.mockReturnValue({
      resize: jest.fn().mockReturnThis(),
      grayscale: jest.fn().mockReturnThis(),
      raw: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(new Buffer(32 * 32)),
    });
    const hash = await generatePerceptualHash("test.jpg");
    expect(hash).toMatch(/^[01]+$/);
  });
});
