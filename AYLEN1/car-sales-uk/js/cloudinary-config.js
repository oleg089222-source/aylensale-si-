// Cloudinary Configuration
var CLOUDINARY_CONFIG = {
  cloudName: 'oleg_yuryevich',
  uploadPreset: 'aylensale_preset',
  folder: 'aylensale'
};

async function uploadImageToCloudinary(file) {
  if (!CLOUDINARY_CONFIG.cloudName || CLOUDINARY_CONFIG.cloudName.includes('YOUR_')) {
    return {
      success: false,
      error: 'Cloudinary cloudName is not configured in js/cloudinary-config.js'
    };
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
        body: formData
      }
    );

    var data = await response.json();

    if (!response.ok) {
      var message = (data && data.error && data.error.message) ? data.error.message : response.statusText || 'Upload failed';
      console.error('Cloudinary upload failed:', response.status, data);
      return {
        success: false,
        error: message
      };
    }

    if (data && data.secure_url) {
      return {
        success: true,
        url: data.secure_url,
        publicId: data.public_id
      };
    }

    var missingUrlMsg = (data && data.error && data.error.message) ? data.error.message : 'Upload failed: no secure_url returned';
    console.error('Cloudinary upload invalid response:', response.status, data);
    return {
      success: false,
      error: missingUrlMsg
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message || 'Upload failed'
    };
  }
}

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
