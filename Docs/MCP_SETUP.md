# Supabase MCP Server Configuration for EVA Assistant

## Overview
This project is configured to use the Supabase MCP (Model Context Protocol) server for seamless integration with the EVA Assistant Supabase backend.

## MCP Configuration
The `.mcp.json` file in the project root contains the configuration for:

1. **Supabase MCP Server** - Provides direct access to your Supabase project
   - Project ID: `ztakznzshlvqobzbuewb`
   - URL: `https://ztakznzshlvqobzbuewb.supabase.co`
   - Configured with service role key for full access

2. **Filesystem MCP Server** - Provides file system access within the project
   - Allowed path: `/home/romiteld/eva-assistant`

## Setup Instructions

### 1. Install MCP Dependencies
From the project root, run:
```bash
npm install
```

This will install the required MCP server packages:
- `@supabase/mcp-server` - For Supabase integration
- `@modelcontextprotocol/server-filesystem` - For file system access

### 2. Using with Claude Code
When you run Claude Code in this directory, it will automatically detect and use the `.mcp.json` configuration.

### 3. Available MCP Commands
With the Supabase MCP server, you can:
- Query the database directly
- Manage tables and data
- Execute migrations
- Access real-time subscriptions
- Manage storage buckets

### 4. Environment Variables
The MCP server uses the following environment variables from your `.env` file:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key for server-side operations

## Security Note
The `.mcp.json` file contains sensitive credentials. It should NOT be committed to version control. Make sure it's included in your `.gitignore` file.

## Troubleshooting

### If MCP servers don't start:
1. Ensure you've run `npm install` in the project root
2. Check that Node.js version is 18+ (`node --version`)
3. Verify the Supabase credentials are correct
4. Try running Claude Code with `--mcp-debug` flag for detailed logs

### To test the Supabase MCP connection:
In Claude Code, you can test with:
```
Can you query the candidates table in Supabase?
```

This should return data from your Supabase database if configured correctly.
