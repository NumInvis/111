export interface SafetyCheckResult {
  safe: boolean;
  injectionScore?: number;
  toxicityScore?: number;
  errors?: string[];
  severity?: 'blocker' | 'warning';
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
  { pattern: /忽略之前/i, weight: 0.3 },
  { pattern: /系统提示/i, weight: 0.3 },
  { pattern: /你现在/i, weight: 0.2 },
  { pattern: /忘记一切/i, weight: 0.3 },
  { pattern: /管理员模式/i, weight: 0.2 },
  { pattern: /绕过/i, weight: 0.2 },
];

const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/i, label: 'Exposed API key (sk-*)' },
  { pattern: /api[_-]?key\s*[=:]\s*\S/i, label: 'API key assignment' },
  { pattern: /Bearer\s+[a-zA-Z0-9._-]{16,}/i, label: 'Bearer token exposure' },
  { pattern: /token\s*[=:]\s*[a-zA-Z0-9._-]{16,}/i, label: 'Token assignment' },
  { pattern: /password\s*[=:]\s*\S/i, label: 'Password assignment' },
];

const OUTPUT_INJECTION_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /<<</, weight: 0.4 },
  { pattern: /\[system\]/i, weight: 0.4 },
  { pattern: /###\s*system/i, weight: 0.4 },
  { pattern: /ignore\s+previous/i, weight: 0.3 },
  { pattern: /system\s+prompt/i, weight: 0.3 },
  { pattern: /override\s+safety/i, weight: 0.3 },
  { pattern: /override\s+rules/i, weight: 0.3 },
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
        severity: 'blocker',
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
    const warnings: string[] = [];
    let injectionScore = 0;

    for (const { pattern, label } of SECRET_PATTERNS) {
      if (pattern.test(output)) {
        errors.push(`Secret exposure detected: ${label}`);
      }
    }

    for (const { pattern, weight } of OUTPUT_INJECTION_PATTERNS) {
      if (pattern.test(output)) {
        injectionScore += weight;
      }
    }

    injectionScore = Math.min(injectionScore, 1);

    if (injectionScore >= INJECTION_THRESHOLD) {
      errors.push(`Output injection detected (score: ${injectionScore.toFixed(2)})`);
    } else if (injectionScore > 0) {
      warnings.push(`Minor output injection indicators (score: ${injectionScore.toFixed(2)})`);
    }

    if (errors.length > 0) {
      return {
        safe: false,
        severity: 'blocker',
        injectionScore: injectionScore > 0 ? injectionScore : undefined,
        errors,
      };
    }

    if (warnings.length > 0) {
      return {
        safe: true,
        severity: 'warning',
        injectionScore,
        errors: warnings,
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
        safe: true,
        severity: 'warning',
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
      const validRealmValues = [
        'lianTi', 'lianQi', 'zhuJi', 'benYuan', 'tongMing', 'huaShen',
        'guiYi', 'duJie', 'tianMen', 'xianJing', 'shengJing',
        'bianFenJing', 'tianDaoJing', 'wuXian',
        '炼体', '练气', '筑基', '本元', '通明', '化神',
        '归一', '渡劫', '天门', '仙境', '圣境',
        '变分境', '天道境', '无限',
      ];
      if (!validRealmValues.includes(obj.requiredRealm)) {
        errors.push(`requiredRealm "${obj.requiredRealm}" is not a valid realm ID or name`);
      }
    }

    if (errors.length > 0) {
      return {
        safe: true,
        severity: 'warning',
        errors,
      };
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
        severity: 'warning',
        errors: [`JSON output exceeds size limit: ${sizeBytes} bytes > ${this.maxSizeBytes} bytes (${(this.maxSizeBytes / 1024).toFixed(0)}KB)`],
      };
    }

    return { safe: true };
  }
}