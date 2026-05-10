/**
 * Photo Upload Helper for Admin Panel
 * Handles file uploads via Cloudinary with base64 fallback
 */

/**
 * Handle file selection from input
 */
async function handlePhotoUpload(event, targetElementId) {
  var files = event.target.files;
  if (!files || files.length === 0) return;
  
  var uploadedUrls = [];
  var existingUrls = document.getElementById(targetElementId).value.trim();
  if (existingUrls) {
    uploadedUrls = existingUrls.split(',').map(u => u.trim()).filter(u => u);
  }
  
  // Show uploading status
  notify('Uploading ' + files.length + ' image(s)...', 'info');
  
  for (var i = 0; i < files.length; i++) {
    try {
      var result = await uploadImageToCloudinary(files[i]);
      if (result.success) {
        uploadedUrls.push(result.url);
        notify('Image ' + (i+1) + '/' + files.length + ' uploaded', 'success');
      } else {
        notify('Error uploading image ' + (i+1) + ': ' + result.error, 'error');
      }
    } catch (error) {
      notify('Upload error: ' + error.message, 'error');
    }
  }
  
  // Update input field with all URLs
  document.getElementById(targetElementId).value = uploadedUrls.join(', ');
  notify('All images uploaded successfully!', 'success');
}

/**
 * Display photo preview grid
 */
function displayPhotoPreview(urls, targetContainerId) {
  var container = document.getElementById(targetContainerId);
  if (!container) return;
  
  container.innerHTML = '';
  if (!urls || urls.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:20px">No photos uploaded</p>';
    return;
  }
  
  urls.forEach(function(url, index) {
    var div = document.createElement('div');
    div.style.cssText = 'position:relative;display:inline-block;width:80px;height:80px;margin:5px;border:1px solid #ddd;border-radius:5px;overflow:hidden';
    
    var img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    img.onerror = function() { img.style.backgroundColor = '#eee'; };
    
    var removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.style.cssText = 'position:absolute;top:-5px;right:-5px;background:#e94560;color:#fff;border:none;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1';
    removeBtn.onclick = function() {
      div.remove();
    };
    
    div.appendChild(img);
    div.appendChild(removeBtn);
    container.appendChild(div);
  });
}

/**
 * Create file input for photos
 */
function createPhotoFileInput(onUpload) {
  var input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*';
  input.onchange = onUpload;
  return input;
}

/**
 * Open file picker for photos
 */
function openPhotoUploadDialog(targetElementId) {
  var input = createPhotoFileInput(function(e) {
    handlePhotoUpload(e, targetElementId);
  });
  input.click();
}
