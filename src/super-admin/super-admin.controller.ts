import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { TenantStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthContext } from '../common/auth-context';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TenantManagementService } from './tenant-management.service';
import { TenantProvisionService } from './tenant-provision.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { PlatformHealthService } from './platform-health.service';
import { PlatformAuditService } from './platform-audit.service';
import { CreateClinicSchema, type CreateClinicDto } from './dto/create-clinic.dto';
import { PatchTenantSchema, type PatchTenantDto } from './dto/patch-tenant.dto';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.super_admin)
export class SuperAdminController {
  constructor(
    private readonly tenants: TenantManagementService,
    private readonly provision: TenantProvisionService,
    private readonly metrics: PlatformMetricsService,
    private readonly health: PlatformHealthService,
    private readonly audit: PlatformAuditService,
  ) {}

  @Get('metrics')
  metricsOverview() {
    return this.metrics.overview();
  }

  @Get('health')
  healthSnapshot() {
    return this.health.snapshot();
  }

  @Get('audit-logs')
  auditLogs(
    @Query('action') action?: string,
    @Query('targetTenantId') targetTenantId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.list({
      action,
      targetTenantId,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('tenants')
  listTenants(
    @Query('search') search?: string,
    @Query('status') status?: TenantStatus,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.tenants.list({
      search,
      status,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.tenants.getOne(id);
  }

  @Post('tenants')
  @UsePipes(new ZodValidationPipe(CreateClinicSchema))
  createTenant(@CurrentUser() auth: AuthContext, @Body() body: CreateClinicDto) {
    return this.provision.provision(auth.userId, body);
  }

  @Patch('tenants/:id')
  @UsePipes(new ZodValidationPipe(PatchTenantSchema))
  patchTenant(@CurrentUser() auth: AuthContext, @Param('id') id: string, @Body() body: PatchTenantDto) {
    return this.tenants.patch(auth.userId, id, body);
  }

  @Post('tenants/:id/suspend')
  suspendTenant(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.tenants.suspend(auth.userId, id);
  }

  @Post('tenants/:id/reactivate')
  reactivateTenant(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.tenants.reactivate(auth.userId, id);
  }

  @Delete('tenants/:id')
  softDeleteTenant(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.tenants.softDelete(auth.userId, id);
  }
}
