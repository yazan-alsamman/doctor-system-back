import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AccessService } from '../common/access/access.service';
import { CreateAppointmentSchema } from './dto/create-appointment.dto';
import { AddAppointmentMediaSchema } from './dto/add-appointment-media.dto';
import { CreateNextSessionSchema } from './dto/create-next-session.dto';
import { FinalizeSessionSchema } from './dto/finalize-session.dto';
import {
  UpdateAppointmentStatusSchema,
} from './dto/update-appointment-status.dto';
import { UpdateAppointmentSchema } from './dto/update-appointment.dto';
import type { AuthContext } from '../common/auth-context';
import type { AddAppointmentMediaDto } from './dto/add-appointment-media.dto';
import type { CreateAppointmentDto } from './dto/create-appointment.dto';
import type { CreateNextSessionDto } from './dto/create-next-session.dto';
import type { FinalizeSessionDto } from './dto/finalize-session.dto';
import type { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import type { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: AppointmentStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.appointmentsService.list(auth, {
      doctorId,
      status,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  @Roles(UserRole.admin, UserRole.receptionist)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateAppointmentSchema)) body: CreateAppointmentDto,
  ) {
    return (async () => {
      await this.access.assert(auth, 'appointments.create');
      return this.appointmentsService.create(auth, body);
    })();
  }

  /** Static path must be registered before `:id` or Nest matches `availability` as an id. */
  @Get('availability')
  availability(
    @CurrentUser() auth: AuthContext,
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
    @Query('serviceId') serviceId?: string,
    @Query('durationMinutes') durationMinutes?: string,
  ) {
    return this.appointmentsService.availability(auth, {
      doctorId,
      date,
      serviceId,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
    });
  }

  @Get(':id')
  findOne(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.appointmentsService.findOne(auth, id);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.receptionist, UserRole.doctor)
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAppointmentSchema)) body: UpdateAppointmentDto,
  ) {
    return (async () => {
      if (auth.role === UserRole.admin || auth.role === UserRole.receptionist) {
        await this.access.assert(auth, 'appointments.edit');
      }
      return this.appointmentsService.update(auth, id, body);
    })();
  }

  @Patch(':id/session-finalize')
  @Roles(UserRole.admin, UserRole.doctor)
  finalizeSession(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FinalizeSessionSchema)) body: FinalizeSessionDto,
  ) {
    return this.appointmentsService.finalizeSession(auth, id, body);
  }

  @Post(':id/request-reception')
  @Roles(UserRole.admin, UserRole.doctor)
  requestReception(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.appointmentsService.requestReceptionAssistance(auth, id);
  }

  @Post(':id/next-session')
  @Roles(UserRole.admin, UserRole.receptionist, UserRole.doctor)
  createNextSession(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateNextSessionSchema)) body: CreateNextSessionDto,
  ) {
    return this.appointmentsService.createNextSession(auth, id, body);
  }

  @Post(':id/media')
  @Roles(UserRole.admin, UserRole.receptionist, UserRole.doctor)
  addMedia(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddAppointmentMediaSchema)) body: AddAppointmentMediaDto,
  ) {
    return this.appointmentsService.addMedia(auth, id, body);
  }

  @Patch(':id/status')
  @Roles(UserRole.admin, UserRole.receptionist, UserRole.doctor)
  updateStatus(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAppointmentStatusSchema)) body: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(auth, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.receptionist)
  remove(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.appointmentsService.remove(auth, id);
  }
}
