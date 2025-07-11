# EVA - Executive Virtual Assistant

AI-powered recruitment platform for financial advisor recruiting, built for The Well Recruiting Solutions.

## Overview

EVA (Executive Virtual Assistant) is a comprehensive recruitment automation platform that leverages AI to streamline the hiring process for financial advisors. Built with Next.js, Supabase, and cutting-edge AI technologies.

## Features

### 🤖 AI-Powered Capabilities
- **Voice Agent** - Real-time voice conversations with Gemini Live API
- **Lead Generation** - AI-powered search with Zoho CRM integration
- **Content Studio** - Automated content creation with predictive analytics
- **Resume Parser** - Intelligent resume analysis and candidate matching
- **Interview Scheduler** - AI-driven scheduling with calendar integration

### 🔗 Integrations
- **Microsoft 365** - Full integration (Outlook, Teams, SharePoint, OneDrive)
- **LinkedIn** - OAuth integration for profile access and messaging
- **Twilio** - SMS, voice calls, IVR, and conference capabilities
- **Zoom** - Video meeting integration
- **Firecrawl** - Web scraping and data extraction
- **Zoho CRM** - Lead management and synchronization

### 🛠️ Technical Features
- Real-time WebSocket communication
- Supabase authentication and database
- Multi-agent orchestration system
- Comprehensive analytics dashboard
- SEO optimization with structured data
- Shadcn UI components
- TypeScript throughout

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- API keys for integrations (Gemini, Firecrawl, etc.)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/eva-assistant.git
cd eva-assistant
```

2. Install dependencies:
```bash
cd frontend
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API keys and configuration
```

4. Initialize the database:
```bash
npm run db:init
```

5. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Environment Variables

Key environment variables needed:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# AI APIs
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_FIRECRAWL_API_KEY=your-firecrawl-api-key

# OAuth
NEXT_PUBLIC_ENTRA_CLIENT_ID=your-microsoft-client-id
NEXT_PUBLIC_LINKEDIN_CLIENT_ID=your-linkedin-client-id

# Services
NEXT_PUBLIC_TWILIO_ACCOUNT_SID=your-twilio-sid
NEXT_PUBLIC_ZOHO_CLIENT_ID=your-zoho-client-id
```

See `.env.example` for the complete list.

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/eva-assistant)

## Architecture

- **Frontend**: Next.js 14 with App Router
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI**: Google Gemini 2.5 Pro/Flash
- **Real-time**: Socket.io + Supabase Realtime
- **Styling**: Tailwind CSS with glassmorphic design

## Documentation

See the `/Docs` directory for detailed documentation on:
- Architecture and system design
- API documentation
- Deployment guides
- Integration setup
- Security considerations

## License

Proprietary - All rights reserved by The Well Recruiting Solutions

## Support

For support, please contact the development team.