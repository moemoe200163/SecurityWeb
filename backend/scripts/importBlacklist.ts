/**
 * Script to import IP blacklist from IPsum feed
 * Run with: npx tsx scripts/importBlacklist.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;

async function getAbuseIPDBDetails(ipAddress: string): Promise<any> {
  try {
    const url = new URL(`https://api.abuseipdb.com/api/v2/check`);
    url.searchParams.set('ipAddress', ipAddress);
    url.searchParams.set('maxAgeInDays', '90');

    const response = await fetch(url.toString(), {
      headers: {
        'Key': ABUSEIPDB_API_KEY!,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    return null;
  }
}

async function importBlacklist() {
  console.log('Fetching IPsum blacklist...');

  const response = await fetch('https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt');
  const text = await response.text();

  const lines = text.split('\n');
  let importedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || !line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const ipAddress = parts[0].trim();
    const listCount = parseInt(parts[1], 10);

    // Only import IPs that appear in 5+ blacklists (higher confidence)
    if (listCount < 5) continue;

    try {
      // Check if already exists
      const existing = await prisma.ipReputation.findUnique({
        where: { ipAddress }
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      // Get additional details from AbuseIPDB (with rate limiting)
      const abuseData = await getAbuseIPDBDetails(ipAddress);

      // Calculate threat level based on list count
      let threatLevel = 'low';
      let status = 'suspicious';
      if (listCount >= 8) {
        threatLevel = 'high';
        status = 'malicious';
      } else if (listCount >= 6) {
        threatLevel = 'medium';
        status = 'suspicious';
      }

      // Upsert the IP
      await prisma.ipReputation.upsert({
        where: { ipAddress },
        create: {
          ipAddress,
          status,
          threatLevel,
          confidenceScore: abuseData?.abuseConfidenceScore ?? null,
          countryCode: abuseData?.countryCode || null,
          countryName: abuseData?.countryName || null,
          isp: abuseData?.isp || null,
          domain: abuseData?.domain || null,
          usageType: abuseData?.usageType || null,
          totalReports: abuseData?.totalReports || listCount,
          isWhitelisted: abuseData?.isWhitelisted || false,
          sources: [{ name: 'IPsum', listCount }],
        },
        update: {
          status,
          threatLevel,
          totalReports: listCount,
        }
      });

      importedCount++;
      if (importedCount % 50 === 0) {
        console.log(`Imported ${importedCount} IPs...`);
      }

      // Rate limiting - delay between API calls
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      errorCount++;
      console.error(`Error importing ${ipAddress}:`, (error as Error).message);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Imported: ${importedCount}`);
  console.log(`Skipped (existing): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  await prisma.$disconnect();
}

importBlacklist().catch(console.error);
