// FILEPATH: /Users/osistlk/edits/ihash.test.js
const { generatePerceptualHash } = require("../src/phash");
const path = require("path");

describe("generatePerceptualHash", () => {
  // Test with a known image and expected hash
  it("should generate correct perceptual hash for a known image", async () => {
    const imagePath = path.join(__dirname, "input_image.jpg");
    const expectedHash =
      "1001010101011010011010100100111011100101001110011001010001001001"; // replace with the expected hash
    const hash = await generatePerceptualHash(imagePath);
    expect(hash).toEqual(expectedHash);
  });

  // Test with a non-existing image
  it("should throw an error for a non-existing image", async () => {
    const imagePath = path.join(
      __dirname,
      "test_images",
      "non_existing_image.jpg",
    );
    await expect(generatePerceptualHash(imagePath)).rejects.toThrow();
  });

  // Test with a non-image file
  it("should throw an error for a non-image file", async () => {
    const imagePath = path.join(__dirname, "index.html");
    await expect(generatePerceptualHash(imagePath)).rejects.toThrow();
  });

  // Test with a large image
  it("should generate a perceptual hash for a large image", async () => {
    const imagePath = path.join(__dirname, "output_image.jpg");
    const hash = await generatePerceptualHash(imagePath);
    expect(hash).toHaveLength(64);
  });
});
