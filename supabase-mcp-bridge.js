const { spawn } = require('child_process');

// Environment variables for Supabase
const env = {
  SUPABASE_URL: 'https://ztakznzshlvqobzbuewb.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjA3MTE4NywiZXhwIjoyMDY3NjQ3MTg3fQ.b9P2PzPy2qrPwSOAjAsdGdUoMWH7yn0BhuwBFKTNCik'
};

// Spawn the MCP server
const mcp = spawn('npx', ['-y', '@supabase/mcp-server-supabase@latest'], {
  env: { ...process.env, ...env },
  stdio: 'inherit',
  shell: true
});

mcp.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
});

mcp.on('exit', (code) => {
  console.log(`MCP server exited with code ${code}`);
});
