export class CircuitBreaker {
  private id: string;
  private failureCount = 0;
  private failureThreshold: number;
  private cooldownMs: number;
  private cooldownUntil: number | null = null;

  constructor(id: string, failureThreshold = 3, cooldownMs = 60_000) {
    this.id = id;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
  }

  canExecute(): boolean {
    if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
      return false;
    }
    if (this.cooldownUntil && Date.now() >= this.cooldownUntil) {
      this.cooldownUntil = null;
      this.failureCount = 0;
    }
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.cooldownUntil = null;
  }

  recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.cooldownUntil = Date.now() + this.cooldownMs;
      console.warn(`[circuit-breaker] ${this.id} tripped — cooldown ${this.cooldownMs}ms`);
    }
  }

  getStatus(): { id: string; failures: number; isOpen: boolean } {
    return {
      id: this.id,
      failures: this.failureCount,
      isOpen: this.cooldownUntil != null && Date.now() < this.cooldownUntil,
    };
  }
}
