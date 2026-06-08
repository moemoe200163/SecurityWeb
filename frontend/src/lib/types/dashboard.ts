export interface MetricPeriod {
  incidents: number;
  successfulResolutions: number;
  failedResolutions: number;
  resolutionRate: number;
}

export interface MetricDelta {
  delta: number;
  deltaPercent: number | null;
}

export interface AnalysisMetrics {
  month: {
    current: MetricPeriod;
    previous: MetricPeriod;
    sameMonthLastYear: MetricPeriod;
  };
  year: {
    current: MetricPeriod;
    previous: MetricPeriod;
  };
  comparison: {
    monthOverMonth: {
      incidents: MetricDelta;
      successfulResolutions: MetricDelta;
      failedResolutions: MetricDelta;
      resolutionRate: MetricDelta;
    };
    yearOverYear: {
      incidents: MetricDelta;
      successfulResolutions: MetricDelta;
      failedResolutions: MetricDelta;
      resolutionRate: MetricDelta;
    };
    yearToYear: {
      incidents: MetricDelta;
      successfulResolutions: MetricDelta;
      failedResolutions: MetricDelta;
      resolutionRate: MetricDelta;
    };
  };
}

export interface DashboardStatsResponse {
  metrics: {
    alerts: Record<string, unknown>;
    tools: Record<string, unknown>;
    feedback: Record<string, unknown>;
    analysis?: AnalysisMetrics;
  };
  recentExecutions?: unknown[];
  recentAlerts?: unknown[];
}
