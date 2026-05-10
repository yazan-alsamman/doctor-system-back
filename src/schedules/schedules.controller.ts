import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateScheduleSchema } from './dto/create-schedule.dto';
import type { AuthContext } from '../common/auth-context';
import type { CreateScheduleDto } from './dto/create-schedule.dto';

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @Roles(UserRole.admin, UserRole.doctor)
  list(@CurrentUser() auth: AuthContext) {
    return this.schedulesService.list(auth);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.doctor)
  upsert(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateScheduleSchema)) body: CreateScheduleDto,
  ) {
    return this.schedulesService.upsert(auth, body);
  }

  @Delete(':doctorId/:dayOfWeek')
  @Roles(UserRole.admin, UserRole.doctor)
  remove(
    @CurrentUser() auth: AuthContext,
    @Param('doctorId') doctorId: string,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
  ) {
    return this.schedulesService.remove(auth, doctorId, dayOfWeek);
  }
}
