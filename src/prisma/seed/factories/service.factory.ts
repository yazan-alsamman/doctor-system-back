import { Prisma } from '@prisma/client';
import type { ServiceTemplate } from '../core/types';
import { money } from '../utils/money';

export function createServiceRow(args: {
  tenantId: string;
  tpl: ServiceTemplate;
  doctorId: string;
  revenueMultiplier: number;
  overrides?: Partial<Prisma.ServiceCreateManyInput>;
}): Prisma.ServiceCreateManyInput {
  const price = money(args.tpl.priceSyp * args.revenueMultiplier);
  const aliases = [...new Set([...args.tpl.aliases, ...args.tpl.aiKeywords])];
  return {
    tenantId: args.tenantId,
    doctorId: args.doctorId,
    name: args.tpl.name,
    category: args.tpl.category,
    durationMinutes: args.tpl.durationMinutes,
    price,
    aliases,
    active: true,
    ...args.overrides,
  };
}
