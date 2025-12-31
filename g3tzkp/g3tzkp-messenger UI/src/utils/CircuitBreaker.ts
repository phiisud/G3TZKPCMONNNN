export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  successCount: number;
  halfOpenActiveProbes: number;
  totalCalls: number;
  totalFailures: number;
  lastStateChange: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
  maxHalfOpenProbes: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenRequests: 3,
  maxHalfOpenProbes: 2
};

export class CircuitBreaker {
  private circuits: Map<string, CircuitBreakerState> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getCircuit(name: string): CircuitBreakerState {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        successCount: 0,
        halfOpenActiveProbes: 0,
        totalCalls: 0,
        totalFailures: 0,
        lastStateChange: Date.now()
      });
    }
    return this.circuits.get(name)!;
  }

  private transitionTo(circuit: CircuitBreakerState, newState: 'closed' | 'open' | 'half-open', name: string): void {
    const oldState = circuit.state;
    circuit.state = newState;
    circuit.lastStateChange = Date.now();
    
    if (newState === 'closed') {
      circuit.failures = 0;
      circuit.successCount = 0;
      circuit.halfOpenActiveProbes = 0;
    } else if (newState === 'half-open') {
      circuit.successCount = 0;
      circuit.halfOpenActiveProbes = 0;
    }
    
    console.log(`[CircuitBreaker] ${name}: ${oldState} -> ${newState}`);
  }

  call(name: string): boolean {
    const circuit = this.getCircuit(name);
    const now = Date.now();
    circuit.totalCalls++;

    switch (circuit.state) {
      case 'closed':
        return true;

      case 'open':
        if (now - circuit.lastFailure >= this.config.resetTimeout) {
          this.transitionTo(circuit, 'half-open', name);
          circuit.halfOpenActiveProbes = 1;
          return true;
        }
        console.log(`[CircuitBreaker] ${name}: open, rejecting (${Math.ceil((this.config.resetTimeout - (now - circuit.lastFailure)) / 1000)}s until retry)`);
        return false;

      case 'half-open':
        if (circuit.halfOpenActiveProbes < this.config.maxHalfOpenProbes) {
          circuit.halfOpenActiveProbes++;
          return true;
        }
        console.log(`[CircuitBreaker] ${name}: half-open probe limit reached, waiting for results`);
        return false;

      default:
        return true;
    }
  }

  reportSuccess(name: string): void {
    const circuit = this.getCircuit(name);
    
    if (circuit.state === 'half-open') {
      circuit.halfOpenActiveProbes = Math.max(0, circuit.halfOpenActiveProbes - 1);
      circuit.successCount++;
      
      if (circuit.successCount >= this.config.halfOpenRequests) {
        this.transitionTo(circuit, 'closed', name);
        console.log(`[CircuitBreaker] ${name}: restored after ${circuit.successCount} successful probes`);
      }
    } else if (circuit.state === 'closed') {
      circuit.failures = 0;
    }
  }

  reportFailure(name: string): void {
    const circuit = this.getCircuit(name);
    circuit.failures++;
    circuit.totalFailures++;
    circuit.lastFailure = Date.now();

    if (circuit.state === 'half-open') {
      circuit.halfOpenActiveProbes = Math.max(0, circuit.halfOpenActiveProbes - 1);
      this.transitionTo(circuit, 'open', name);
      console.log(`[CircuitBreaker] ${name}: half-open probe failed, reopened`);
    } else if (circuit.state === 'closed' && circuit.failures >= this.config.failureThreshold) {
      this.transitionTo(circuit, 'open', name);
      console.log(`[CircuitBreaker] ${name}: ${circuit.failures} failures, opened`);
    }
  }

  getState(name: string): CircuitBreakerState {
    return { ...this.getCircuit(name) };
  }

  isHealthy(name: string): boolean {
    const circuit = this.getCircuit(name);
    return circuit.state === 'closed';
  }

  reset(name: string): void {
    this.circuits.set(name, {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
      successCount: 0,
      halfOpenActiveProbes: 0,
      totalCalls: 0,
      totalFailures: 0,
      lastStateChange: Date.now()
    });
    console.log(`[CircuitBreaker] ${name}: manually reset`);
  }

  resetAll(): void {
    this.circuits.clear();
    console.log('[CircuitBreaker] All circuits reset');
  }

  getStats(): Record<string, CircuitBreakerState> {
    const stats: Record<string, CircuitBreakerState> = {};
    this.circuits.forEach((state, name) => {
      stats[name] = { ...state };
    });
    return stats;
  }

  getHealthReport(): { name: string; state: string; health: number; uptime: number }[] {
    const now = Date.now();
    const report: { name: string; state: string; health: number; uptime: number }[] = [];
    
    this.circuits.forEach((circuit, name) => {
      const successRate = circuit.totalCalls > 0 
        ? (circuit.totalCalls - circuit.totalFailures) / circuit.totalCalls 
        : 1;
      report.push({
        name,
        state: circuit.state,
        health: Math.round(successRate * 100),
        uptime: now - circuit.lastStateChange
      });
    });
    
    return report;
  }
}

export default CircuitBreaker;
