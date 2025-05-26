import fetch from 'node-fetch';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  priority?: number; // Added for source ranking
}

export interface SearchService {
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

// Brave Search API implementation
export class BraveSearchService implements SearchService {
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.append('q', query);
      url.searchParams.append('count', limit.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'X-Subscription-Token': this.apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      return data.web?.results?.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.description,
      })) || [];
    } catch (error) {
      console.error('Brave Search error:', error);
      return [];
    }
  }
}

// Tavily Search API implementation
export class TavilySearchService implements SearchService {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          search_depth: 'basic',
          include_answer: false,
          include_images: false,
          include_image_descriptions: false,
          max_results: limit,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily Search API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      return data.results?.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.content,
        content: result.raw_content,
      })) || [];
    } catch (error) {
      console.error('Tavily Search error:', error);
      return [];
    }
  }
}

// SerpAPI implementation (Google Search)
export class SerpApiSearchService implements SearchService {
  private apiKey: string;
  private baseUrl = 'https://serpapi.com/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.append('q', query);
      url.searchParams.append('api_key', this.apiKey);
      url.searchParams.append('engine', 'google');
      url.searchParams.append('num', limit.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      return data.organic_results?.map((result: any) => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
      })) || [];
    } catch (error) {
      console.error('SerpAPI error:', error);
      return [];
    }
  }
}

// Factory function to create search service based on configuration
export function createSearchService(provider: string, apiKey: string): SearchService {
  switch (provider.toLowerCase()) {
    case 'brave':
      return new BraveSearchService(apiKey);
    case 'tavily':
      return new TavilySearchService(apiKey);
    case 'serpapi':
      return new SerpApiSearchService(apiKey);
    default:
      throw new Error(`Unsupported search provider: ${provider}`);
  }
}
