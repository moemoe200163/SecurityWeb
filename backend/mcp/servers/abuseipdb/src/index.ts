import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';

const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;
const ABUSEIPDB_BASE_URL = 'https://api.abuseipdb.com/api/v2';

const server = new McpServer(
  { name: 'abuseipdb-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

async function abuseipdbRequest(endpoint: string, params: Record<string, string> = {}) {
  if (!ABUSEIPDB_API_KEY) {
    throw new Error('ABUSEIPDB_API_KEY environment variable is not set');
  }

  const url = new URL(`${ABUSEIPDB_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    headers: {
      'Key': ABUSEIPDB_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AbuseIPDB API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Tool: Check IP reputation
server.registerTool(
  'check_ip',
  {
    title: 'Check IP Reputation',
    description: 'Check IP address reputation on AbuseIPDB with confidence score',
    inputSchema: z.object({
      ipAddress: z.string().describe('IP address to check'),
      maxAgeInDays: z.number().optional().describe('Maximum age in days (default 90)')
    })
  },
  async ({ ipAddress, maxAgeInDays = 90 }) => {
    try {
      const data = await abuseipdbRequest('/check', {
        ipAddress,
        maxAgeInDays: String(maxAgeInDays)
      });

      const result = data.data;
      const confidenceScore = result.abuseConfidenceScore || 0;

      // Interpret confidence score
      let threatLevel = 'Unknown';
      if (confidenceScore >= 75) threatLevel = 'High Threat';
      else if (confidenceScore >= 50) threatLevel = 'Medium Threat';
      else if (confidenceScore >= 25) threatLevel = 'Low Threat';
      else if (confidenceScore > 0) threatLevel = 'Minimal Threat';
      else threatLevel = 'No Known Threat';

      const summary = {
        ip: result.ipAddress,
        isp: result.isp,
        domain: result.domain || 'N/A',
        usageType: result.usageType || 'Unknown',
        threatLevel,
        confidenceScore,
        totalReports: result.totalReports || 0,
        numDistinctUsers: result.numDistinctUsers || 0,
        lastReportedAt: result.lastReportedAt || 'Never',
        isWhitelisted: result.isWhitelisted || false,
        countryCode: result.countryCode || 'Unknown',
        countryName: result.countryName || 'Unknown'
      };

      return {
        content: [
          { type: 'text', text: JSON.stringify(summary, null, 2) }
        ]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Tool: Report IP
server.registerTool(
  'report_ip',
  {
    title: 'Report Malicious IP',
    description: 'Report a malicious IP to AbuseIPDB database',
    inputSchema: z.object({
      ipAddress: z.string().describe('Malicious IP address'),
      categories: z.string().describe('Comma-separated category IDs (e.g., "18,22" for SSH brute force, port scan)'),
      comment: z.string().optional().describe('Additional comment about the incident')
    })
  },
  async ({ ipAddress, categories, comment }) => {
    try {
      const data = await abuseipdbRequest('/report', {
        ipAddress,
        categories,
        comment: comment || ''
      });

      return {
        content: [
          { type: 'text', text: JSON.stringify({
            success: data.data?.success || true,
            message: 'IP reported successfully',
            ipAddress,
            categories
          }, null, 2) }
        ]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Tool: Get blacklist status
server.registerTool(
  'check_blacklist',
  {
    title: 'Check Blacklist Status',
    description: 'Check if an IP appears on common blacklists via AbuseIPDB',
    inputSchema: z.object({
      ipAddress: z.string().describe('IP address to check')
    })
  },
  async ({ ipAddress }) => {
    try {
      const data = await abuseipdbRequest('/check', {
        ipAddress,
        maxAgeInDays: '30'
      });

      const result = data.data;
      const reports = result.totalReports || 0;

      // Generate blacklist assessment
      const blacklistAssessment = {
        ip: result.ipAddress,
        isWhitelisted: result.isWhitelisted,
        abuseConfidenceScore: result.abuseConfidenceScore || 0,
        appearsOnBlacklists: reports > 0,
        reportCount: reports,
        severity: reports === 0 ? 'Clean' :
                  reports < 5 ? 'Low' :
                  reports < 20 ? 'Medium' :
                  reports < 50 ? 'High' : 'Critical',
        recommendedAction: reports === 0 ? 'No action needed' :
                          reports < 5 ? 'Monitor only' :
                          reports < 20 ? 'Consider blocking' :
                          'Recommend immediate block'
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(blacklistAssessment, null, 2) }]
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
