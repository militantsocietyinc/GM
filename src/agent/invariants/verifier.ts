/**
 * Invariant Verifier — executes rules against pipeline context
 * and produces structured violation reports.
 */

import type {
  InvariantCheckContext,
  InvariantViolation,
  PipelineContext,
  Signal,
  EncodedSignal,
  CollapsedSignal,
} from '../types';
import { PipelineStage } from '../types';
import { getInvariantsForStage, INVARIANT_RULES } from './rules';
import { agentBus } from '../bus/event-bus';

export interface VerificationReport {
  stage: PipelineStage;
  timestamp: number;
  duration: number;
  total: number;
  passed: number;
  failed: number;
  violations: InvariantViolation[];
  /** Should the pipeline halt? */
  halt: boolean;
}

export class InvariantVerifier {
  private violationLog: InvariantViolation[] = [];

  /**
   * Run all applicable invariants for a given stage.
   */
  verify(
    stage: PipelineStage,
    pipeline: PipelineContext,
    signals: Signal[],
    encoded?: EncodedSignal[],
    collapsed?: CollapsedSignal[],
  ): VerificationReport {
    const start = performance.now();
    const rules = getInvariantsForStage(stage);

    const ctx: InvariantCheckContext = {
      stage,
      signals,
      encoded,
      collapsed,
      pipeline,
    };

    const violations: InvariantViolation[] = [];

    for (const rule of rules) {
      try {
        const result = rule.check(ctx);
        if (result) {
          violations.push(result);
          this.violationLog.push(result);
          agentBus.emit('invariant:violation', result, `verifier:${stage}`);
        }
      } catch (err) {
        // A failing invariant check is itself a violation
        const errorViolation: InvariantViolation = {
          invariantId: rule.id,
          severity: 'error',
          message: `Invariant check threw: ${err instanceof Error ? err.message : String(err)}`,
          halt: false,
        };
        violations.push(errorViolation);
        this.violationLog.push(errorViolation);
      }
    }

    const report: VerificationReport = {
      stage,
      timestamp: Date.now(),
      duration: performance.now() - start,
      total: rules.length,
      passed: rules.length - violations.length,
      failed: violations.length,
      violations,
      halt: violations.some(v => v.halt),
    };

    return report;
  }

  /**
   * Get all violations recorded across all runs.
   */
  getViolationLog(): InvariantViolation[] {
    return [...this.violationLog];
  }

  /**
   * Get violations grouped by category.
   */
  getViolationsByCategory(): Record<string, InvariantViolation[]> {
    const grouped: Record<string, InvariantViolation[]> = {};
    for (const v of this.violationLog) {
      const rule = INVARIANT_RULES.find(r => r.id === v.invariantId);
      const category = rule?.category ?? 'unknown';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(v);
    }
    return grouped;
  }

  /**
   * Clear the violation log.
   */
  reset(): void {
    this.violationLog = [];
  }
}
