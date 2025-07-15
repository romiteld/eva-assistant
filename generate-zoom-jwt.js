// Script to generate JWT token for Zoom connector
// Run with: node generate-zoom-jwt.js

const crypto = require('crypto');

// Manual JWT implementation since we might not have jsonwebtoken installed
function base64urlEscape(str) {
  return str.replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function createJWT(payload, secret) {
  // Create header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Encode header and payload
  const encodedHeader = base64urlEscape(Buffer.from(JSON.stringify(header)).toString('base64'));
  const encodedPayload = base64urlEscape(Buffer.from(JSON.stringify(payload)).toString('base64'));

  // Create signature
  const signature = base64urlEscape(
    crypto
      .createHmac('sha256', secret)
      .update(encodedHeader + '.' + encodedPayload)
      .digest('base64')
  );

  return encodedHeader + '.' + encodedPayload + '.' + signature;
}

// Create payload
const payload = {
  iss: "eva-assistant",
  sub: "zoom-connector",
  aud: "https://api.zoom.us",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
  jti: "eva-zoom-connector-001",
  scope: "meeting:write meeting:read user:read recording:read webhook:write",
  // You'll need to add your actual Zoom Client ID here
  app_key: "YOUR_ZOOM_CLIENT_ID" 
};

// Use a placeholder secret - replace with your actual ZOOM_WEBHOOK_SECRET_TOKEN
const secret = "your-zoom-webhook-secret-token";

const token = createJWT(payload, secret);

console.log("\n=== Zoom Connector Configuration ===\n");
console.log("1. Connection Name: EVA Recruitment Assistant");
console.log("2. Base URL: https://eva.thewell.solutions/api");
console.log("3. Algorithm: HS256");
console.log("4. Secret: [Use your ZOOM_WEBHOOK_SECRET_TOKEN from .env]");
console.log("5. Payload(Token):\n");
console.log(token);
console.log("\n=================================\n");
console.log("IMPORTANT: Replace 'YOUR_ZOOM_CLIENT_ID' and the secret with actual values!");