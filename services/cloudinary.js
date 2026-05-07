// services/cloudinary.js
// -------------------------------------------------------
// Cloudinary se images upload karo — permanent cloud storage
// Local files ki jagah ab Cloudinary use hoga
// -------------------------------------------------------

const cloudinary = require("cloudinary").v2;
const { Readable } = require("stream");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// -------------------------------------------------------
// Buffer se Cloudinary pe upload karo
// -------------------------------------------------------
const uploadToCloudinary = (buffer, folder = "agr-hotel") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        quality: "auto",       // Auto optimize
        fetch_format: "auto",  // WebP serve karo modern browsers pe
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

// -------------------------------------------------------
// URL se delete karo
// -------------------------------------------------------
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch(e) {
    console.error("Cloudinary delete error:", e.message);
  }
};

// Public ID extract karo URL se
const getPublicId = (url) => {
  try {
    const parts = url.split("/");
    const filename = parts[parts.length - 1].split(".")[0];
    const folder   = parts[parts.length - 2];
    return `${folder}/${filename}`;
  } catch(e) {
    return null;
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary, getPublicId };