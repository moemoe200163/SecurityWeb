import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';

const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const BRAVE_BASE_URL = 'https://api.search.brave.com/res/v1';

const server = new McpServer(
  { name: 'brave-search-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

async function braveRequest(endpoint: string, params: Record<string, string>) {
  if (!BRAVE_SEARCH_API_KEY) {
    throw new Error('BRAVE_SEARCH_API_KEY environment variable is not set');
  }

  const url = new URL(`${BRAVE_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': BRAVE_SEARCH_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

server.registerTool(
  'web_search',
  {
    title: 'Web Search',
    description: 'Web search with security focus using Brave Search',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      count: z.number().optional().describe('Number of results (default 10)')
    })
  },
  async ({ query, count = 10 }) => {
    const data = await braveRequest('/search', {
      q: query,
      count: String(count)
    });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'image_search',
  {
    title: 'Image Search',
    description: 'Image search using Brave Search',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      count: z.number().optional().describe('Number of results (default 10)')
    })
  },
  async ({ query, count = 10 }) => {
    const data = await braveRequest('/images/search', {
      q: query,
      count: String(count)
    });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport);