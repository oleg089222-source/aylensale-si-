/**
 * Cloudinary Configuration with Vercel Blob Fallback
 * Image Upload Pipeline:
 * 1. Try Cloudinary (preferred - fast, reliable CDN)
 * 2. Fallback to Vercel Blob (/api/upload-blob)
 * 3. Last resort: Base64 only if both fail (not recommended for persistence)
 * 
 * All images are stored as URLs (never as blob data in localStorage)
 */

var CLOUDINARY_CONFIG = {
  cloudName: 'oleg_yuryevich',
  uploadPreset: 'aylensale_preset',
  folder: 'aylensale',
  useCloudinary: true,
  vercelBlobFallback: true // Enable Vercel Blob as fallback
};

/**
 * Upload image to Cloudinary with Vercel Blob fallback
 * Returns: { success: true/false, url: string, method: 'cloudinary'|'vercel-blob'|'base64', error?: string }
 */
async function uploadImageToCloudinary(file) {
  // Check if Cloudinary is configured
  var isConfigured = CLOUDINARY_CONFIG.cloudName && 
                    !CLOUDINARY_CONFIG.cloudName.includes('YOUR_') &&
                    CLOUDINARY_CONFIG.uploadPreset &&
                    !CLOUDINARY_CONFIG.uploadPreset.includes('YOUR_');

  // Try Cloudinary first if configured
  if (isConfigured && CLOUDINARY_CONFIG.useCloudinary) {
    try {
      var cloudinaryResult = await uploadToCloudinary(file);
      if (cloudinaryResult.success) {
        return cloudinaryResult;
      }
      console.warn('Cloudinary upload failed, trying fallback:', cloudinaryResult.error);
    } catch (error) {
      console.warn('Cloudinary upload error:', error.message);
    }
  }

  // Try Vercel Blob as fallback
  if (CLOUDINARY_CONFIG.vercelBlobFallback) {
    try {
      var blobResult = await uploadToVercelBlob(file);
      if (blobResult.success) {
        return blobResult;
      }
      console.warn('Vercel Blob upload failed:', blobResult.error);
    } catch (error) {
      console.warn('Vercel Blob upload error:', error.message);
    }
  }

  // Last resort: Base64 only (NOT persistent across devices, use only for testing)
  console.warn('Using base64 fallback - images will NOT be visible on other devices');
  return base64FallbackUpload(file);
}

/**
 * Upload directly to Cloudinary
 */
async function uploadToCloudinary(file) {
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
      var message = (data && data.error && data.error.message) ? data.error.message : (response.statusText || 'Unknown error');
      return {
        success: false,
        error: message,
        method: 'cloudinary'
      };
    }

    if (data && data.secure_url) {
      return {
        success: true,
        url: data.secure_url,
        publicId: data.public_id,
        method: 'cloudinary'
      };
    }

    return {
      success: false,
      error: 'Invalid Cloudinary response',
      method: 'cloudinary'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      method: 'cloudinary'
    };
  }
}

/**
 * Upload to Vercel Blob via /api/upload-blob
 * Converts file to base64 and sends to server
 */
async function uploadToVercelBlob(file) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    
    reader.onload = function(e) {
      var base64Data = e.target.result; // data:image/...;base64,...
      
      // Send to Vercel Blob endpoint
      fetch('/api/upload-blob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ base64: base64Data })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success && data.url) {
          resolve({
            success: true,
            url: data.url,
            method: 'vercel-blob'
          });
        } else {
          resolve({
            success: false,
            error: data.error || 'Upload failed',
            method: 'vercel-blob'
          });
        }
      })
      .catch(error => {
        resolve({
          success: false,
          error: error.message,
          method: 'vercel-blob'
        });
      });
    };
    
    reader.onerror = function(e) {
      resolve({
        success: false,
        error: 'Failed to read file',
        method: 'vercel-blob'
      });
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Base64 fallback - stores image as data URL
 * WARNING: Not persistent across devices, only for single-session use
 */
function base64FallbackUpload(file) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    
    reader.onload = function(e) {
      resolve({
        success: true,
        url: e.target.result, // data URL
        method: 'base64',
        fileName: file.name,
        warning: 'Base64 fallback - not persistent'
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
