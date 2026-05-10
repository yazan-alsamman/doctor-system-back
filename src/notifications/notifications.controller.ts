import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthContext } from '../common/auth-context';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.listForUser(auth.userId, auth.tenantId, {
      unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() auth: AuthContext) {
    return this.notifications.markAllRead(auth.userId, auth.tenantId);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.notifications.markRead(auth.userId, auth.tenantId, id);
  }
}
