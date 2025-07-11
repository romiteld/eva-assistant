## 🚀 Quick Fix Commands for Supabase MCP Server in WSL

### Try these in order:

#### 1. Using Windows Batch File (RECOMMENDED)
```bash
# In your terminal/command prompt:
claude mcp remove supabase
claude mcp add supabase -- "C:\Users\DanielRomitelli\Desktop\supabase-mcp-wsl.bat"
```

#### 2. Using WSL Wrapper Script
```bash
# In WSL terminal:
claude mcp remove supabase
claude mcp add supabase -- wsl /home/romiteld/eva-assistant/supabase-mcp.sh
```

#### 3. Using Node.js Bridge
```bash
# In WSL:
claude mcp remove supabase
claude mcp add supabase -- wsl node /home/romiteld/eva-assistant/supabase-mcp-bridge.js
```

#### 4. Direct WSL Command
```bash
claude mcp remove supabase
claude mcp add supabase -- wsl bash -lc "cd /home/romiteld/eva-assistant && SUPABASE_URL='https://ztakznzshlvqobzbuewb.supabase.co' SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjA3MTE4NywiZXhwIjoyMDY3NjQ3MTg3fQ.b9P2PzPy2qrPwSOAjAsdGdUoMWH7yn0BhuwBFKTNCik' npx -y @supabase/mcp-server-supabase@latest"
```

#### 5. If All Else Fails - Skip MCP!
Your app works perfectly without the MCP server. Just run:
```bash
cd /home/romiteld/eva-assistant/frontend
npm install
npm run dev
```

## Test the MCP Server
Once added successfully, ask Claude:
- "Show me all tables in Supabase"
- "Query the candidates table"
- "List all Edge Functions"

## Note
The MCP server is a development tool for Claude Code. Your EVA Assistant application connects directly to Supabase cloud and doesn't require the MCP server to function.
