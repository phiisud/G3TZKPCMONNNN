/**
 * Continuous Security Monitor
 * Real-time file watching and automatic security auditing
 */
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityAuditEngine, AuditReport, AuditSeverity, SecurityFinding } from './audit-engine';

export interface Alert {
  id: string;
  type: 'security_finding' | 'audit_complete' | 'audit_failed' | 'file_change';
  severity: AuditSeverity;
  title: string;
  description: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface MonitorConfig {
  watchPaths: string[];
  ignorePatterns: string[];
  auditInterval: number; // milliseconds
  debounceDelay: number; // milliseconds
  alertThreshold: AuditSeverity;
  enableFileWatch: boolean;
}

const DEFAULT_CONFIG: MonitorConfig = {
  watchPaths: ['./packages', './src'],
  ignorePatterns: ['node_modules', '.git', 'dist', 'build', '*.log'],
  auditInterval: 5 * 60 * 1000, // 5 minutes
  debounceDelay: 1000, // 1 second
  alertThreshold: AuditSeverity.HIGH,
  enableFileWatch: true
};

export class ContinuousSecurityMonitor extends EventEmitter {
  private auditEngine: SecurityAuditEngine;
  private config: MonitorConfig;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private alertHandlers: ((alert: Alert) => void)[] = [];
  private lastAudit: AuditReport | null = null;
  private scheduledAuditTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingFiles: Set<string> = new Set();
  private isRunning: boolean = false;
  private auditHistory: AuditReport[] = [];
  private maxHistorySize = 100;

  constructor(config: Partial<MonitorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.auditEngine = new SecurityAuditEngine();
  }

  /**
   * Start continuous monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    await this.auditEngine.initialize();
    this.isRunning = true;

    // Run initial audit
    await this.runFullAudit();

    // Set up file watchers
    if (this.config.enableFileWatch) {
      this.setupFileWatchers();
    }

    // Schedule periodic audits
    this.scheduledAuditTimer = setInterval(
      () => this.runFullAudit(),
      this.config.auditInterval
    );

    this.emit('started', { timestamp: new Date() });
  }

  /**
   * Stop continuous monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    // Clear timers
    if (this.scheduledAuditTimer) {
      clearInterval(this.scheduledAuditTimer);
      this.scheduledAuditTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Close file watchers
    for (const [path, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();

    this.isRunning = false;
    this.emit('stopped', { timestamp: new Date() });
  }

  /**
   * Register an alert handler
   */
  onAlert(handler: (alert: Alert) => void): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Get the last audit report
   */
  getLastAudit(): AuditReport | null {
    return this.lastAudit;
  }

  /**
   * Get audit history
   */
  getAuditHistory(): AuditReport[] {
    return [...this.auditHistory];
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    lastAuditTime: Date | null;
    watchedPaths: string[];
    pendingFiles: number;
    totalAudits: number;
  } {
    return {
      isRunning: this.isRunning,
      lastAuditTime: this.lastAudit?.timestamp || null,
      watchedPaths: [...this.watchers.keys()],
      pendingFiles: this.pendingFiles.size,
      totalAudits: this.auditHistory.length
    };
  }

  /**
   * Trigger a manual audit
   */
  async triggerAudit(files?: string[]): Promise<AuditReport> {
    if (files) {
      return await this.runAudit(files);
    }
    return await this.runFullAudit();
  }

  /**
   * Set up file watchers for monitored paths
   */
  private setupFileWatchers(): void {
    for (const watchPath of this.config.watchPaths) {
      try {
        if (!fs.existsSync(watchPath)) continue;

        const watcher = fs.watch(
          watchPath,
          { recursive: true },
          (eventType, filename) => {
            if (filename && !this.shouldIgnore(filename)) {
              this.handleFileChange(path.join(watchPath, filename), eventType);
            }
          }
        );

        this.watchers.set(watchPath, watcher);
      } catch (error) {
        this.emit('error', { path: watchPath, error });
      }
    }
  }

  /**
   * Handle file change events
   */
  private handleFileChange(filePath: string, eventType: string): void {
    this.pendingFiles.add(filePath);

    // Debounce to avoid rapid re-auditing
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      const files = [...this.pendingFiles];
      this.pendingFiles.clear();

      if (files.length > 0) {
        this.sendAlert({
          id: `file-change-${Date.now()}`,
          type: 'file_change',
          severity: AuditSeverity.INFO,
          title: 'Files changed',
          description: `${files.length} file(s) changed, running audit`,
          timestamp: new Date(),
          metadata: { files, eventType }
        });

        await this.runAudit(files);
      }
    }, this.config.debounceDelay);
  }

  /**
   * Check if a file should be ignored
   */
  private shouldIgnore(filename: string): boolean {
    return this.config.ignorePatterns.some(pattern => {
      if (pattern.startsWith('*')) {
        return filename.endsWith(pattern.slice(1));
      }
      return filename.includes(pattern);
    });
  }

  /**
   * Run a full audit of all monitored paths
   */
  private async runFullAudit(): Promise<AuditReport> {
    const files = await this.collectFiles(this.config.watchPaths);
    return await this.runAudit(files);
  }

  /**
   * Run an audit on specific files
   */
  private async runAudit(files: string[]): Promise<AuditReport> {
    try {
      const report = await this.auditEngine.audit({ files });
      this.lastAudit = report;
      
      // Add to history
      this.auditHistory.push(report);
      if (this.auditHistory.length > this.maxHistorySize) {
        this.auditHistory.shift();
      }

      // Generate alerts for findings above threshold
      for (const finding of report.findings) {
        if (finding.severity >= this.config.alertThreshold) {
          this.sendAlert({
            id: `finding-${finding.id}`,
            type: 'security_finding',
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            timestamp: new Date(),
            metadata: { findingId: finding.id, category: finding.category, file: finding.location.file }
          });
        }
      }

      // Audit complete alert
      this.sendAlert({
        id: `audit-${report.id}`,
        type: 'audit_complete',
        severity: report.passed ? AuditSeverity.INFO : AuditSeverity.HIGH,
        title: 'Audit Complete',
        description: `Found ${report.summary.total} issues (${report.summary.critical} critical, ${report.summary.high} high)`,
        timestamp: new Date(),
        metadata: { reportId: report.id, summary: report.summary }
      });

      return report;
    } catch (error) {
      this.sendAlert({
        id: `audit-error-${Date.now()}`,
        type: 'audit_failed',
        severity: AuditSeverity.HIGH,
        title: 'Audit Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        metadata: { error }
      });
      throw error;
    }
  }

  /**
   * Collect files from paths
   */
  private async collectFiles(paths: string[]): Promise<string[]> {
    const files: string[] = [];

    const walkDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (this.shouldIgnore(entry.name)) continue;
          
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Directory access error - skip
      }
    };

    for (const p of paths) {
      if (fs.existsSync(p)) {
        const stat = await fs.promises.stat(p);
        if (stat.isDirectory()) {
          await walkDir(p);
        } else {
          files.push(p);
        }
      }
    }

    return files;
  }

  /**
   * Send an alert to all registered handlers
   */
  private sendAlert(alert: Alert): void {
    this.emit('alert', alert);
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        // Alert handler error - log and continue
      }
    }
  }
}
