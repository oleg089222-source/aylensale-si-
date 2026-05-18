const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const PORT = 3000;

// Handler for API requests
async function handleApiRequest(req, res) {
  if (req.url === '/api/send-order' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const orderData = JSON.parse(body);
        
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        
        if (!botToken || !chatId) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Telegram not configured',
            botToken: botToken ? 'SET' : 'NOT SET',
            chatId: chatId ? 'SET' : 'NOT SET'
          }));
          return;
        }
        
        // Build message
        let text = 'NEW ORDER - AYLENSALE\n\n';
        text += `Customer: ${orderData.name}\n`;
        text += `Phone: ${orderData.phone}\n`;
        text += `Pickup: ${orderData.pickup || 'Not selected'}\n`;
        
        if (orderData.comment) {
          text += `Comment: ${orderData.comment}\n`;
        }
        
        if (orderData.card) {
          text += `Card: ${orderData.card}${orderData.discount ? ' (-' + orderData.discount + '%)' : ''}\n`;
        }
        
        text += '\nItems:\n';
        if (Array.isArray(orderData.items)) {
          for (const item of orderData.items) {
            const itemTotal = (parseFloat(item.price) * parseInt(item.qty)).toFixed(2);
            text += `- ${item.name} x${item.qty} = £${itemTotal}\n`;
          }
        }
        
        text += `\nTOTAL: £${orderData.total || '0.00'}`;
        
        // Send to Telegram
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        const response = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
          }),
        });
        
        const data = await response.json();
        
        if (!data.ok) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Failed to send Telegram message',
            details: data
          }));
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true,
          message: 'Order sent successfully!',
          messageId: data.result.message_id
        }));
        
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: error.message
        }));
      }
    });
    
  } else if (req.url === '/api/test-telegram' && req.method === 'GET') {
    // Test endpoint
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      
      if (!botToken || !chatId) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Telegram credentials not configured',
          botToken: botToken ? 'SET' : 'NOT SET',
          chatId: chatId ? 'SET' : 'NOT SET'
        }));
        return;
      }
      
      const testMessage = `✅ AYLENSALE Test\nTime: ${new Date().toISOString()}\nBot is working!`;
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMessage,
        }),
      });
      
      const data = await response.json();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
}

// Handler for static files
function handleStaticFile(req, res) {
  let filePath = path.join(__dirname, decodeURIComponent(url.parse(req.url).pathname));
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };
    
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // FIX: Replace old Firebase SDK with COMPAT mode for index.html
    if (filePath.endsWith('index.html')) {
      console.log('[Server] Serving index.html - injecting Firebase COMPAT SDK...');
      
      // Replace old SDK with compat versions
      content = content.replace(
        /https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/firebase-app\.js/g,
        'https://www.gstatic.com/firebasejs/10.5.0/firebase-app-compat.js?t=' + Date.now()
      );
      
      content = content.replace(
        /https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/firebase-firestore\.js/g,
        'https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore-compat.js?t=' + Date.now()
      );
      
      content = content.replace(
        /https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/firebase-storage\.js/g,
        'https://www.gstatic.com/firebasejs/10.5.0/firebase-storage-compat.js?t=' + Date.now()
      );
      
      console.log('[Server] ✅ Firebase COMPAT SDK injected');
      
      // Set no-cache headers for HTML
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(content);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url.startsWith('/api/')) {
    handleApiRequest(req, res);
  } else {
    handleStaticFile(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📱 Test Telegram: http://localhost:${PORT}/api/test-telegram`);
  console.log(`📦 App: http://localhost:${PORT}/index.html`);
  console.log(`\n🔐 Environment:`);
  console.log(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'SET ✓' : 'NOT SET ✗'}`);
  console.log(`   TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? 'SET ✓' : 'NOT SET ✗'}`);
});
