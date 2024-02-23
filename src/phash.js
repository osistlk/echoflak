const sharp = require("sharp");
const ndarray = require("ndarray");

// Function to generate perceptual hash for a single image
async function generatePerceptualHash(imagePath) {
  const data = await sharp(imagePath)
    .resize(32, 32)
    .grayscale()
    .raw()
    .toBuffer();

  let imgArray = ndarray(new Float32Array(data), [32, 32]);

  // Simplified DCT implementation
  function dct(u, v, arr) {
    const N = 32;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const cos1 = Math.cos(((2 * i + 1) * u * Math.PI) / (2 * N));
        const cos2 = Math.cos(((2 * j + 1) * v * Math.PI) / (2 * N));
        sum += cos1 * cos2 * arr.get(i, j);
      }
    }
    const scale = [
      u == 0 ? 1 / Math.sqrt(2) : 1,
      v == 0 ? 1 / Math.sqrt(2) : 1,
    ];
    return sum * ((2 / N) * scale[0] * scale[1]);
  }

  // Apply DCT to the top-left 8x8 part of the image
  let dctArray = new Float32Array(64);
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      dctArray[u * 8 + v] = dct(u, v, imgArray);
    }
  }

  const medianValue = Array.from(dctArray).sort((a, b) => a - b)[
    Math.floor(dctArray.length / 2)
  ];
  const hashBinary = Array.from(dctArray)
    .map((value) => (value > medianValue ? "1" : "0"))
    .join("");

  return hashBinary;
}

module.exports = { generatePerceptualHash };

// Example usage
// const imagePath = 'input\\keyframes\\War Thunder 2024.02.21 - 14.29.27.11.DVR\\keyframe_001.jpg'; // Replace with the path to your image

// generatePerceptualHash(imagePath)
//     .then(hash => console.log(`Perceptual Hash: ${hash}`))
//     .catch(err => console.error(err));
