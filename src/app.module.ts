import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { resolve } from 'path';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { SchedulesModule } from './schedules/schedules.module';
import { UsersModule } from './users/users.module';
import { SessionsModule } from './sessions/sessions.module';
import { CommonInfraModule } from './common/common-infra.module';
import { AccessModule } from './common/access/access.module';
import { AppController } from './app.controller';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { SyncModule } from './sync/sync.module';

/** Backend package root (`dist/` → parent), independent of `process.cwd()`. */
const backendEnvDir = resolve(__dirname, '..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(backendEnvDir, '.env.local'),
        resolve(backendEnvDir, '.env'),
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonInfraModule,
    AccessModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    ServicesModule,
    AppointmentsModule,
    InvoicesModule,
    SessionsModule,
    SchedulesModule,
    SuperAdminModule,
    NotificationsModule,
    AiModule,
    SyncModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
