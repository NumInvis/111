import type { RealmName } from '@variational-infinity/shared';

export const REALM_ORDER: Record<RealmName, number> = {
  '炼体': 0,
  '练气': 1,
  '筑基': 2,
  '本元': 3,
  '通明': 4,
  '化神': 5,
  '归一': 6,
  '渡劫': 7,
  '天门': 8,
  '仙境': 9,
  '圣境': 10,
  '变分境': 11,
  '天道境': 12,
  '无限': 13,
};

export const REALM_NAMES_ORDERED: RealmName[] = Object.keys(REALM_ORDER) as RealmName[];

export function realmOrder(realm: RealmName): number {
  return REALM_ORDER[realm] ?? -1;
}