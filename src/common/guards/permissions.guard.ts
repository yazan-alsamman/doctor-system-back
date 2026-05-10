import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthContext } from '../auth-context';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { permissionsForRole, type RolePermissions } from '../role-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<(keyof RolePermissions)[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const req = context.switchToHttp().getRequest<{ user?: AuthContext }>();
    const role = req.user?.role;
    if (!role) return false;
    const granted = permissionsForRole(role);
    return required.every((key) => granted[key]);
  }
}
