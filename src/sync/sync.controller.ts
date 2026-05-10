import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../common/auth-context';
import { SyncBatchSchema } from './dto/sync-batch.dto';
import type { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /** Incremental pull feed (Patient + Appointment), ordered by (updatedAt, id). */
  @Get('changes')
  @Roles(UserRole.admin, UserRole.receptionist, UserRole.doctor)
  getChanges(
    @CurrentUser() auth: AuthContext,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('types') types?: string,
  ) {
    return this.syncService.getChanges(auth, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      types,
    });
  }

  /** Server capabilities + clock skew hint for clients. */
  @Get('status')
  @Roles(UserRole.admin, UserRole.receptionist, UserRole.doctor)
  getStatus(@CurrentUser() auth: AuthContext) {
    return this.syncService.getSyncStatus(auth);
  }

  /** Push offline/outbox operations — partial success per row; financial ops rejected. */
  @Post('batch')
  @Roles(UserRole.admin, UserRole.receptionist, UserRole.doctor)
  applyBatch(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(SyncBatchSchema)) body: SyncBatchDto,
  ) {
    return this.syncService.applyBatch(auth, body);
  }
}
