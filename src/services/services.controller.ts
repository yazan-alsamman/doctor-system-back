import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateServiceSchema } from './dto/create-service.dto';
import { UpdateServiceSchema } from './dto/update-service.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../common/auth-context';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  list(@CurrentUser() auth: AuthContext, @Query('doctorId') doctorId?: string) {
    return this.servicesService.list(auth, doctorId);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.doctor, UserRole.receptionist)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateServiceSchema)) body: CreateServiceDto,
  ) {
    return this.servicesService.create(auth, body);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.doctor, UserRole.receptionist)
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateServiceSchema)) body: UpdateServiceDto,
  ) {
    return this.servicesService.update(auth, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.doctor, UserRole.receptionist)
  remove(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.servicesService.remove(auth, id);
  }
}
