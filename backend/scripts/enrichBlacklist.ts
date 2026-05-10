/**
 * Script to enrich IP blacklist data from AbuseIPDB
 * Run with: npx tsx scripts/enrichBlacklist.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;
const BATCH_SIZE = 50;
const DELAY_MS = 1100; // Rate limit: 1 request per second for AbuseIPDB free tier

interface AbuseIPDBResponse {
  ipAddress: string;
  isPublic: boolean;
  ipVersion: number;
  isWhitelisted: boolean;
  abuseConfidenceScore: number;
  countryCode: string;
  countryName: string;
  usageType: string;
  isp: string;
  domain: string;
  totalReports: number;
  lastReportedAt: string;
}

async function getAbuseIPDBDetails(ipAddress: string): Promise<AbuseIPDBResponse | null> {
  if (!ABUSEIPDB_API_KEY) {
    console.log('ABUSEIPDB_API_KEY not set - skipping enrichment');
    return null;
  }

  try {
    const url = new URL(`https://api.abuseipdb.com/api/v2/check`);
    url.searchParams.set('ipAddress', ipAddress);
    url.searchParams.set('maxAgeInDays', '90');

    const response = await fetch(url.toString(), {
      headers: {
        'Key': ABUSEIPDB_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log('Rate limited - waiting extra time...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return getAbuseIPDBDetails(ipAddress);
      }
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`Error fetching ${ipAddress}:`, (error as Error).message);
    return null;
  }
}

async function determineThreatLevel(abuseScore: number | null, totalReports: number): Promise<{ status: string; threatLevel: string }> {
  let maxScore = 0;

  if (abuseScore !== null) {
    maxScore = Math.max(maxScore, abuseScore);
  }

  if (totalReports > 0) {
    maxScore = Math.max(maxScore, Math.min(totalReports * 2, 50));
  }

  if (maxScore >= 75) {
    return { status: 'malicious', threatLevel: 'high' };
  } else if (maxScore >= 50) {
    return { status: 'suspicious', threatLevel: 'medium' };
  } else if (maxScore >= 25) {
    return { status: 'suspicious', threatLevel: 'low' };
  } else {
    return { status: 'normal', threatLevel: 'none' };
  }
}

async function enrichBlacklist() {
  console.log('Starting blacklist enrichment...\n');

  // Get all IPs that are missing countryName
  const incompleteIPs = await prisma.ipReputation.findMany({
    where: {
      countryName: null
    },
    select: {
      ipAddress: true,
      status: true,
      totalReports: true
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  console.log(`Found ${incompleteIPs.length} IPs missing country information\n`);

  if (!ABUSEIPDB_API_KEY) {
    console.log('WARNING: ABUSEIPDB_API_KEY not set in environment');
    console.log('Enrichment cannot proceed without API key');
    console.log('Please set the environment variable and try again');
    await prisma.$disconnect();
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < incompleteIPs.length; i++) {
    const ip = incompleteIPs[i];

    // Get details from AbuseIPDB
    const abuseData = await getAbuseIPDBDetails(ip.ipAddress);

    if (abuseData) {
      // Build sources update
      const currentSources = []; // We would need to fetch this, for now just add AbuseIPDB

      const updateData: any = {
        countryCode: abuseData.countryCode,
        countryName: abuseData.countryName,
        isp: abuseData.isp,
        domain: abuseData.domain,
        usageType: abuseData.usageType,
        totalReports: abuseData.totalReports,
        isWhitelisted: abuseData.isWhitelisted,
        lastReportedAt: abuseData.lastReportedAt ? new Date(abuseData.lastReportedAt) : null,
      };

      // Update threat level based on new data
      if (abuseData.abuseConfidenceScore !== null) {
        const { status, threatLevel } = determineThreatLevel(abuseData.abuseConfidenceScore, abuseData.totalReports);
        updateData.status = status;
        updateData.threatLevel = threatLevel;
        updateData.confidenceScore = abuseData.abuseConfidenceScore;
      }

      // Add AbuseIPDB to sources
      updateData.sources = {
        name: 'AbuseIPDB',
        confidenceScore: abuseData.abuseConfidenceScore,
        totalReports: abuseData.totalReports,
        lastReported: abuseData.lastReportedAt
      };

      try {
        await prisma.ipReputation.update({
          where: { ipAddress: ip.ipAddress },
          data: updateData
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Error updating ${ip.ipAddress}:`, (error as Error).message);
      }
    } else {
      errorCount++;
    }

    // Progress report every BATCH_SIZE IPs
    if ((i + 1) % BATCH_SIZE === 0 || i === incompleteIPs.length - 1) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = Math.round(successCount / elapsed * 60);
      console.log(`Progress: ${i + 1}/${incompleteIPs.length} | Success: ${successCount} | Errors: ${errorCount} | Rate: ${rate}/min`);
    }

    // Rate limiting delay
    if (i < incompleteIPs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n=== Enrichment Complete ===');
  console.log(`Total processed: ${incompleteIPs.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total time: ${Math.round((Date.now() - startTime) / 1000 / 60)} minutes`);

  await prisma.$disconnect();
}

enrichBlacklist().catch(console.error);
