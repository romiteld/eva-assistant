# EVA Assistant Architecture

## Project Structure

```
eva-assistant/
├── frontend/          # Next.js application (UI + optional API routes)
├── supabase/         # Backend infrastructure
│   ├── functions/    # Edge Functions (serverless backend logic)
│   │   ├── ai-agents/        # AI agent coordination
│   │   └── websocket-handler/ # Real-time communication
│   ├── migrations/   # Database schema migrations
│   └── config.toml   # Supabase configuration
├── Docs/             # Documentation
├── .mcp.json        # MCP server configuration
├── .env             # Environment variables
└── package.json     # Root package configuration
```

## Architecture Overview

This project uses a **modern serverless architecture**:

### Frontend (Next.js)
- React-based UI with TypeScript
- Real-time dashboard components
- WebSocket connections to Supabase
- Optional API routes for custom endpoints

### Backend (Supabase)
- **Database**: PostgreSQL with real-time subscriptions
- **Authentication**: Magic Link OTP
- **Storage**: Document storage with RAG capabilities
- **Edge Functions**: Serverless functions for:
  - AI agent coordination
  - Document processing
  - Integration webhooks
  - Custom business logic

### Why No Separate Backend Directory?

1. **Supabase IS the backend** - provides all backend services
2. **Edge Functions** handle custom server-side logic
3. **Serverless Architecture** - no need for traditional server
4. **Next.js API Routes** available if needed for specific endpoints
5. **Cost Efficient** - pay only for what you use

### AI Agents

AI agents are implemented as:
- Edge Functions in `supabase/functions/ai-agents`
- Frontend orchestration in `frontend/src/lib/agents`
- Database-driven task queue in Supabase tables

This architecture provides:
- ✅ Scalability
- ✅ Real-time capabilities
- ✅ Cost efficiency
- ✅ Modern development experience
- ✅ Easy deployment
