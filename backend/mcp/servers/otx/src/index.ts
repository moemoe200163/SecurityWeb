import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';

const OTX_API_KEY = process.env.OTX_API_KEY;
const OTX_BASE_URL = 'https://otx.alienvault.com/api/v1';

const server = new McpServer(
  { name: 'otx-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

async function otxRequest(endpoint: string, params: Record<string, string> = {}) {
  if (!OTX_API_KEY) {
    throw new Error('OTX_API_KEY environment variable is not set');
  }

  const url = new URL(`${OTX_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    headers: {
      'X-OTX-API-KEY': OTX_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OTX API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Tool: Pulse Search
server.registerTool(
  'search_pulses',
  {
    title: 'Search Threat Pulses',
    description: 'Search for threat intelligence pulses by keyword',
    inputSchema: z.object({
      keywords: z.string().describe('Search keywords'),
      limit: z.number().optional().describe('Maximum results (default 10)')
    })
  },
  async ({ keywords, limit = 10 }) => {
    try {
      const data = await otxRequest('/search/pulses', {
        keywords,
        limit: String(limit)
      });

      const pulses = data.results || [];
      const summary = pulses.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description?.substring(0, 200) + '...' || 'N/A',
        tags: p.tags?.slice(0, 5) || [],
        created: p.created,
        modified: p.modified,
        indicatorsCount: p.indicator_count || 0,
        malwareTypes: p.malware_types?.slice(0, 3) || [],
        attackTypes: p.attack_types?.slice(0, 3) || []
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Tool: Get IP reputation
server.registerTool(
  'check_ip_reputation',
  {
    title: 'Check IP Reputation',
    description: 'Check IP address reputation on AlienVault OTX',
    inputSchema: z.object({
      ipAddress: z.string().describe('IP address to check')
    })
  },
  async ({ ipAddress }) => {
    try {
      const data = await otxRequest(`/indicators/IPv4/${ipAddress}`);

      const summary = {
        ip: ipAddress,
        country: data.country_code || 'Unknown',
        city: data.city || 'Unknown',
        latitude: data.latitude,
        longitude: data.longitude,
        asn: data.asn || 'Unknown',
        pulseCount: data.pulse_info?.count || 0,
        relatedThreats: data.pulse_info?.related?.map((r: any) => ({
          name: r.name,
          tags: r.tags?.slice(0, 5) || []
        })) || [],
        indicators: data.pulse_info?.pulses?.flatMap((p: any) =>
          p.indicators?.map((i: any) => ({
            type: i.type,
            indicator: i.indicator,
            description: i.description
          })) || []
        )?.slice(0, 10) || []
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Tool: Get Domain reputation
server.registerTool(
  'check_domain_reputation',
  {
    title: 'Check Domain Reputation',
    description: 'Check domain reputation on AlienVault OTX',
    inputSchema: z.object({
      domain: z.string().describe('Domain to check')
    })
  },
  async ({ domain }) => {
    try {
      const data = await otxRequest(`/indicators/domain/${domain}`);

      const summary = {
        domain,
       AlexaRank: data.alexa || 'N/A',
        pulseCount: data.pulse_info?.count || 0,
        relatedThreats: data.pulse_info?.related?.map((r: any) => ({
          name: r.name,
          tags: r.tags?.slice(0, 5) || []
        })) || [],
        whois: data.whois ? {
          registrar: data.whois.registrar,
          creationDate: data.whois.creation_date,
          expirationDate: data.whois.expiration_date
        } : null
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Tool: File hash lookup
server.registerTool(
  'check_file_hash',
  {
    title: 'Check File Hash',
    description: 'Check file hash (MD5/SHA1/SHA256) reputation on OTX',
    inputSchema: z.object({
      hash: z.string().describe('File hash to check')
    })
  },
  async ({ hash }) => {
    try {
      const data = await otxRequest(`/indicators/file/${hash}`);

      const summary = {
        hash,
        type: data.type || 'Unknown',
        classification: data.classification || 'Unknown',
        pulseCount: data.pulse_info?.count || 0,
        relatedThreats: data.pulse_info?.related?.map((r: any) => ({
          name: r.name,
          tags: r.tags?.slice(0, 5) || []
        })) || [],
        'mitre-attack': data.pulse_info?.pulses?.flatMap((p: any) =>
          p.attack?.map((a: any) => a.attack_id) || []
        ) || []
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Tool: Get user pulses
server.registerTool(
  'get_subscribed_pulses',
  {
    title: 'Get Subscribed Pulses',
    description: 'Get latest pulses from subscribed users',
    inputSchema: z.object({
      limit: z.number().optional().describe('Maximum results (default 20)')
    })
  },
  async ({ limit = 20 }) => {
    try {
      const data = await otxRequest('/pulses/subscribed', {
        limit: String(limit)
      });

      const pulses = data.results || [];
      const summary = pulses.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description?.substring(0, 150) + '...' || 'N/A',
        tags: p.tags?.slice(0, 5) || [],
        created: p.created,
        indicatorsCount: p.indicator_count || 0,
        author: p.author?.username || 'Unknown'
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

const transport = new StdioServerTransport();
server.connect(transport);
