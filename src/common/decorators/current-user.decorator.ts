import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../auth-context';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthContext }>();
    return req.user;
  },
);
