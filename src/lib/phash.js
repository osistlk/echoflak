const sharp = require("sharp");
const ndarray = require("ndarray");

// Asynchronously function to generate a perceptual hash for a given image file.
async function generatePerceptualHash(imagePath) {
  // Use sharp to process the image: resize it to 32x32 pixels, convert it to grayscale, and get the raw pixel data.
  const data = await sharp(imagePath)
    .resize(32, 32) // Resize image to 32x32 pixels to standardize the input.
    .grayscale() // Convert the image to grayscale to focus on structure rather than color.
    .raw() // Get the raw, uncompressed pixel data.
    .toBuffer(); // Convert the processed image to a Buffer for further processing.

  // Convert the image data into a 32x32 floating point ndarray for numerical operations.
  let imgArray = ndarray(new Float32Array(data), [32, 32]);

  // Define a simplified Discrete Cosine Transform (DCT) function.
  function dct(u, v, arr) {
    const N = 32; // The size of the image (32x32).
    let sum = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        // Calculate the cosine values for the transform based on the current pixel position.
        const cos1 = Math.cos(((2 * i + 1) * u * Math.PI) / (2 * N));
        const cos2 = Math.cos(((2 * j + 1) * v * Math.PI) / (2 * N));
        // Accumulate the sum of pixel values multiplied by the cosine values.
        sum += cos1 * cos2 * arr.get(i, j);
      }
    }
    // Apply scaling factors for the u and v components.
    const scale = [
      u == 0 ? 1 / Math.sqrt(2) : 1,
      v == 0 ? 1 / Math.sqrt(2) : 1,
    ];
    return sum * ((2 / N) * scale[0] * scale[1]);
  }

  // Apply the DCT to the top-left 8x8 portion of the image to reduce dimensionality and focus on low-frequency components.
  let dctArray = new Float32Array(64);
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      dctArray[u * 8 + v] = dct(u, v, imgArray);
    }
  }

  // Compute the median value of the DCT coefficients to threshold the hash.
  const medianValue = Array.from(dctArray).sort((a, b) => a - b)[
    Math.floor(dctArray.length / 2)
  ];
  // Generate the binary hash by comparing each DCT coefficient against the median value.
  const hashBinary = Array.from(dctArray)
    .map((value) => (value > medianValue ? "1" : "0"))
    .join("");

  // Return the binary hash as a string.
  return hashBinary;
}

module.exports = { generatePerceptualHash };

// Example usage
// const imagePath = 'input\\keyframes\\War Thunder 2024.02.21 - 14.29.27.11.DVR\\keyframe_001.jpg'; // Replace with the path to your image

// generatePerceptualHash(imagePath)
//     .then(hash => console.log(`Perceptual Hash: ${hash}`))
//     .catch(err => console.error(err));
