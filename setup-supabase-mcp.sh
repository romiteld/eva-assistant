#!/bin/bash

echo "Setting up Supabase MCP Server for EVA Assistant"
echo "================================================"
echo ""

# Environment variables
export SUPABASE_URL="https://ztakznzshlvqobzbuewb.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjA3MTE4NywiZXhwIjoyMDY3NjQ3MTg3fQ.b9P2PzPy2qrPwSOAjAsdGdUoMWH7yn0BhuwBFKTNCik"

echo "1. Remove any existing Supabase MCP server configuration:"
echo "   claude mcp remove supabase"
echo ""
echo "2. Add the Supabase MCP server with correct configuration:"
echo "   claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest"
echo ""
echo "3. The server will use these environment variables:"
echo "   - SUPABASE_URL: $SUPABASE_URL"
echo "   - SUPABASE_SERVICE_ROLE_KEY: [hidden for security]"
echo ""
echo "4. Alternative: If the above doesn't work, try setting up a manual server:"
echo "   Create a file 'supabase-mcp.js' with custom configuration"
echo ""

# Create a wrapper script for Supabase MCP
cat > supabase-mcp-wrapper.sh << 'EOF'
#!/bin/bash
export SUPABASE_URL="https://ztakznzshlvqobzbuewb.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjA3MTE4NywiZXhwIjoyMDY3NjQ3MTg3fQ.b9P2PzPy2qrPwSOAjAsdGdUoMWH7yn0BhuwBFKTNCik"
exec npx -y @supabase/mcp-server-supabase@latest "$@"
EOF

chmod +x supabase-mcp-wrapper.sh

echo "Created wrapper script: supabase-mcp-wrapper.sh"
echo ""
echo "You can also try:"
echo "   claude mcp add supabase -- ./supabase-mcp-wrapper.sh"
echo ""
echo "For the Supabase link issue, use the password: Atrovent1!1"
echo ""
echo "Or skip the link and use the cloud project directly - it's already configured!"
