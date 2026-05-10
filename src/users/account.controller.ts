import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthContext } from '../common/auth-context';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';
import { PatchPasswordSchema, PatchProfileSchema, type PatchPasswordDto, type PatchProfileDto } from './dto/account.dto';

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() auth: AuthContext) {
    return this.usersService.getSelf(auth);
  }

  @Patch('profile')
  patchProfile(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(PatchProfileSchema)) body: PatchProfileDto,
  ) {
    return this.usersService.updateSelf(auth, body);
  }

  @Patch('password')
  patchPassword(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(PatchPasswordSchema)) body: PatchPasswordDto,
  ) {
    return this.usersService.changeOwnPassword(auth, body);
  }
}
