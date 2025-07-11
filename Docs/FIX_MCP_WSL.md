# Fixing Supabase MCP Server for WSL

## The Problem
The MCP server is trying to use Windows commands (`cmd /c`) instead of WSL/Linux commands. This is why it's failing.

## Solution

### Option 1: Use Direct WSL Path
```bash
# Remove the existing server
claude mcp remove supabase

# Add using WSL path
claude mcp add supabase -- wsl /home/romiteld/eva-assistant/supabase-mcp.sh
```

### Option 2: Use Node.js Directly in WSL
```bash
# Remove the existing server
claude mcp remove supabase

# Add using node directly
claude mcp add supabase -- wsl bash -c "cd /home/romiteld/eva-assistant && SUPABASE_URL='https://ztakznzshlvqobzbuewb.supabase.co' SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjA3MTE4NywiZXhwIjoyMDY3NjQ3MTg3fQ.b9P2PzPy2qrPwSOAjAsdGdUoMWH7yn0BhuwBFKTNCik' npx -y @supabase/mcp-server-supabase@latest"
```

### Option 3: Create a Windows Batch File (if running Claude from Windows)
Create `supabase-mcp.bat` in Windows:
```batch
@echo off
wsl bash -c "cd /home/romiteld/eva-assistant && ./supabase-mcp.sh"
```

Then:
```bash
claude mcp add supabase -- C:\path\to\supabase-mcp.bat
```

### Option 4: Use Environment Variables in WSL
```bash
# In WSL, add to ~/.bashrc:
export SUPABASE_URL="https://ztakznzshlvqobzbuewb.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjA3MTE4NywiZXhwIjoyMDY3NjQ3MTg3fQ.b9P2PzPy2qrPwSOAjAsdGdUoMWH7yn0BhuwBFKTNCik"

# Then reload:
source ~/.bashrc

# Add the server:
claude mcp remove supabase
claude mcp add supabase -- wsl bash -lc "npx -y @supabase/mcp-server-supabase@latest"
```

## Quick Test
After adding the server, test in Claude:
```
Show me all tables in Supabase
```

## Alternative: Skip MCP and Use Supabase Directly
Your app is already configured to connect to Supabase cloud directly. The MCP server is optional for development convenience.

To run your app:
```bash
cd /home/romiteld/eva-assistant/frontend
npm install
npm run dev
```

The app will work perfectly without the MCP server!
