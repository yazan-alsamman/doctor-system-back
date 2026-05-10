import { UserRole } from "@prisma/client";
export type RolePermissions = {
    canEditUsers: boolean;
    canViewBilling: boolean;
    canManageIntegrations: boolean;
    canManageNotificationSettings: boolean;
};
export declare function permissionsForRole(role: UserRole): RolePermissions;
