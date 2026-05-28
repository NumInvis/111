import { Injectable, Logger } from '@nestjs/common';
import {
  InputSafetyPipeline,
  OutputSafetyPipeline,
  FieldAllowlistPipeline,
  ReferenceIntegrityPipeline,
  SizeLimitPipeline,
  type SafetyCheckResult,
} from '@vi/ai';

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
    const allErrors: string[] = [];
    let overallSafe = true;
    let injectionScore: number | undefined;
    let toxicityScore: number | undefined;

    const outputCheck = this.checkOutput(JSON.stringify(data));
    if (!outputCheck.safe) {
      overallSafe = false;
      if (outputCheck.errors) allErrors.push(...outputCheck.errors);
      injectionScore = outputCheck.injectionScore;
      toxicityScore = outputCheck.toxicityScore;
    }

    if (allowedFields && typeof data === 'object' && data !== null) {
      const allowlistCheck = this.checkFieldAllowlist(data as Record<string, unknown>, allowedFields);
      if (!allowlistCheck.safe) {
        overallSafe = false;
        if (allowlistCheck.errors) allErrors.push(...allowlistCheck.errors);
      }
    }

    if (references) {
      const refCheck = this.checkReferenceIntegrity(data, references);
      if (!refCheck.safe) {
        overallSafe = false;
        if (refCheck.errors) allErrors.push(...refCheck.errors);
      }
    }

    const sizeCheck = this.checkSizeLimit(data, maxSizeKB);
    if (!sizeCheck.safe) {
      overallSafe = false;
      if (sizeCheck.errors) allErrors.push(...sizeCheck.errors);
    }

    if (!overallSafe) {
      this.logger.warn(`Full safety check failed: ${allErrors.join('; ')}`);
    }

    return {
      safe: overallSafe,
      injectionScore,
      toxicityScore,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  }
}