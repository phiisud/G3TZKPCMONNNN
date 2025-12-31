/**
 * Security Audit Engine
 * Comprehensive security auditing for ZKP, cryptography, and network components
 */
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export enum AuditSeverity {
  INFO = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum AuditCategory {
  ZKP = 'zkp',
  ENCRYPTION = 'encryption',
  NETWORK = 'network',
  IDENTITY = 'identity',
  PROTOCOL = 'protocol',
  STORAGE = 'storage'
}

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: AuditSeverity;
  category: AuditCategory;
  location: { file: string; line: number; column: number };
  evidence: { codeSnippet: string; context: string; proof: string };
  impact: { confidentiality: number; integrity: number; availability: number; score: number };
  remediation: { steps: string[]; difficulty: string; priority: number; references: string[] };
  metadata: { discoveredAt: Date; status: string; tags: string[] };
}

export interface AuditReport {
  id: string;
  timestamp: Date;
  duration: number;
  findings: SecurityFinding[];
  summary: { total: number; critical: number; high: number; medium: number; low: number; info: number };
  passed: boolean;
  scope: string[];
}

interface AuditEvents {
  'finding': SecurityFinding;
  'complete': AuditReport;
  'error': Error;
  'progress': { stage: string; percentage: number };
}

export interface Auditor {
  name: string;
  audit(scope: { files: string[] }): Promise<SecurityFinding[]>;
}

export class SecurityAuditEngine extends EventEmitter {
  private auditors: Map<string, Auditor> = new Map();
  private initialized: boolean = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register default auditors
    this.auditors.set('zkp', new ZKPAuditor());
    this.auditors.set('crypto', new CryptoAuditor());
    this.auditors.set('network', new NetworkAuditor());
    this.auditors.set('storage', new StorageAuditor());

    this.initialized = true;
  }

  registerAuditor(name: string, auditor: Auditor): void {
    this.auditors.set(name, auditor);
  }

  async audit(scope: { files: string[] }): Promise<AuditReport> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const findings: SecurityFinding[] = [];
    const auditorCount = this.auditors.size;
    let completed = 0;

    for (const [name, auditor] of this.auditors) {
      try {
        this.emit('progress', { 
          stage: `Running ${name} auditor`, 
          percentage: Math.round((completed / auditorCount) * 100) 
        });

        const results = await auditor.audit(scope);
        for (const finding of results) {
          findings.push(finding);
          this.emit('finding', finding);
        }
        completed++;
      } catch (error) {
        this.emit('error', error as Error);
      }
    }

    const report: AuditReport = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      findings,
      summary: {
        total: findings.length,
        critical: findings.filter(f => f.severity === AuditSeverity.CRITICAL).length,
        high: findings.filter(f => f.severity === AuditSeverity.HIGH).length,
        medium: findings.filter(f => f.severity === AuditSeverity.MEDIUM).length,
        low: findings.filter(f => f.severity === AuditSeverity.LOW).length,
        info: findings.filter(f => f.severity === AuditSeverity.INFO).length
      },
      passed: findings.filter(f => f.severity >= AuditSeverity.HIGH).length === 0,
      scope: scope.files
    };

    this.emit('complete', report);
    return report;
  }

  getAuditors(): string[] {
    return [...this.auditors.keys()];
  }
}

/**
 * ZKP Auditor - Checks for ZKP circuit vulnerabilities
 */
class ZKPAuditor implements Auditor {
  name = 'ZKP Auditor';

  async audit(scope: { files: string[] }): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const circomFiles = scope.files.filter(f => f.endsWith('.circom'));

    for (const file of circomFiles) {
      try {
        const content = await this.readFile(file);
        
        // Check for under-constrained signals
        if (this.hasUnderConstrainedSignals(content)) {
          findings.push(this.createFinding(
            'Under-constrained signals detected',
            'Circuit contains signals that may not be fully constrained, allowing malicious proofs',
            AuditSeverity.CRITICAL,
            AuditCategory.ZKP,
            file,
            { steps: ['Add explicit constraints for all signals', 'Use IsZero or IsEqual for boolean checks'], difficulty: 'high', priority: 1, references: ['https://www.rareskills.io/post/circom-tutorial'] }
          ));
        }

        // Check for missing range checks
        if (this.missingRangeChecks(content)) {
          findings.push(this.createFinding(
            'Missing range checks in arithmetic operations',
            'Arithmetic operations may overflow or underflow without proper range constraints',
            AuditSeverity.HIGH,
            AuditCategory.ZKP,
            file,
            { steps: ['Add Num2Bits range checks', 'Use LessThan for comparisons'], difficulty: 'medium', priority: 2, references: ['https://docs.circom.io/circom-language/signals/'] }
          ));
        }

        // Check for unchecked division
        if (content.includes('/') && !content.includes('IsZero')) {
          findings.push(this.createFinding(
            'Unchecked division operation',
            'Division without zero-check may lead to undefined behavior',
            AuditSeverity.MEDIUM,
            AuditCategory.ZKP,
            file,
            { steps: ['Add IsZero check before division', 'Handle zero divisor case'], difficulty: 'low', priority: 3, references: [] }
          ));
        }

        // Check for quadratic constraint optimization
        const constraintCount = (content.match(/===|<==|==>|<==/g) || []).length;
        if (constraintCount > 10000) {
          findings.push(this.createFinding(
            'High constraint count detected',
            `Circuit has ${constraintCount} constraints, which may impact proof generation performance`,
            AuditSeverity.LOW,
            AuditCategory.ZKP,
            file,
            { steps: ['Consider circuit optimization', 'Use more efficient algorithms'], difficulty: 'high', priority: 4, references: [] }
          ));
        }

      } catch (error) {
        // File read error - skip
      }
    }

    return findings;
  }

  private hasUnderConstrainedSignals(content: string): boolean {
    const signalDeclarations = content.match(/signal\s+(input|output)?\s+\w+/g) || [];
    const constraints = content.match(/===|<==|==>/g) || [];
    // Heuristic: if signals significantly outnumber constraints
    return signalDeclarations.length > constraints.length * 2 + 5;
  }

  private missingRangeChecks(content: string): boolean {
    const hasArithmetic = content.includes('*') || content.includes('+') || content.includes('-');
    const hasRangeChecks = content.includes('LessThan') || content.includes('Num2Bits') || content.includes('RangeProof');
    return hasArithmetic && !hasRangeChecks;
  }

  private async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  private createFinding(
    title: string,
    description: string,
    severity: AuditSeverity,
    category: AuditCategory,
    file: string,
    remediation: { steps: string[]; difficulty: string; priority: number; references: string[] }
  ): SecurityFinding {
    return {
      id: `zkp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      severity,
      category,
      location: { file, line: 0, column: 0 },
      evidence: { codeSnippet: '', context: '', proof: '' },
      impact: { 
        confidentiality: severity >= AuditSeverity.HIGH ? 8 : 4, 
        integrity: severity >= AuditSeverity.HIGH ? 9 : 5, 
        availability: 2, 
        score: severity * 20 
      },
      remediation,
      metadata: { discoveredAt: new Date(), status: 'open', tags: ['zkp', 'circuit'] }
    };
  }
}

/**
 * Crypto Auditor - Checks for cryptographic vulnerabilities
 */
class CryptoAuditor implements Auditor {
  name = 'Crypto Auditor';

  async audit(scope: { files: string[] }): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const codeFiles = scope.files.filter(f => 
      f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.jsx')
    );

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Check for insecure random
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('Math.random')) {
            findings.push({
              id: `crypto-random-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: 'Insecure Random Number Generator',
              description: 'Math.random() is not cryptographically secure and should not be used for security-sensitive operations',
              severity: AuditSeverity.CRITICAL,
              category: AuditCategory.ENCRYPTION,
              location: { file, line: i + 1, column: lines[i].indexOf('Math.random') },
              evidence: { codeSnippet: lines[i].trim(), context: 'Random number generation', proof: '' },
              impact: { confidentiality: 10, integrity: 8, availability: 1, score: 95 },
              remediation: {
                steps: ['Use crypto.randomBytes() in Node.js', 'Use crypto.getRandomValues() in browsers', 'Use tweetnacl.randomBytes()'],
                difficulty: 'low',
                priority: 1,
                references: ['https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues']
              },
              metadata: { discoveredAt: new Date(), status: 'open', tags: ['crypto', 'random'] }
            });
          }
        }

        // Check for hardcoded secrets
        const secretPatterns = [
          /api[_-]?key\s*[:=]\s*['"`][^'"`]+['"`]/gi,
          /secret\s*[:=]\s*['"`][^'"`]+['"`]/gi,
          /password\s*[:=]\s*['"`][^'"`]+['"`]/gi,
          /private[_-]?key\s*[:=]\s*['"`][^'"`]+['"`]/gi
        ];

        for (const pattern of secretPatterns) {
          const match = content.match(pattern);
          if (match) {
            findings.push({
              id: `crypto-secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: 'Hardcoded Secret Detected',
              description: 'Hardcoded secrets should be stored in environment variables or secure vaults',
              severity: AuditSeverity.HIGH,
              category: AuditCategory.ENCRYPTION,
              location: { file, line: 0, column: 0 },
              evidence: { codeSnippet: '[REDACTED]', context: 'Secret storage', proof: '' },
              impact: { confidentiality: 10, integrity: 5, availability: 1, score: 85 },
              remediation: {
                steps: ['Move secrets to environment variables', 'Use a secrets manager', 'Rotate compromised secrets'],
                difficulty: 'low',
                priority: 1,
                references: []
              },
              metadata: { discoveredAt: new Date(), status: 'open', tags: ['crypto', 'secrets'] }
            });
            break; // Only report once per file
          }
        }

        // Check for weak encryption
        if (content.includes('DES') || content.includes('MD5') || content.includes('SHA1')) {
          findings.push({
            id: `crypto-weak-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: 'Weak Cryptographic Algorithm',
            description: 'DES, MD5, and SHA1 are considered weak and should be replaced with stronger alternatives',
            severity: AuditSeverity.HIGH,
            category: AuditCategory.ENCRYPTION,
            location: { file, line: 0, column: 0 },
            evidence: { codeSnippet: '', context: 'Weak algorithm usage', proof: '' },
            impact: { confidentiality: 8, integrity: 8, availability: 1, score: 80 },
            remediation: {
              steps: ['Replace DES with AES-256', 'Replace MD5/SHA1 with SHA-256 or SHA-3', 'Use NaCl/libsodium for encryption'],
              difficulty: 'medium',
              priority: 2,
              references: []
            },
            metadata: { discoveredAt: new Date(), status: 'open', tags: ['crypto', 'algorithm'] }
          });
        }

      } catch (error) {
        // File read error - skip
      }
    }

    return findings;
  }
}

/**
 * Network Auditor - Checks for network security vulnerabilities
 */
class NetworkAuditor implements Auditor {
  name = 'Network Auditor';

  async audit(scope: { files: string[] }): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const codeFiles = scope.files.filter(f => 
      f.endsWith('.ts') || f.endsWith('.js')
    );

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        // Check for HTTP instead of HTTPS
        if (content.includes("http://") && !content.includes("localhost") && !content.includes("127.0.0.1")) {
          findings.push({
            id: `network-http-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: 'Unencrypted HTTP Connection',
            description: 'HTTP connections should be upgraded to HTTPS to prevent eavesdropping',
            severity: AuditSeverity.MEDIUM,
            category: AuditCategory.NETWORK,
            location: { file, line: 0, column: 0 },
            evidence: { codeSnippet: '', context: 'HTTP usage', proof: '' },
            impact: { confidentiality: 7, integrity: 6, availability: 1, score: 60 },
            remediation: {
              steps: ['Replace http:// with https://', 'Implement HSTS'],
              difficulty: 'low',
              priority: 2,
              references: []
            },
            metadata: { discoveredAt: new Date(), status: 'open', tags: ['network', 'encryption'] }
          });
        }

        // Check for disabled TLS verification
        if (content.includes('rejectUnauthorized: false') || content.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {
          findings.push({
            id: `network-tls-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: 'TLS Verification Disabled',
            description: 'Disabling TLS certificate verification exposes the application to man-in-the-middle attacks',
            severity: AuditSeverity.CRITICAL,
            category: AuditCategory.NETWORK,
            location: { file, line: 0, column: 0 },
            evidence: { codeSnippet: '', context: 'TLS configuration', proof: '' },
            impact: { confidentiality: 10, integrity: 10, availability: 1, score: 100 },
            remediation: {
              steps: ['Enable TLS certificate verification', 'Use proper CA certificates'],
              difficulty: 'low',
              priority: 1,
              references: []
            },
            metadata: { discoveredAt: new Date(), status: 'open', tags: ['network', 'tls'] }
          });
        }

      } catch (error) {
        // File read error - skip
      }
    }

    return findings;
  }
}

/**
 * Storage Auditor - Checks for storage security vulnerabilities
 */
class StorageAuditor implements Auditor {
  name = 'Storage Auditor';

  async audit(scope: { files: string[] }): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const codeFiles = scope.files.filter(f => 
      f.endsWith('.ts') || f.endsWith('.js')
    );

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        // Check for unencrypted localStorage usage for sensitive data
        if (content.includes('localStorage.setItem') && 
            (content.includes('token') || content.includes('secret') || content.includes('key'))) {
          findings.push({
            id: `storage-local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: 'Sensitive Data in localStorage',
            description: 'Storing sensitive data in localStorage without encryption is a security risk',
            severity: AuditSeverity.MEDIUM,
            category: AuditCategory.STORAGE,
            location: { file, line: 0, column: 0 },
            evidence: { codeSnippet: '', context: 'localStorage usage', proof: '' },
            impact: { confidentiality: 7, integrity: 4, availability: 1, score: 55 },
            remediation: {
              steps: ['Encrypt sensitive data before storage', 'Consider using secure session storage', 'Use IndexedDB with encryption'],
              difficulty: 'medium',
              priority: 2,
              references: []
            },
            metadata: { discoveredAt: new Date(), status: 'open', tags: ['storage', 'encryption'] }
          });
        }

        // Check for SQL injection patterns
        if (content.includes('`SELECT') || content.includes("'SELECT")) {
          const hasSafePatterns = content.includes('prepare') || content.includes('parameterized');
          if (!hasSafePatterns) {
            findings.push({
              id: `storage-sql-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: 'Potential SQL Injection',
              description: 'String concatenation in SQL queries may lead to SQL injection vulnerabilities',
              severity: AuditSeverity.CRITICAL,
              category: AuditCategory.STORAGE,
              location: { file, line: 0, column: 0 },
              evidence: { codeSnippet: '', context: 'SQL query construction', proof: '' },
              impact: { confidentiality: 10, integrity: 10, availability: 8, score: 100 },
              remediation: {
                steps: ['Use parameterized queries', 'Use prepared statements', 'Validate and sanitize all inputs'],
                difficulty: 'medium',
                priority: 1,
                references: []
              },
              metadata: { discoveredAt: new Date(), status: 'open', tags: ['storage', 'injection'] }
            });
          }
        }

      } catch (error) {
        // File read error - skip
      }
    }

    return findings;
  }
}

export { ZKPAuditor, CryptoAuditor, NetworkAuditor, StorageAuditor };
