export interface SafetyCheckResult {
  safe: boolean;
  injectionScore?: number;
  toxicityScore?: number;
  errors?: string[];
}

const INJECTION_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /ignore\s+previous/i, weight: 0.3 },
  { pattern: /system\s+prompt/i, weight: 0.3 },
  { pattern: /you\s+are\s+now/i, weight: 0.2 },
  { pattern: /forget\s+everything/i, weight: 0.3 },
  { pattern: /admin\s+mode/i, weight: 0.2 },
  { pattern: /debug\s+mode/i, weight: 0.2 },
  { pattern: /override\s+safety/i, weight: 0.3 },
  { pattern: /override\s+rules/i, weight: 0.3 },
  { pattern: /override\s+constraints/i, weight: 0.3 },
  { pattern: /bypass\s+filter/i, weight: 0.2 },
  { pattern: /pretend\s+you\s+are/i, weight: 0.2 },
  { pattern: /act\s+as\s+if/i, weight: 0.15 },
  { pattern: /disregard/i, weight: 0.2 },
];

const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /api[_-]?key/i, label: 'API key reference' },
  { pattern: /secret/i, label: 'Secret reference' },
  { pattern: /password/i, label: 'Password reference' },
  { pattern: /authorization/i, label: 'Authorization header' },
  { pattern: /bearer\s+/i, label: 'Bearer token' },
  { pattern: /sk-[a-zA-Z0-9]{8,}/i, label: 'Exposed API key (sk-*)' },
  { pattern: /token\s*[=:]/i, label: 'Token assignment' },
];

const INJECTION_THRESHOLD = 0.8;

export class InputSafetyPipeline {
  check(input: string): SafetyCheckResult {
    let score = 0;
    const matchedPatterns: string[] = [];

    for (const { pattern, weight } of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        score += weight;
        matchedPatterns.push(pattern.source);
      }
    }

    score = Math.min(score, 1);

    if (score >= INJECTION_THRESHOLD) {
      return {
        safe: false,
        injectionScore: score,
        errors: [`Prompt injection detected (score: ${score.toFixed(2)}). Matched patterns: ${matchedPatterns.join(', ')}`],
      };
    }

    return {
      safe: true,
      injectionScore: score,
    };
  }
}

export class OutputSafetyPipeline {
  check(output: string): SafetyCheckResult {
    const errors: string[] = [];
    let hasInjection = false;
    let injectionScore = 0;
    let toxicityScore = 0;

    for (const { pattern, label } of SECRET_PATTERNS) {
      if (pattern.test(output)) {
        errors.push(`Secret exposure detected: ${label}`);
      }
    }

    for (const { pattern, weight } of INJECTION_PATTERNS) {
      if (pattern.test(output)) {
        hasInjection = true;
        injectionScore += weight;
      }
    }

    injectionScore = Math.min(injectionScore, 1);

    if (hasInjection) {
      errors.push(`Output injection detected (score: ${injectionScore.toFixed(2)})`);
    }

    if (errors.length > 0) {
      return {
        safe: false,
        injectionScore: hasInjection ? injectionScore : undefined,
        toxicityScore: toxicityScore > 0 ? toxicityScore : undefined,
        errors,
      };
    }

    return { safe: true };
  }
}

export class FieldAllowlistPipeline {
  check(data: Record<string, unknown>, allowlist: string[]): SafetyCheckResult {
    const extraFields = Object.keys(data).filter((key) => !allowlist.includes(key));

    if (extraFields.length > 0) {
      return {
        safe: false,
        errors: [`Extra fields not in allowlist: ${extraFields.join(', ')}. Allowed: ${allowlist.join(', ')}`],
      };
    }

    return { safe: true };
  }
}

export class ReferenceIntegrityPipeline {
  check(
    data: unknown,
    references: {
      locationIds?: string[];
      npcIds?: string[];
      factionIds?: string[];
    },
  ): SafetyCheckResult {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return { safe: true };
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.locationId === 'string' && references.locationIds) {
      if (!references.locationIds.includes(obj.locationId)) {
        errors.push(`locationId "${obj.locationId}" does not exist in world locations`);
      }
    }

    if (typeof obj.relatedLocation === 'string' && references.locationIds) {
      if (!references.locationIds.includes(obj.relatedLocation)) {
        errors.push(`relatedLocation "${obj.relatedLocation}" does not exist in world locations`);
      }
    }

    if (typeof obj.npcId === 'string' && references.npcIds) {
      if (!references.npcIds.includes(obj.npcId)) {
        errors.push(`npcId "${obj.npcId}" does not exist in world NPCs`);
      }
    }

    if (typeof obj.relatedNpc === 'string' && references.npcIds) {
      if (!references.npcIds.includes(obj.relatedNpc)) {
        errors.push(`relatedNpc "${obj.relatedNpc}" does not exist in world NPCs`);
      }
    }

    if (typeof obj.relatedNpcIds === 'object' && Array.isArray(obj.relatedNpcIds) && references.npcIds) {
      for (const id of obj.relatedNpcIds as string[]) {
        if (!references.npcIds.includes(id)) {
          errors.push(`relatedNpcId "${id}" does not exist in world NPCs`);
        }
      }
    }

    if (typeof obj.faction === 'string' && references.factionIds) {
      if (!references.factionIds.includes(obj.faction)) {
        errors.push(`faction "${obj.faction}" does not exist in world factions`);
      }
    }

    if (typeof obj.requiredRealm === 'string') {
      const validRealmIds = [
        'lianTi', 'lianQi', 'zhuJi', 'benYuan', 'tongMing', 'huaShen',
        'guiYi', 'duJie', 'tianMen', 'xianJing', 'shengJing',
        'bianFenJing', 'tianDaoJing', 'wuXian',
      ];
      if (!validRealmIds.includes(obj.requiredRealm)) {
        errors.push(`requiredRealm "${obj.requiredRealm}" is not a valid realm ID`);
      }
    }

    if (errors.length > 0) {
      return { safe: false, errors };
    }

    return { safe: true };
  }
}

export class SizeLimitPipeline {
  private maxSizeBytes: number;

  constructor(maxSizeKB: number = 50) {
    this.maxSizeBytes = maxSizeKB * 1024;
  }

  check(jsonOutput: unknown): SafetyCheckResult {
    const serialized = JSON.stringify(jsonOutput);
    const sizeBytes = new TextEncoder().encode(serialized).length;

    if (sizeBytes > this.maxSizeBytes) {
      return {
        safe: false,
        errors: [`JSON output exceeds size limit: ${sizeBytes} bytes > ${this.maxSizeBytes} bytes (${(this.maxSizeBytes / 1024).toFixed(0)}KB)`],
      };
    }

    return { safe: true };
  }
}