import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SuperAdminLoginSchema, type SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { SuperAdminAuthService } from './super-admin-auth.service';

@Controller('super-admin/auth')
export class SuperAdminAuthController {
  constructor(private readonly auth: SuperAdminAuthService) {}

  @Post('login')
  @UsePipes(new ZodValidationPipe(SuperAdminLoginSchema))
  login(@Body() body: SuperAdminLoginDto) {
    return this.auth.login(body);
  }
}
