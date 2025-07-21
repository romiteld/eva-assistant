# 🧠 Eva Master Brain - Voice Assistant Test Guide

## Overview
Eva is now the **Master AI Brain** orchestrating all A2A (Agent-to-Agent) operations. She's not just a voice assistant - she's the central intelligence controlling all specialized agents.

## 🎯 Test Scenarios for Talk to Eva Page

### 1. Basic Conversation Tests
Test Eva's conversational abilities:
- **"Hello Eva, how are you today?"** - Basic greeting
- **"My name is John and I work at TechCorp"** → **"What's my name?"** - Context retention
- **"Tell me about yourself"** - Eva should explain her role as Master Brain

### 2. 🔍 Web Search & Information Lookup
Test real-time web search:
- **"Eva, search for the latest AI news"**
- **"What are the current trends in financial advisor recruiting?"**
- **"Find information about OpenAI's latest announcements"**

Expected: Eva uses `search_web` tool and returns current information.

### 3. ✅ Task Management
Test task creation and updates:
- **"Create a high priority task to review candidates tomorrow at 2 PM"**
- **"Create a task to follow up with Sarah about the interview"**
- **"Update task 123 to mark it as completed"**

Expected: Eva uses `create_task` or `update_task` tools.

### 4. 📧 Email Management
Test email capabilities:
- **"Show me my unread emails"**
- **"Read emails from today"**
- **"Write an email to john@example.com about scheduling a meeting"**
- **"Draft an email to the team but don't send it"**

Expected: Eva uses `read_emails` or `write_email` tools.

### 5. 🧠 Ultra Thinking & Deep Analysis
Test Eva's deep thinking orchestration:
- **"Use deep thinking to analyze the pros and cons of remote recruiting"**
- **"Help me create a comprehensive strategy for expanding into healthcare recruiting"**
- **"Analyze our competitor's approach from multiple perspectives"**

Expected: Eva uses `execute_workflow` with deep-thinking-orchestrator.

### 6. 📄 Document & Image Processing
Test multimodal capabilities:
1. Upload a resume or document
2. Say: **"Analyze this resume and extract key skills"**
3. Upload an image/chart
4. Say: **"What information is in this image?"**

Expected: Eva processes attachments and provides analysis.

### 7. 🤖 Agent Orchestration
Test Eva's control over specialized agents:
- **"Use the lead generation agent to find potential candidates"**
- **"Have the content studio create a LinkedIn post about our services"**
- **"Get the document processor to analyze these resumes"**

Expected: Eva uses `execute_workflow` with appropriate agent.

### 8. 📊 Real-time Monitoring
Test monitoring capabilities:
- **"Monitor AI recruiting news and notify me of updates"**
- **"Track updates from competitor websites daily"**
- **"Set up alerts for new senior developer profiles on LinkedIn"**

Expected: Eva uses `monitor_updates` tool.

### 9. 🎯 Multi-Tool Orchestration
Test complex workflows:
- **"Search for best practices in executive recruiting and create a task to implement them"**
- **"Find potential candidates for the CFO role, analyze their profiles, and draft outreach emails"**
- **"Check my emails about the client meeting and create a calendar event"**

Expected: Eva uses multiple tools in sequence.

### 10. 🧭 Dashboard Navigation
Test navigation:
- **"Take me to the deals page"**
- **"Show me the candidate pipeline"**
- **"Navigate to email management"**

Expected: Eva uses `navigate_dashboard` tool.

## 🛠️ How to Test

1. **Open Talk to Eva Page**: http://localhost:3000/dashboard/talk-to-eva
2. **Click "Connect"** to start voice session
3. **Try the test scenarios** above
4. **Watch for**:
   - Tool execution indicators (icons appear for each tool)
   - Response quality and relevance
   - Multi-tool coordination
   - Context retention across messages

## 📊 Expected Tool Executions

When Eva processes commands, you should see tool execution indicators:
- 🔍 **Search Web** - For information lookup
- ✅ **Create/Update Task** - For task management
- 📧 **Read/Write Email** - For email operations
- ⚡ **Execute Workflow** - For agent delegation
- 📍 **Navigate Dashboard** - For page navigation
- 🔔 **Monitor Updates** - For real-time tracking

## 🤖 Available Agents

Eva controls these specialized agents:
1. **Deep Thinking Orchestrator** - Complex analysis with 5 sub-agents
2. **Lead Generation Agent** - Find and qualify candidates
3. **AI Content Studio** - Create optimized content
4. **Resume Parser Pipeline** - Process documents
5. **Email Management Agent** - Handle email operations
6. **Real-Time Monitor Agent** - Track updates
7. **Web Intelligence Agent** - Search and extract web data

## 🎙️ Voice Commands Tips

- Be natural and conversational
- Eva understands context from previous messages
- You can ask follow-up questions
- Combine multiple requests in one command
- Upload files/images when needed

## ✨ Eva's Enhanced Capabilities

Eva is now empowered to:
- **Read and write emails** through Microsoft Graph API
- **Monitor real-time updates** from any source
- **Create and manage tasks** with full lifecycle control
- **Search the web** for current information
- **Process documents and images** with AI vision
- **Orchestrate multiple agents** for complex workflows
- **Navigate the dashboard** programmatically
- **Perform deep analysis** with ultra thinking

## 🚀 Advanced Test: Full Workflow

Try this complex scenario:
1. **"Eva, I need help filling a Senior Financial Advisor position"**
2. **"Search for top financial advisory firms and their recruiting strategies"**
3. **"Create a lead generation campaign targeting advisors with $100M+ AUM"**
4. **"Draft an outreach email template for potential candidates"**
5. **"Set up monitoring for new advisor profiles on LinkedIn"**
6. **"Create tasks for following up with interested candidates"**

This tests Eva's ability to coordinate multiple agents and tools for a complete workflow.

## 🎯 Success Indicators

✅ Eva responds naturally and conversationally
✅ Tool executions appear in the UI
✅ Multiple tools work together seamlessly
✅ Context is maintained across messages
✅ Complex workflows are handled intelligently
✅ Agents are delegated to appropriately

Eva is ready to be your Master AI Brain! 🧠✨