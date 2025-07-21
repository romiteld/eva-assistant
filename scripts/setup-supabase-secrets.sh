#!/bin/bash

# Setup Supabase secrets for Microsoft OAuth
# This script should be run from the project root

echo "Setting up Supabase secrets for Microsoft OAuth..."

# Load environment variables
if [ -f .env.local ]; then
    source .env.local
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI is not installed."
    echo "Please install it first: npm install -g supabase"
    exit 1
fi

# Change to frontend directory where supabase config is
cd frontend

# Set secrets using environment variables
echo "Setting MICROSOFT_CLIENT_ID secret..."
echo "$MICROSOFT_CLIENT_ID" | supabase secrets set MICROSOFT_CLIENT_ID

echo "Setting MICROSOFT_CLIENT_SECRET secret..."
echo "$MICROSOFT_CLIENT_SECRET" | supabase secrets set MICROSOFT_CLIENT_SECRET

echo "Setting MICROSOFT_TENANT_ID secret..."
echo "$MICROSOFT_TENANT_ID" | supabase secrets set MICROSOFT_TENANT_ID

echo "Setting MICROSOFT_REDIRECT_URI secret..."
echo "$MICROSOFT_REDIRECT_URI" | supabase secrets set MICROSOFT_REDIRECT_URI

echo "Setting OPENAI_API_KEY secret..."
echo "$OPENAI_API_KEY" | supabase secrets set OPENAI_API_KEY

echo "Setting ELEVENLABS_API_KEY secret..."
echo "$ELEVENLABS_API_KEY" | supabase secrets set ELEVENLABS_API_KEY

echo "Supabase secrets setup complete!"
echo "Note: You may need to restart your edge functions for changes to take effect."