import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AccountController } from './account.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, AccountController],
  providers: [UsersService],
})
export class UsersModule {}
