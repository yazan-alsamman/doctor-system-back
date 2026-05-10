import { Global, Module } from '@nestjs/common';
import { createPrismaService, PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: createPrismaService,
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
