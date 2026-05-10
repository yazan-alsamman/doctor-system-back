import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessService } from '../common/access/access.service';
import { CreatePatientSchema } from './dto/create-patient.dto';
import { UpdatePatientSchema } from './dto/update-patient.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreatePatientPackageSchema } from './dto/create-patient-package.dto';
import type { AuthContext } from '../common/auth-context';
import type { CreatePatientDto } from './dto/create-patient.dto';
import type { UpdatePatientDto } from './dto/update-patient.dto';
import type { CreatePatientPackageDto } from './dto/create-patient-package.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.patientsService.list(auth, {
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  @Roles(UserRole.admin, UserRole.receptionist)
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreatePatientSchema)) body: CreatePatientDto,
  ) {
    return (async () => {
      await this.access.assert(auth, 'patients.create');
      return this.patientsService.create(auth, body);
    })();
  }

  @Get(':id/packages')
  listPackages(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.patientsService.listPackages(auth, id);
  }

  @Post(':id/packages')
  @Roles(UserRole.admin, UserRole.receptionist)
  createPackage(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreatePatientPackageSchema)) body: CreatePatientPackageDto,
  ) {
    return this.patientsService.createPackage(auth, id, body);
  }

  @Get(':id')
  findOne(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.patientsService.findOne(auth, id);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.receptionist)
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePatientSchema)) body: UpdatePatientDto,
  ) {
    return (async () => {
      await this.access.assert(auth, 'patients.edit');
      return this.patientsService.update(auth, id, body);
    })();
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.receptionist)
  remove(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.patientsService.remove(auth, id);
  }
}
