/**
 * Cloudinary Configuration with Fallback
 * If Cloudinary is not configured or fails, uses base64 encoding
 */

var CLOUDINARY_CONFIG = {
  cloudName: 'oleg_yuryevich',
  uploadPreset: 'aylensale_preset',
  folder: 'aylensale',
  useCloudinary: true // Can be set to false to force base64
};

/**
 * Upload image to Cloudinary with fallback to base64
 * Returns: {success: true/false, url: string, method: 'cloudinary'|'base64', error: string}
 */
async function uploadImageToCloudinary(file) {
  // Check if Cloudinary is configured
  var isConfigured = CLOUDINARY_CONFIG.cloudName && 
                    !CLOUDINARY_CONFIG.cloudName.includes('YOUR_') &&
                    CLOUDINARY_CONFIG.uploadPreset &&
                    !CLOUDINARY_CONFIG.uploadPreset.includes('YOUR_');

  // If not configured or useCloudinary is false, use base64 fallback
  if (!isConfigured || !CLOUDINARY_CONFIG.useCloudinary) {
    return base64FallbackUpload(file);
  }

  var formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  if (CLOUDINARY_CONFIG.folder) {
    formData.append('folder', CLOUDINARY_CONFIG.folder);
  }

  try {
    var response = await fetch(
      'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CONFIG.cloudName + '/image/upload',
      {
        method: 'POST',
        body: formData,
        timeout: 10000
      }
    );

    var data = await response.json();

    if (!response.ok) {
      var message = (data && data.error && data.error.message) ? data.error.message : 'Cloudinary error: ' + (response.statusText || 'Unknown error');
      console.warn('Cloudinary upload failed, using fallback:', message);
      // Fallback to base64
      return base64FallbackUpload(file);
    }

    if (data && data.secure_url) {
      return {
        success: true,
        url: data.secure_url,
        publicId: data.public_id,
        method: 'cloudinary'
      };
    }

    console.warn('Cloudinary invalid response, using fallback');
    return base64FallbackUpload(file);
  } catch (error) {
    console.warn('Cloudinary fetch failed, using fallback:', error.message);
    // Fallback to base64 if network error
    return base64FallbackUpload(file);
  }
}

/**
 * Base64 fallback when Cloudinary is unavailable
 * Encodes image as data URL
 */
function base64FallbackUpload(file) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    
    reader.onload = function(e) {
      resolve({
        success: true,
        url: e.target.result, // data URL
        method: 'base64',
        fileName: file.name
      });
    };
    
    reader.onerror = function(e) {
      resolve({
        success: false,
        error: 'Failed to read file: ' + (e.error ? e.error.message : 'Unknown error'),
        method: 'base64'
      });
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleImages(files) {
  var urls = [];
  for (var i = 0; i < files.length; i++) {
    var result = await uploadImageToCloudinary(files[i]);
    if (result.success) {
      urls.push(result.url);
    }
  }
  return urls;
}
