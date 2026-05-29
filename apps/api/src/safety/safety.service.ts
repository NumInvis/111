import { Injectable, Logger } from '@nestjs/common';
import {
  InputSafetyPipeline,
  OutputSafetyPipeline,
  FieldAllowlistPipeline,
  ReferenceIntegrityPipeline,
  SizeLimitPipeline,
  type SafetyCheckResult,
} from '@variational-infinity/ai';

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);
  private readonly inputPipeline = new InputSafetyPipeline();
  private readonly outputPipeline = new OutputSafetyPipeline();
  private readonly fieldAllowlistPipeline = new FieldAllowlistPipeline();
  private readonly referenceIntegrityPipeline = new ReferenceIntegrityPipeline();
  private readonly sizeLimitPipeline = new SizeLimitPipeline(50);

  checkInput(text: string): SafetyCheckResult {
    return this.inputPipeline.check(text);
  }

  checkOutput(data: string): SafetyCheckResult {
    return this.outputPipeline.check(data);
  }

  checkFieldAllowlist(data: Record<string, unknown>, allowed: string[]): SafetyCheckResult {
    return this.fieldAllowlistPipeline.check(data, allowed);
  }

  checkReferenceIntegrity(
    data: unknown,
    references: { locationIds?: string[]; npcIds?: string[]; factionIds?: string[] },
  ): SafetyCheckResult {
    return this.referenceIntegrityPipeline.check(data, references);
  }

  checkSizeLimit(data: unknown, maxSizeKB?: number): SafetyCheckResult {
    const pipeline = maxSizeKB ? new SizeLimitPipeline(maxSizeKB) : this.sizeLimitPipeline;
    return pipeline.check(data);
  }

  fullOutputCheck(
    data: unknown,
    allowedFields?: string[],
    maxSizeKB?: number,
    references?: { locationIds?: string[]; npcIds?: string[]; factionIds?: string[] },
  ): SafetyCheckResult {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let injectionScore: number | undefined;
    let toxicityScore: number | undefined;

    const outputCheck = this.checkOutput(JSON.stringify(data));
    if (!outputCheck.safe) {
      if (outputCheck.severity === 'blocker') {
        blockers.push(...(outputCheck.errors ?? []));
      } else {
        warnings.push(...(outputCheck.errors ?? []));
      }
      injectionScore = outputCheck.injectionScore;
      toxicityScore = outputCheck.toxicityScore;
    } else if (outputCheck.errors && outputCheck.errors.length > 0) {
      warnings.push(...outputCheck.errors);
    }

    if (allowedFields && typeof data === 'object' && data !== null) {
      const allowlistCheck = this.checkFieldAllowlist(data as Record<string, unknown>, allowedFields);
      if (!allowlistCheck.safe) {
        if (allowlistCheck.severity === 'blocker') {
          blockers.push(...(allowlistCheck.errors ?? []));
        } else {
          warnings.push(...(allowlistCheck.errors ?? []));
        }
      }
    }

    if (references) {
      const refCheck = this.checkReferenceIntegrity(data, references);
      if (!refCheck.safe) {
        if (refCheck.severity === 'blocker') {
          blockers.push(...(refCheck.errors ?? []));
        } else {
          warnings.push(...(refCheck.errors ?? []));
        }
      }
    }

    const sizeCheck = this.checkSizeLimit(data, maxSizeKB);
    if (!sizeCheck.safe) {
      if (sizeCheck.severity === 'blocker') {
        blockers.push(...(sizeCheck.errors ?? []));
      } else {
        warnings.push(...(sizeCheck.errors ?? []));
      }
    }

    if (blockers.length > 0) {
      this.logger.error(`Safety blockers: ${blockers.join('; ')}`);
      return {
        safe: false,
        severity: 'blocker',
        injectionScore,
        toxicityScore,
        errors: blockers,
      };
    }

    if (warnings.length > 0) {
      this.logger.warn(`Safety warnings: ${warnings.join('; ')}`);
      return {
        safe: true,
        severity: 'warning',
        injectionScore,
        toxicityScore,
        errors: warnings,
      };
    }

    return { safe: true };
  }
}