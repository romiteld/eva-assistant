#!/bin/bash
# Supabase MCP Server Wrapper for WSL

# Export environment variables
export SUPABASE_URL="https://ztakznzshlvqobzbuewb.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjA3MTE4NywiZXhwIjoyMDY3NjQ3MTg3fQ.b9P2PzPy2qrPwSOAjAsdGdUoMWH7yn0BhuwBFKTNCik"

# Run the MCP server
exec npx -y @supabase/mcp-server-supabase@latest "$@"
