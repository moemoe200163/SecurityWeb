import { describe, it, expect } from 'vitest';

// --- Pure function tests (mirrors computeComparison in dashboard.ts) ---

interface PeriodMetrics {
  incidents: number;
  successfulResolutions: number;
  failedResolutions: number;
  resolutionRate: number;
}

interface MetricDelta {
  delta: number;
  deltaPercent: number | null;
}

/**
 * Mirror of computeComparison from backend/src/routes/dashboard.ts.
 * Kept inline so pure logic can be unit-tested without importing
 * the Fastify route handler (which depends on Prisma, middleware, etc.).
 */
function computeComparison(
  current: PeriodMetrics,
  previous: PeriodMetrics,
): Record<string, MetricDelta> {
  const fields = ['incidents', 'successfulResolutions', 'failedResolutions', 'resolutionRate'] as const;
  const result: Record<string, MetricDelta> = {};
  for (const field of fields) {
    const delta = current[field] - previous[field];
    const deltaPercent = previous[field] !== 0
      ? Math.round(((current[field] - previous[field]) / previous[field]) * 100)
      : null;
    result[field] = { delta, deltaPercent };
  }
  return result;
}

// ---------------------------------------------------------------------------
// computeComparison
// ---------------------------------------------------------------------------

describe('computeComparison', () => {
  const base: PeriodMetrics = {
    incidents: 100,
    successfulResolutions: 60,
    failedResolutions: 10,
    resolutionRate: 60,
  };

  it('returns correct delta and deltaPercent for normal values', () => {
    const previous: PeriodMetrics = {
      incidents: 80,
      successfulResolutions: 50,
      failedResolutions: 5,
      resolutionRate: 62,
    };
    const result = computeComparison(base, previous);

    expect(result.incidents.delta).toBe(20);
    expect(result.incidents.deltaPercent).toBe(25); // (100-80)/80 * 100 = 25

    expect(result.successfulResolutions.delta).toBe(10);
    expect(result.successfulResolutions.deltaPercent).toBe(20); // (60-50)/50 * 100 = 20

    expect(result.failedResolutions.delta).toBe(5);
    expect(result.failedResolutions.deltaPercent).toBe(100); // (10-5)/5 * 100 = 100

    expect(result.resolutionRate.delta).toBe(-2);
    expect(result.resolutionRate.deltaPercent).toBe(-3); // (60-62)/62 * 100 = -3
  });

  it('returns deltaPercent null when baseline is 0', () => {
    const previous: PeriodMetrics = {
      incidents: 0,
      successfulResolutions: 0,
      failedResolutions: 0,
      resolutionRate: 0,
    };
    const result = computeComparison(base, previous);

    expect(result.incidents.delta).toBe(100);
    expect(result.incidents.deltaPercent).toBeNull();

    expect(result.successfulResolutions.delta).toBe(60);
    expect(result.successfulResolutions.deltaPercent).toBeNull();

    expect(result.failedResolutions.delta).toBe(10);
    expect(result.failedResolutions.deltaPercent).toBeNull();

    expect(result.resolutionRate.delta).toBe(60);
    expect(result.resolutionRate.deltaPercent).toBeNull();
  });

  it('returns zero deltas when periods are identical', () => {
    const result = computeComparison(base, base);

    expect(result.incidents.delta).toBe(0);
    expect(result.incidents.deltaPercent).toBe(0);
    expect(result.successfulResolutions.delta).toBe(0);
    expect(result.successfulResolutions.deltaPercent).toBe(0);
    expect(result.failedResolutions.delta).toBe(0);
    expect(result.failedResolutions.deltaPercent).toBe(0);
    expect(result.resolutionRate.delta).toBe(0);
    expect(result.resolutionRate.deltaPercent).toBe(0);
  });

  it('returns negative delta for decrease', () => {
    const previous: PeriodMetrics = {
      incidents: 120,
      successfulResolutions: 70,
      failedResolutions: 15,
      resolutionRate: 58,
    };
    const result = computeComparison(base, previous);

    expect(result.incidents.delta).toBe(-20);
    expect(result.incidents.deltaPercent).toBe(-17); // (100-120)/120 * 100 = -17
  });

  it('handles large values correctly', () => {
    const current: PeriodMetrics = {
      incidents: 10000,
      successfulResolutions: 8000,
      failedResolutions: 500,
      resolutionRate: 80,
    };
    const previous: PeriodMetrics = {
      incidents: 5000,
      successfulResolutions: 3000,
      failedResolutions: 200,
      resolutionRate: 60,
    };
    const result = computeComparison(current, previous);

    expect(result.incidents.delta).toBe(5000);
    expect(result.incidents.deltaPercent).toBe(100); // (10000-5000)/5000 * 100

    expect(result.resolutionRate.delta).toBe(20);
    expect(result.resolutionRate.deltaPercent).toBe(33); // (80-60)/60 * 100 = 33
  });
});

// ---------------------------------------------------------------------------
// Analysis status semantics (mirrors the SQL FILTER logic)
// ---------------------------------------------------------------------------

describe('Analysis status semantics', () => {
  // These verify the conceptual logic behind the SQL FILTER clauses:
  //   COUNT(*) FILTER (WHERE "status" NOT IN ('false_positive'))
  //   COUNT(*) FILTER (WHERE "status" = 'resolved')
  //   COUNT(*) FILTER (WHERE "status" = 'failed_resolution')

  it('false_positive is excluded from incidents count', () => {
    const statuses = [
      'new',
      'investigating',
      'resolved',
      'ignored',
      'false_positive',
      'failed_resolution',
    ];
    const incidentStatuses = statuses.filter((s) => s !== 'false_positive');

    expect(incidentStatuses).not.toContain('false_positive');
    expect(incidentStatuses).toContain('new');
    expect(incidentStatuses).toContain('resolved');
    expect(incidentStatuses).toContain('failed_resolution');
    expect(incidentStatuses).toContain('ignored');
    expect(incidentStatuses).toContain('investigating');
  });

  it('resolved counts as successful resolution', () => {
    const statuses = ['new', 'investigating', 'resolved', 'ignored', 'false_positive'];
    const successful = statuses.filter((s) => s === 'resolved');

    expect(successful).toEqual(['resolved']);
    expect(successful).toHaveLength(1);
  });

  it('failed_resolution counts as failed resolution', () => {
    const statuses = ['new', 'investigating', 'resolved', 'ignored', 'failed_resolution'];
    const failed = statuses.filter((s) => s === 'failed_resolution');

    expect(failed).toEqual(['failed_resolution']);
    expect(failed).toHaveLength(1);
  });

  it('ignored is not counted as success or failure', () => {
    // ignored is neither 'resolved' nor 'failed_resolution'
    expect('ignored').not.toBe('resolved');
    expect('ignored').not.toBe('failed_resolution');
    // But it IS an incident (not false_positive)
    expect('ignored').not.toBe('false_positive');
  });

  it('new alerts count as incidents but not resolutions', () => {
    const statuses = ['new', 'new', 'new'];
    const incidents = statuses.filter((s) => s !== 'false_positive');
    const successful = statuses.filter((s) => s === 'resolved');
    const failed = statuses.filter((s) => s === 'failed_resolution');

    expect(incidents).toHaveLength(3);
    expect(successful).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  it('mixed statuses are counted correctly', () => {
    const statuses = [
      'new',
      'new',
      'investigating',
      'resolved',
      'resolved',
      'resolved',
      'failed_resolution',
      'ignored',
      'false_positive',
    ];

    const incidents = statuses.filter((s) => s !== 'false_positive');
    const successful = statuses.filter((s) => s === 'resolved');
    const failed = statuses.filter((s) => s === 'failed_resolution');

    expect(incidents).toHaveLength(8);
    expect(successful).toHaveLength(3);
    expect(failed).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// resolutionRate calculation
// ---------------------------------------------------------------------------

describe('resolutionRate calculation', () => {
  it('computes rate as successfulResolutions / incidents * 100', () => {
    const incidents = 100;
    const successfulResolutions = 60;
    const rate =
      incidents > 0 ? Math.round((successfulResolutions / incidents) * 100) : 0;

    expect(rate).toBe(60);
  });

  it('returns 0 when no incidents', () => {
    const incidents = 0;
    const successfulResolutions = 0;
    const rate =
      incidents > 0 ? Math.round((successfulResolutions / incidents) * 100) : 0;

    expect(rate).toBe(0);
  });

  it('rounds to nearest integer', () => {
    const incidents = 3;
    const successfulResolutions = 1;
    const rate =
      incidents > 0 ? Math.round((successfulResolutions / incidents) * 100) : 0;

    expect(rate).toBe(33); // 33.33... rounds to 33
  });

  it('returns 100 when all incidents are resolved', () => {
    const incidents = 50;
    const successfulResolutions = 50;
    const rate =
      incidents > 0 ? Math.round((successfulResolutions / incidents) * 100) : 0;

    expect(rate).toBe(100);
  });

  it('returns 0 when no incidents are resolved', () => {
    const incidents = 50;
    const successfulResolutions = 0;
    const rate =
      incidents > 0 ? Math.round((successfulResolutions / incidents) * 100) : 0;

    expect(rate).toBe(0);
  });

  it('handles 1 of 3 resolved as 33%', () => {
    const incidents = 3;
    const successfulResolutions = 1;
    const rate =
      incidents > 0 ? Math.round((successfulResolutions / incidents) * 100) : 0;

    expect(rate).toBe(33);
  });

  it('handles 2 of 3 resolved as 67%', () => {
    const incidents = 3;
    const successfulResolutions = 2;
    const rate =
      incidents > 0 ? Math.round((successfulResolutions / incidents) * 100) : 0;

    expect(rate).toBe(67);
  });
});

// ---------------------------------------------------------------------------
// buildPeriod helper (mirrors logic in dashboard.ts)
// ---------------------------------------------------------------------------

describe('buildPeriod', () => {
  type BucketData = { incidents: number; successfulResolutions: number; failedResolutions: number };

  function buildPeriod(bucketMap: Map<string, BucketData>, key: string): PeriodMetrics {
    const data = bucketMap.get(key) ?? { incidents: 0, successfulResolutions: 0, failedResolutions: 0 };
    return {
      ...data,
      resolutionRate:
        data.incidents > 0
          ? Math.round((data.successfulResolutions / data.incidents) * 100)
          : 0,
    };
  }

  it('returns zero metrics when bucket is missing', () => {
    const map = new Map<string, BucketData>();
    const result = buildPeriod(map, 'current_month');

    expect(result.incidents).toBe(0);
    expect(result.successfulResolutions).toBe(0);
    expect(result.failedResolutions).toBe(0);
    expect(result.resolutionRate).toBe(0);
  });

  it('returns correct metrics when bucket exists', () => {
    const map = new Map<string, BucketData>([
      ['current_month', { incidents: 20, successfulResolutions: 15, failedResolutions: 2 }],
    ]);
    const result = buildPeriod(map, 'current_month');

    expect(result.incidents).toBe(20);
    expect(result.successfulResolutions).toBe(15);
    expect(result.failedResolutions).toBe(2);
    expect(result.resolutionRate).toBe(75); // 15/20 * 100
  });

  it('returns 0 resolutionRate when bucket has 0 incidents', () => {
    const map = new Map<string, BucketData>([
      ['previous_month', { incidents: 0, successfulResolutions: 0, failedResolutions: 0 }],
    ]);
    const result = buildPeriod(map, 'previous_month');

    expect(result.resolutionRate).toBe(0);
  });

  it('rounds resolutionRate correctly', () => {
    const map = new Map<string, BucketData>([
      ['current_year', { incidents: 7, successfulResolutions: 3, failedResolutions: 1 }],
    ]);
    const result = buildPeriod(map, 'current_year');

    // 3/7 * 100 = 42.857... -> 43
    expect(result.resolutionRate).toBe(43);
  });
});
