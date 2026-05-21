/**
 * AI media: Whisper recording, camera scan, TTS playback.
 */
(function(global) {
  var recorder = null;
  var recordChunks = [];
  var cameraStream = null;

  function blobToBase64(blob) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        var dataUrl = reader.result || '';
        var base64 = String(dataUrl).split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function getWhisperLanguage() {
    var el = document.getElementById('aiVoiceLang');
    var v = el ? el.value : 'ru-RU';
    if (v.indexOf('uk') === 0) return 'uk';
    if (v.indexOf('en') === 0) return 'en';
    return 'ru';
  }

  async function startWhisperRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone not available on this device');
    }
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordChunks = [];
    var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = function(e) {
      if (e.data && e.data.size) recordChunks.push(e.data);
    };
    recorder._stream = stream;
    recorder.start(200);
    return recorder;
  }

  function stopWhisperRecording() {
    return new Promise(function(resolve, reject) {
      if (!recorder) {
        reject(new Error('Not recording'));
        return;
      }
      var rec = recorder;
      recorder = null;
      rec.onstop = async function() {
        try {
          if (rec._stream) {
            rec._stream.getTracks().forEach(function(t) { t.stop(); });
          }
          var blob = new Blob(recordChunks, { type: rec.mimeType || 'audio/webm' });
          recordChunks = [];
          var base64 = await blobToBase64(blob);
          resolve({ base64: base64, mimeType: blob.type || 'audio/webm' });
        } catch (e) {
          reject(e);
        }
      };
      rec.stop();
    });
  }

  function ensureCameraOverlay() {
    var el = document.getElementById('aiCameraOverlay');
    if (el) return el;
    document.body.insertAdjacentHTML('beforeend',
      '<div id="aiCameraOverlay" class="ai-camera-overlay" aria-hidden="true">' +
      '<video id="aiCameraVideo" playsinline autoplay muted></video>' +
      '<div class="ai-camera-bar">' +
      '<button type="button" id="aiCameraCancel" style="background:#475569;color:#fff">Cancel</button>' +
      '<button type="button" id="aiCameraSnap" style="background:#e94560;color:#fff">Scan product</button>' +
      '</div></div>');
    return document.getElementById('aiCameraOverlay');
  }

  async function openCameraPreview() {
    var overlay = ensureCameraOverlay();
    var video = document.getElementById('aiCameraVideo');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera not available');
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    video.srcObject = cameraStream;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    return new Promise(function(resolve, reject) {
      document.getElementById('aiCameraCancel').onclick = function() {
        closeCameraPreview();
        reject(new Error('cancelled'));
      };
      document.getElementById('aiCameraSnap').onclick = function() {
        captureCameraFrame(video).then(resolve).catch(reject);
      };
    });
  }

  function closeCameraPreview() {
    var overlay = document.getElementById('aiCameraOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(function(t) { t.stop(); });
      cameraStream = null;
    }
  }

  function captureCameraFrame(video) {
    return new Promise(function(resolve, reject) {
      try {
        var w = video.videoWidth || 1280;
        var h = video.videoHeight || 720;
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        closeCameraPreview();
        resolve({
          base64: dataUrl.split(',')[1],
          mimeType: 'image/jpeg'
        });
      } catch (e) {
        closeCameraPreview();
        reject(e);
      }
    });
  }

  function captureFromFileInput(file) {
    return blobToBase64(file).then(function(base64) {
      return { base64: base64, mimeType: file.type || 'image/jpeg' };
    });
  }

  var lastTtsUrl = null;

  async function playTts(apiRequestFn, text) {
    if (!text || !global.speechSynthesis && !apiRequestFn) return;
    try {
      var res = await apiRequestFn('tts', { text: String(text).slice(0, 500) });
      if (res.audioBase64) {
        if (lastTtsUrl) URL.revokeObjectURL(lastTtsUrl);
        var bin = atob(res.audioBase64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var blob = new Blob([bytes], { type: res.mimeType || 'audio/mpeg' });
        lastTtsUrl = URL.createObjectURL(blob);
        var audio = new Audio(lastTtsUrl);
        await audio.play();
        return;
      }
    } catch (e) {
      console.warn('TTS API failed, using browser voice', e.message);
    }
    if (global.speechSynthesis) {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      global.speechSynthesis.speak(u);
    }
  }

  global.AYLEN_AI_MEDIA = {
    startWhisperRecording: startWhisperRecording,
    stopWhisperRecording: stopWhisperRecording,
    getWhisperLanguage: getWhisperLanguage,
    openCameraPreview: openCameraPreview,
    closeCameraPreview: closeCameraPreview,
    captureFromFileInput: captureFromFileInput,
    playTts: playTts
  };
})(typeof window !== 'undefined' ? window : this);
