import { UserRole } from '@prisma/client';

/** Flat permission flags for API responses and fine-grained guards. */
export type RolePermissions = {
  canEditUsers: boolean;
  canViewBilling: boolean;
  canManageIntegrations: boolean;
  canManageNotificationSettings: boolean;
};

export function permissionsForRole(role: UserRole): RolePermissions {
  switch (role) {
    case UserRole.super_admin:
      return {
        canEditUsers: true,
        canViewBilling: true,
        canManageIntegrations: true,
        canManageNotificationSettings: true,
      };
    case UserRole.admin:
      return {
        canEditUsers: true,
        canViewBilling: true,
        canManageIntegrations: true,
        canManageNotificationSettings: true,
      };
    case UserRole.receptionist:
      return {
        canEditUsers: false,
        canViewBilling: true,
        canManageIntegrations: false,
        canManageNotificationSettings: false,
      };
    case UserRole.doctor:
      return {
        canEditUsers: false,
        canViewBilling: false,
        canManageIntegrations: false,
        canManageNotificationSettings: false,
      };
    default:
      return {
        canEditUsers: false,
        canViewBilling: false,
        canManageIntegrations: false,
        canManageNotificationSettings: false,
      };
  }
}
