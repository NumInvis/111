export const WORLD_BOOK = {
  realms: [
    { name: '炼体', mathLevel: '幼儿园', narrativeRole: '凡人启蒙' },
    { name: '练气', mathLevel: '小学1-2年级', narrativeRole: '初入修行' },
    { name: '筑基', mathLevel: '小学3-4年级', narrativeRole: '筑基立本' },
    { name: '本元', mathLevel: '小学5-6年级', narrativeRole: '探求本元' },
    { name: '通明', mathLevel: '初一初二', narrativeRole: '渐悟通明' },
    { name: '化神', mathLevel: '初三', narrativeRole: '中考分流' },
    { name: '归一', mathLevel: '高一高二', narrativeRole: '融会归一' },
    { name: '渡劫', mathLevel: '高三', narrativeRole: '高考渡劫' },
    { name: '天门', mathLevel: '高考/大学入学', narrativeRole: '界壁，非境界' },
    { name: '仙境', mathLevel: '大学低年级', narrativeRole: '初入仙境' },
    { name: '圣境', mathLevel: '大学高年级', narrativeRole: '专业精进' },
    { name: '变分境', mathLevel: '研究生', narrativeRole: '变分求极' },
    { name: '天道境', mathLevel: '数学系博士', narrativeRole: '参悟天道' },
    { name: '无限', mathLevel: '超越', narrativeRole: '不可触及' },
  ],
} as const;

export type WorldBookEntry = (typeof WORLD_BOOK.realms)[number];

export function getWorldBookEntry(realmName: string): WorldBookEntry | undefined {
  return WORLD_BOOK.realms.find((r) => r.name === realmName);
}

export function getMathLevel(realmName: string): string | undefined {
  return getWorldBookEntry(realmName)?.mathLevel;
}

export function isBoundaryWall(realmName: string): boolean {
  return realmName === '天门';
}

export function isUntouchable(realmName: string): boolean {
  return realmName === '无限';
}

export function isLowerRealm(realmName: string): boolean {
  const idx = WORLD_BOOK.realms.findIndex((r) => r.name === realmName);
  const tianmenIdx = WORLD_BOOK.realms.findIndex((r) => r.name === '天门');
  return idx >= 0 && idx < tianmenIdx;
}

export function isUpperRealm(realmName: string): boolean {
  const idx = WORLD_BOOK.realms.findIndex((r) => r.name === realmName);
  const tianmenIdx = WORLD_BOOK.realms.findIndex((r) => r.name === '天门');
  return idx > tianmenIdx;
}

export function formatWorldBookForPrompt(): string {
  return WORLD_BOOK.realms
    .map((r) => {
      let line = `| ${r.name} | ${r.mathLevel} | ${r.narrativeRole} |`;
      return line;
    })
    .join('\n');
}
