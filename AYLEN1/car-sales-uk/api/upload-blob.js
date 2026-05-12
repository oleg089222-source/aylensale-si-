/**
 * Vercel Blob Upload Endpoint
 * Handles image uploads to Vercel Blob Storage
 * Provides persistent cloud storage for product and auction images
 * 
 * Usage:
 * POST /api/upload-blob
 * Content-Type: application/json
 * Body: { base64: "data:image/jpeg;base64,..." }
 * 
 * Returns success:
 * { success: true, url: "https://...", method: "vercel-blob" }
 * 
 * Returns error:
 * { success: false, error: "message" }
 */

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    // Parse incoming data
    let base64Data = null;
    let contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      // Client sent JSON with base64 image
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      base64Data = body.base64;
    } else if (contentType.includes('text/plain')) {
      // Client sent raw base64 string
      base64Data = typeof req.body === 'string' ? req.body : req.body.toString();
    }

    if (!base64Data) {
      return res.status(400).json({ 
        success: false, 
        error: 'No base64 image data provided' 
      });
    }

    // Extract base64 from data URL if present
    if (typeof base64Data === 'string' && base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }

    // Decode base64 to buffer
    let buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch (decodeError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid base64 data: ' + decodeError.message
      });
    }

    // Validate buffer size (max 5MB for images)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (buffer.length > MAX_SIZE) {
      return res.status(413).json({ 
        success: false, 
        error: 'Image too large (max 5MB)'
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const filename = 'aylensale-' + timestamp + '-' + random + '.jpg';

    // Try to use Vercel Blob if available
    try {
      // Vercel Blob SDK
      const { put } = await import('@vercel/blob');
      
      const blob = await put(filename, buffer, {
        access: 'public',
        addRandomSuffix: false,
      });

      return res.status(200).json({
        success: true,
        url: blob.url,
        method: 'vercel-blob'
      });

    } catch (blobError) {
      console.warn('Vercel Blob not available:', blobError.message);
      
      // Fallback: Store on Vercel as base64 (not ideal, but works)
      // In production, implement your own blob storage service
      // For now, return error to trigger client-side fallback
      return res.status(503).json({
        success: false,
        error: 'Blob storage temporarily unavailable. Will use local storage.',
        fallback: true
      });
    }

  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error: ' + (error.message || 'Unknown error')
    });
  }
}
