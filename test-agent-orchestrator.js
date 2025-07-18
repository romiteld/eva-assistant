#!/usr/bin/env node

// Test script to verify Agent Orchestrator Edge Function
const https = require('https');

const testData = {
  action: 'list',
  userId: 'test-user-123'
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'ztakznzshlvqobzbuewb.supabase.co',
  port: 443,
  path: '/functions/v1/agent-orchestrator',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ3ODI3NDYsImV4cCI6MjA0MDM1ODc0Nn0.PVBJAKJRAf0C5ZAx7DZHRiZKZu7uLJdQnkP3-r7XmWA'
  }
};

console.log('Testing Agent Orchestrator Edge Function...');
console.log('Request:', JSON.stringify(testData, null, 2));

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const jsonResponse = JSON.parse(data);
      console.log('Parsed Response:', JSON.stringify(jsonResponse, null, 2));
      
      if (jsonResponse.success && jsonResponse.agents) {
        console.log(`✅ SUCCESS: Found ${jsonResponse.agents.length} agents`);
        jsonResponse.agents.forEach(agent => {
          console.log(`  - ${agent.name} (${agent.status})`);
        });
      } else {
        console.log('❌ FAILED:', jsonResponse.error || 'Unknown error');
      }
    } catch (e) {
      console.log('❌ Failed to parse JSON response');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});

req.write(postData);
req.end();