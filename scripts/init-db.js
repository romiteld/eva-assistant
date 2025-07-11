#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Initializing EVA Assistant Database...\n');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found. Please create it first.');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: envPath });

// Check required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

console.log('✅ Environment variables loaded\n');

// Database setup steps
const steps = [
  {
    name: 'Push database migrations',
    command: 'cd supabase && npx supabase db push',
    description: 'Applying database schema...'
  },
  {
    name: 'Create storage buckets',
    command: 'cd supabase && npx supabase storage create documents --public',
    description: 'Creating documents storage bucket...',
    optional: true
  }
];

// Execute each step
for (const step of steps) {
  console.log(`📌 ${step.description}`);
  try {
    execSync(step.command, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log(`✅ ${step.name} completed\n`);
  } catch (error) {
    if (step.optional) {
      console.log(`⚠️  ${step.name} failed (optional step, continuing...)\n`);
    } else {
      console.error(`❌ ${step.name} failed`);
      process.exit(1);
    }
  }
}

console.log('🎉 Database initialization complete!\n');
console.log('Next steps:');
console.log('1. Run "npm run dev" to start the development server');
console.log('2. Visit http://localhost:3000/login to test authentication');
console.log('3. Visit http://localhost:3000/test to run system tests\n');