# 🎤 Testing Eva's Voice Agent - Live Session

## Quick Test Steps

1. **Open Talk to Eva**: http://localhost:3000/dashboard/talk-to-eva
2. **Click "Connect"** button
3. **Allow microphone** access when prompted

## Conversation Examples to Test

### 1️⃣ Basic Conversation
"Hi Eva, I'm testing your voice capabilities. Can you hear me?"

### 2️⃣ Web Search
"What's the latest news about AI today?"

### 3️⃣ Task Creation
"Create a task to review candidate applications tomorrow at 2 PM"

### 4️⃣ Email Check
"Show me my unread emails"

### 5️⃣ Complex Request
"Search for financial advisor recruiting trends and create a task to implement the best practices"

## What to Look For

✅ **Voice Activity Indicator** - Visual feedback when speaking
✅ **Tool Execution Icons** - Shows when Eva uses tools
✅ **Natural Responses** - Eva should respond conversationally
✅ **Context Retention** - Eva remembers previous messages

## Testing Checklist

- [ ] Voice connection established
- [ ] Eva responds to greeting
- [ ] Web search tool executes
- [ ] Task creation works
- [ ] Email integration functions
- [ ] Multi-tool orchestration succeeds
- [ ] Context maintained across messages

## Tool Indicators

When Eva uses tools, you'll see icons:
- 🔍 **search_web** - Web search
- ✅ **create_task** - Task creation
- 📧 **read_emails** - Email reading
- ⚡ **execute_workflow** - Agent orchestration
- 📍 **navigate_dashboard** - Navigation

## Quick Debug

If Eva isn't responding:
1. Check browser console for errors (F12)
2. Ensure microphone permissions granted
3. Verify "Connected" status shows
4. Try refreshing and reconnecting

Eva is ready to demonstrate her full capabilities! 🚀