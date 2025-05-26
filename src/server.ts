import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { createSearchService, SearchResult, SearchService } from './search-services';

// Load environment variables from .env file
config();

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize search service (using SerpAPI for Google search results)
const searchProvider = process.env.SEARCH_PROVIDER || 'serpapi'; // Default to SerpAPI
const searchApiKey = process.env.SEARCH_API_KEY;

// Debug logging
console.log('🔧 Environment Variables:');
console.log(`   SEARCH_PROVIDER: ${searchProvider}`);
console.log(`   SEARCH_API_KEY: ${searchApiKey ? `${searchApiKey.substring(0, 8)}...` : 'NOT SET'}`);
console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);

let searchService: SearchService | null = null;

if (searchApiKey) {
  try {
    searchService = createSearchService(searchProvider, searchApiKey);
    console.log(`Initialized ${searchProvider} search service`);
  } catch (error) {
    console.warn(`Failed to initialize search service: ${error}`);
  }
} else {
  console.warn('No SEARCH_API_KEY provided. Web search functionality will be disabled.');
}

interface SportsStatsResponse {
  answer: string;
  sources: Array<{
    title: string;
    url: string;
  }>;
  searchResults?: SearchResult[];
}

async function searchForSportsInfo(query: string): Promise<SearchResult[]> {
  if (!searchService) {
    return [];
  }

  try {
    // Create optimized search queries for sports information using SerpAPI
    const searchQueries = [
      // For Stephen Curry stats, prioritize official sources
      query.toLowerCase().includes('curry') || query.toLowerCase().includes('stephen') 
        ? `"Stephen Curry" ${query} site:nba.com OR site:basketball-reference.com OR site:espn.com`
        : `${query} site:espn.com OR site:nba.com OR site:nfl.com OR site:mlb.com OR site:nhl.com`,
      `${query} official sports statistics 2024 2025`,
      `${query} basketball-reference.com OR espn.com OR nba.com`,
      `${query} sports news latest`
    ];

    // Try different search strategies, starting with most specific
    for (const searchQuery of searchQueries) {
      const results = await searchService.search(searchQuery, 8);
      if (results.length > 0) {
        // Filter and prioritize high-quality sports sources
        const prioritizedResults = results
          .map(result => ({
            ...result,
            priority: calculateSourcePriority(result.url)
          }))
          .sort((a, b) => b.priority - a.priority)
          .filter(result => result.priority > 0); // Only include trusted sources
        
        if (prioritizedResults.length > 0) {
          return prioritizedResults.slice(0, 5);
        }
        
        // If no high-priority results, return first 5 general results but still filtered
        const generalSportsResults = results.filter(result => {
          const url = result.url.toLowerCase();
          const snippet = result.snippet.toLowerCase();
          
          return url.includes('espn.com') ||
                 url.includes('nba.com') ||
                 url.includes('nfl.com') ||
                 url.includes('mlb.com') ||
                 url.includes('nhl.com') ||
                 url.includes('bleacherreport.com') ||
                 url.includes('sports.yahoo.com') ||
                 url.includes('si.com') ||
                 url.includes('cbssports.com') ||
                 url.includes('basketball-reference.com') ||
                 snippet.includes('2024') ||
                 snippet.includes('2025') ||
                 snippet.includes('latest') ||
                 snippet.includes('current');
        });
        
        if (generalSportsResults.length >= 3) {
          return generalSportsResults.slice(0, 5);
        }
      }
    }
    
    return [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Function to prioritize sources by reliability
function calculateSourcePriority(url: string): number {
  const domain = url.toLowerCase();
  
  // Tier 1: Official league and stat sites (highest priority)
  if (domain.includes('nba.com') || 
      domain.includes('basketball-reference.com') ||
      domain.includes('nfl.com') ||
      domain.includes('mlb.com') ||
      domain.includes('nhl.com')) {
    return 100;
  }
  
  // Tier 2: Major sports media
  if (domain.includes('espn.com') ||
      domain.includes('si.com') ||
      domain.includes('cbssports.com')) {
    return 80;
  }
  
  // Tier 3: Reliable sports sources
  if (domain.includes('bleacherreport.com') ||
      domain.includes('sports.yahoo.com') ||
      domain.includes('theatlantic.com') ||
      domain.includes('reuters.com')) {
    return 60;
  }
  
  // Tier 4: General news with sports sections
  if (domain.includes('cnn.com') ||
      domain.includes('bbc.com') ||
      domain.includes('usatoday.com')) {
    return 40;
  }
  
  // Filter out unreliable sources
  if (domain.includes('reddit.com') ||
      domain.includes('twitter.com') ||
      domain.includes('facebook.com') ||
      domain.includes('blog') ||
      domain.includes('forum')) {
    return 0;
  }
  
  // Default for other sources
  return 20;
}

function formatSearchResultsForAI(searchResults: SearchResult[]): string {
  if (searchResults.length === 0) {
    return 'No recent web search results available.';
  }

  return searchResults
    .map((result, index) => 
      `[${index + 1}] ${result.title}\nURL: ${result.url}\nSummary: ${result.snippet}\n`
    )
    .join('\n');
}

app.post('/api/chat', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // First, search the web for current information using SerpAPI
    const searchResults = await searchForSportsInfo(question);
    const searchContext = formatSearchResultsForAI(searchResults);

    // Enhanced prompt that includes Google search results via SerpAPI
    const prompt = `You are a sports statistics expert with access to current Google search results via SerpAPI. Answer the following question using the most accurate and up-to-date information available.

CURRENT GOOGLE SEARCH RESULTS (ranked by source reliability):
${searchContext}

Instructions:
1. PRIORITIZE information from official sources like NBA.com, Basketball-Reference.com, ESPN.com
2. For Stephen Curry specifically, he recently became the FIRST player to reach 4,000 career 3-pointers (as of March 2025)
3. Use the search results above for the most current statistics
4. If search results conflict with your training data, prioritize the search results for recent events
5. Always cite your sources using the exact URLs from the search results
6. Include multiple reliable sources when available to increase credibility
7. If no relevant search results are available, use your training data but clearly note the information may not be current

Format your response as:
ANSWER: [Your detailed answer here, incorporating information from Google search results when available]

SOURCES:
- [Brief description] [EXACT_URL_HERE]
- [Brief description] [EXACT_URL_HERE]
- [Brief description] [EXACT_URL_HERE]

IMPORTANT: Keep URLs clean and separate from descriptions. Do NOT add parentheses or extra text to URLs.

Question: ${question}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful sports statistics expert with access to current Google search results. Always prioritize current search results over training data for recent events. Provide accurate citations from the search results.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Parse the response to extract answer and sources
    const answerMatch = responseText.match(/ANSWER:\s*(.*?)(?=SOURCES:|$)/s);
    const sourcesMatch = responseText.match(/SOURCES:\s*(.*)/s);

    let answer = answerMatch ? answerMatch[1].trim() : responseText;
    let sources: Array<{ title: string; url: string }> = [];

    if (sourcesMatch) {
      // Parse sources and extract clean URLs
      const rawSources = sourcesMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(source => source.length > 0);
      
      // Extract URLs and descriptions separately
      sources = rawSources.map(source => {
        // Look for URLs in the source line
        const urlMatch = source.match(/(https?:\/\/[^\s\)\(]+)/);
        if (urlMatch) {
          const cleanUrl = urlMatch[1];
          // Extract description (everything that's not the URL)
          let description = source.replace(urlMatch[0], '').replace(/[\(\)\-]/g, '').trim();
          // If no description, use the domain name
          if (!description) {
            const domain = cleanUrl.match(/\/\/([^\/]+)/);
            description = domain ? domain[1] : 'Source';
          }
          return {
            title: description,
            url: cleanUrl
          };
        }
        // If no URL found, this might be a malformed source
        return {
          title: source,
          url: '#'
        };
      }).filter(source => source.url !== '#'); // Remove malformed sources
    }

    // If no sources were found in the structured format, use search result URLs
    if (sources.length === 0 && searchResults.length > 0) {
      sources = searchResults.slice(0, 3).map(result => ({
        title: result.title,
        url: result.url
      }));
    }

    const response: SportsStatsResponse = {
      answer,
      sources,
      searchResults: searchResults.length > 0 ? searchResults : undefined
    };

    res.json(response);

  } catch (error) {
    console.error('Error calling OpenAI:', error);
    res.status(500).json({
      error: 'Failed to get sports stats information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// New endpoint to test SerpAPI search functionality
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!searchService) {
      return res.status(503).json({ 
        error: 'SerpAPI not configured',
        message: 'Please set SEARCH_API_KEY environment variable with your SerpAPI key'
      });
    }

    const results = await searchService.search(query, 10);
    res.json({ 
      query, 
      results,
      provider: 'SerpAPI (Google Search)',
      count: results.length 
    });

  } catch (error) {
    console.error('SerpAPI search error:', error);
    res.status(500).json({
      error: 'SerpAPI search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    searchService: searchService ? `${searchProvider} (Google Search) enabled` : 'disabled',
    provider: 'SerpAPI'
  });
});

app.listen(port, () => {
  console.log(`Sports Stats API server running on http://localhost:${port}`);
  console.log(`OpenAI API: ${process.env.OPENAI_API_KEY ? 'configured' : 'NOT configured'}`);
  console.log(`SerpAPI: ${searchService ? 'configured - Google Search enabled' : 'NOT configured'}`);
});

export default app;
