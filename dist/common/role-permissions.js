"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionsForRole = permissionsForRole;
const client_1 = require("@prisma/client");
function permissionsForRole(role) {
    switch (role) {
        case client_1.UserRole.super_admin:
            return {
                canEditUsers: true,
                canViewBilling: true,
                canManageIntegrations: true,
                canManageNotificationSettings: true,
            };
        case client_1.UserRole.admin:
            return {
                canEditUsers: true,
                canViewBilling: true,
                canManageIntegrations: true,
                canManageNotificationSettings: true,
            };
        case client_1.UserRole.receptionist:
            return {
                canEditUsers: false,
                canViewBilling: true,
                canManageIntegrations: false,
                canManageNotificationSettings: false,
            };
        case client_1.UserRole.doctor:
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
//# sourceMappingURL=role-permissions.js.map