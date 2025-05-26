# Quick Setup Guide for SerpAPI Integration

## Step 1: Install Dependencies
```bash
cd /Users/rex/work/rexposadas/draft-copilot
npm install
```

## Step 2: Get Your SerpAPI Key
1. Go to https://serpapi.com/
2. Sign up for a free account (100 searches/month)
3. Go to your dashboard and copy your API key

## Step 3: Update .env File
Open `.env` and replace the placeholder:
```env
SEARCH_API_KEY=your_actual_serpapi_key_here
```

## Step 4: Test SerpAPI Connection
```bash
npm run test-serpapi
```

You should see output like:
```
🔍 Testing SerpAPI Integration...
🔍 Testing SerpAPI connection...
✅ Found 5 results:
🏀 Found 2 sports-specific results - Great!
✅ SerpAPI test completed successfully!
```

## Step 5: Start the Server
```bash
npm run dev
```

## Step 6: Test the API
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Who won the 2024 NBA Finals?"}'
```

## Troubleshooting

### If you get "Cannot find module 'dotenv'":
```bash
npm install dotenv
```

### If you get authentication errors:
- Check that your API key is correct in `.env`
- Verify your account at https://serpapi.com/dashboard

### If you get rate limit errors:
- You've used your 100 free searches for the month
- Check usage at https://serpapi.com/dashboard

## What's Different Now

With SerpAPI integration, your API now:
✅ **Gets real-time Google search results** for sports queries
✅ **Prioritizes official sports websites** (ESPN, NBA.com, etc.)
✅ **Provides verifiable sources** with actual URLs
✅ **Reduces AI hallucination** by grounding answers in current data
✅ **Works like ChatGPT** with web search capabilities

The difference will be dramatic - you'll get current scores, recent trades, and up-to-date statistics with proper source citations!
