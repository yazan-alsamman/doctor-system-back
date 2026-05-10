import { UserRole } from '@prisma/client';

export type AuthContext = {
  userId: string;
  tenantId: string;
  role: UserRole;
  doctorCode?: string | null;
};
