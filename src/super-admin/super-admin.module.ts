import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../database/prisma.module';
import { SuperAdminAuthController } from './super-admin-auth.controller';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminController } from './super-admin.controller';
import { TenantManagementService } from './tenant-management.service';
import { TenantProvisionService } from './tenant-provision.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { PlatformHealthService } from './platform-health.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SuperAdminAuthController, SuperAdminController],
  providers: [
    SuperAdminAuthService,
    TenantManagementService,
    TenantProvisionService,
    PlatformAuditService,
    PlatformMetricsService,
    PlatformHealthService,
  ],
})
export class SuperAdminModule {}
