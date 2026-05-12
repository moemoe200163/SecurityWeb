import { MCPTool } from '../types.js';

export const holeheTool: MCPTool = {
  name: 'holehe_email',
  description: 'Check if an email address is registered on various websites using the holehe OSINT tool. Returns list of sites where the email is registered.',
  parameters: {
    email: {
      type: 'string',
      description: 'Email address to check',
      required: true,
    },
    useFirefoxCookies: {
      type: 'boolean',
      description: 'Use Firefox cookies for authentication on sites',
      required: false,
      default: false,
    },
  },
};

export function buildHoleheCommand(args: Record<string, string | number | boolean>): string[] {
  const { email, useFirefoxCookies = false } = args;

  const cmd = ['holehe'];

  if (useFirefoxCookies) {
    cmd.push('--firefox');
  }

  cmd.push(String(email));

  return cmd;
}

/**
 * Parse holehe output to extract registered sites
 * Holehe output format:
 * [+] website.com
 *     - not registered
 *     - registered
 *     - email found ...
 *     - password found ...
 */
export function parseHoleheOutput(output: string): {
  registered: string[];
  notRegistered: string[];
  emailFound: string[];
  passwordFound: string[];
} {
  const registered: string[] = [];
  const notRegistered: string[] = [];
  const emailFound: string[] = [];
  const passwordFound: string[] = [];

  const lines = output.split('\n');

  let currentSite = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Site header
    const siteMatch = trimmed.match(/^\[+\]\s*(.+)$/);
    if (siteMatch) {
      currentSite = siteMatch[1].trim();
      continue;
    }

    // Status lines
    if (currentSite) {
      if (trimmed.includes('- not registered')) {
        notRegistered.push(currentSite);
        currentSite = '';
      } else if (trimmed.includes('- registered')) {
        registered.push(currentSite);
        currentSite = '';
      } else if (trimmed.includes('- email found')) {
        emailFound.push(currentSite);
        currentSite = '';
      } else if (trimmed.includes('- password found')) {
        passwordFound.push(currentSite);
        currentSite = '';
      } else if (trimmed.startsWith('-')) {
        // Other status - reset current site
        currentSite = '';
      }
    }
  }

  return {
    registered,
    notRegistered,
    emailFound,
    passwordFound
  };
}
