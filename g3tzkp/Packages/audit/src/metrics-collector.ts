/**
 * Security Metrics Collector
 * Collects and exports security metrics in Prometheus format
 */

export interface SecurityMetrics {
  timestamp: Date;
  auditsPassed: number;
  auditsFailed: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  averageAuditDuration: number;
  proofGenerationTime: number;
  proofVerificationTime: number;
  activeConnections: number;
  failedAuthentications: number;
  successfulAuthentications: number;
  messagesEncrypted: number;
  messagesDecrypted: number;
  keysRotated: number;
  sessionsEstablished: number;
}

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
}

const DEFAULT_METRICS: SecurityMetrics = {
  timestamp: new Date(),
  auditsPassed: 0,
  auditsFailed: 0,
  criticalFindings: 0,
  highFindings: 0,
  mediumFindings: 0,
  lowFindings: 0,
  averageAuditDuration: 0,
  proofGenerationTime: 0,
  proofVerificationTime: 0,
  activeConnections: 0,
  failedAuthentications: 0,
  successfulAuthentications: 0,
  messagesEncrypted: 0,
  messagesDecrypted: 0,
  keysRotated: 0,
  sessionsEstablished: 0
};

export class MetricsCollector {
  private metrics: SecurityMetrics[] = [];
  private maxRetention: number;
  private customMetrics: Map<string, MetricPoint[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  constructor(maxRetention: number = 1000) {
    this.maxRetention = maxRetention;
  }

  /**
   * Record a new metrics snapshot
   */
  record(metrics: Partial<SecurityMetrics>): void {
    const fullMetrics: SecurityMetrics = {
      ...DEFAULT_METRICS,
      timestamp: new Date(),
      ...metrics
    };

    this.metrics.push(fullMetrics);

    // Enforce retention limit
    if (this.metrics.length > this.maxRetention) {
      this.metrics = this.metrics.slice(-this.maxRetention);
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    
    // Keep last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
    
    this.histograms.set(name, values);
  }

  /**
   * Get recent metrics
   */
  getRecent(count: number = 100): SecurityMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get latest metrics snapshot
   */
  getLatest(): SecurityMetrics | undefined {
    return this.metrics[this.metrics.length - 1];
  }

  /**
   * Calculate averages over a time period
   */
  getAverages(durationMs: number = 3600000): Partial<SecurityMetrics> {
    const cutoff = Date.now() - durationMs;
    const recent = this.metrics.filter(m => m.timestamp.getTime() > cutoff);
    
    if (recent.length === 0) return {};

    return {
      criticalFindings: this.avg(recent, 'criticalFindings'),
      highFindings: this.avg(recent, 'highFindings'),
      mediumFindings: this.avg(recent, 'mediumFindings'),
      lowFindings: this.avg(recent, 'lowFindings'),
      averageAuditDuration: this.avg(recent, 'averageAuditDuration'),
      proofGenerationTime: this.avg(recent, 'proofGenerationTime'),
      proofVerificationTime: this.avg(recent, 'proofVerificationTime'),
      activeConnections: this.avg(recent, 'activeConnections')
    };
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string): {
    count: number;
    min: number;
    max: number;
    mean: number;
    p50: number;
    p90: number;
    p99: number;
  } | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      mean: sorted.reduce((a, b) => a + b, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p90: sorted[Math.floor(count * 0.9)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const latest = this.getLatest();
    if (!latest) return '';

    const lines: string[] = [
      '# HELP g3zkp_audits_passed Number of passed security audits',
      '# TYPE g3zkp_audits_passed counter',
      `g3zkp_audits_passed ${latest.auditsPassed}`,
      '',
      '# HELP g3zkp_audits_failed Number of failed security audits',
      '# TYPE g3zkp_audits_failed counter',
      `g3zkp_audits_failed ${latest.auditsFailed}`,
      '',
      '# HELP g3zkp_findings Security findings by severity',
      '# TYPE g3zkp_findings gauge',
      `g3zkp_findings{severity="critical"} ${latest.criticalFindings}`,
      `g3zkp_findings{severity="high"} ${latest.highFindings}`,
      `g3zkp_findings{severity="medium"} ${latest.mediumFindings}`,
      `g3zkp_findings{severity="low"} ${latest.lowFindings}`,
      '',
      '# HELP g3zkp_audit_duration_seconds Audit duration in seconds',
      '# TYPE g3zkp_audit_duration_seconds gauge',
      `g3zkp_audit_duration_seconds ${latest.averageAuditDuration / 1000}`,
      '',
      '# HELP g3zkp_proof_generation_seconds ZKP proof generation time in seconds',
      '# TYPE g3zkp_proof_generation_seconds gauge',
      `g3zkp_proof_generation_seconds ${latest.proofGenerationTime / 1000}`,
      '',
      '# HELP g3zkp_proof_verification_seconds ZKP proof verification time in seconds',
      '# TYPE g3zkp_proof_verification_seconds gauge',
      `g3zkp_proof_verification_seconds ${latest.proofVerificationTime / 1000}`,
      '',
      '# HELP g3zkp_active_connections Number of active P2P connections',
      '# TYPE g3zkp_active_connections gauge',
      `g3zkp_active_connections ${latest.activeConnections}`,
      '',
      '# HELP g3zkp_authentications Authentication attempts',
      '# TYPE g3zkp_authentications counter',
      `g3zkp_authentications{result="success"} ${latest.successfulAuthentications}`,
      `g3zkp_authentications{result="failure"} ${latest.failedAuthentications}`,
      '',
      '# HELP g3zkp_messages_total Messages processed',
      '# TYPE g3zkp_messages_total counter',
      `g3zkp_messages_total{operation="encrypt"} ${latest.messagesEncrypted}`,
      `g3zkp_messages_total{operation="decrypt"} ${latest.messagesDecrypted}`,
      '',
      '# HELP g3zkp_keys_rotated Total key rotations',
      '# TYPE g3zkp_keys_rotated counter',
      `g3zkp_keys_rotated ${latest.keysRotated}`,
      '',
      '# HELP g3zkp_sessions_established Total sessions established',
      '# TYPE g3zkp_sessions_established counter',
      `g3zkp_sessions_established ${latest.sessionsEstablished}`
    ];

    // Add custom counters
    for (const [name, value] of this.counters) {
      lines.push('');
      lines.push(`# HELP ${name} Custom counter`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    // Add custom gauges
    for (const [name, value] of this.gauges) {
      lines.push('');
      lines.push(`# HELP ${name} Custom gauge`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    // Add histogram summaries
    for (const [name, values] of this.histograms) {
      const stats = this.getHistogramStats(name);
      if (stats) {
        lines.push('');
        lines.push(`# HELP ${name} Custom histogram`);
        lines.push(`# TYPE ${name} histogram`);
        lines.push(`${name}_count ${stats.count}`);
        lines.push(`${name}_sum ${values.reduce((a, b) => a + b, 0)}`);
        lines.push(`${name}{quantile="0.5"} ${stats.p50}`);
        lines.push(`${name}{quantile="0.9"} ${stats.p90}`);
        lines.push(`${name}{quantile="0.99"} ${stats.p99}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    return JSON.stringify({
      latest: this.getLatest(),
      averages: this.getAverages(),
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        [...this.histograms.entries()].map(([k, v]) => [k, this.getHistogramStats(k)])
      ),
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.customMetrics.clear();
  }

  /**
   * Helper to calculate average of a numeric field
   */
  private avg(arr: SecurityMetrics[], key: keyof SecurityMetrics): number {
    const values = arr.map(m => m[key] as number);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}
