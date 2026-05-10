import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const VT_BASE_URL = 'https://www.virustotal.com/api/v3';

const server = new McpServer(
  { name: 'virustotal-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

async function vtRequest(endpoint: string) {
  if (!VIRUSTOTAL_API_KEY) {
    throw new Error('VIRUSTOTAL_API_KEY environment variable is not set');
  }

  const response = await fetch(`${VT_BASE_URL}${endpoint}`, {
    headers: {
      'x-apikey': VIRUSTOTAL_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`VirusTotal API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

server.registerTool(
  'lookup_ip',
  {
    title: 'Lookup IP',
    description: 'Lookup IP address reputation in VirusTotal',
    inputSchema: z.object({
      ip: z.string().describe('IP address to lookup')
    })
  },
  async ({ ip }) => {
    const data = await vtRequest(`/ip_addresses/${ip}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'lookup_domain',
  {
    title: 'Lookup Domain',
    description: 'Lookup domain reputation in VirusTotal',
    inputSchema: z.object({
      domain: z.string().describe('Domain to lookup')
    })
  },
  async ({ domain }) => {
    const data = await vtRequest(`/domains/${domain}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'lookup_hash',
  {
    title: 'Lookup Hash',
    description: 'Lookup file hash reputation in VirusTotal',
    inputSchema: z.object({
      hash: z.string().describe('File hash (MD5, SHA1, SHA256)')
    })
  },
  async ({ hash }) => {
    const data = await vtRequest(`/files/${hash}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport);