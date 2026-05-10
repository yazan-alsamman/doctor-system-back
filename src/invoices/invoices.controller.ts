import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PayInvoiceSchema } from './dto/pay-invoice.dto';
import type { AuthContext } from '../common/auth-context';
import type { PayInvoiceDto } from './dto/pay-invoice.dto';
import { RefundPaymentSchema } from './dto/refund-payment.dto';
import type { RefundPaymentDto } from './dto/refund-payment.dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(UserRole.admin, UserRole.receptionist)
  list(
    @CurrentUser() auth: AuthContext,
    @Query('status') status?: 'draft' | 'partial' | 'paid' | 'cancelled',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.list(auth, {
      status,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.receptionist)
  findOne(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.invoicesService.findOne(auth, id);
  }

  @Patch(':id/pay')
  @Roles(UserRole.admin, UserRole.receptionist)
  pay(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PayInvoiceSchema)) body: PayInvoiceDto,
  ) {
    return this.invoicesService.pay(auth, id, body);
  }

  @Patch('payments/:paymentId/refund')
  @Roles(UserRole.admin, UserRole.receptionist)
  refundPayment(
    @CurrentUser() auth: AuthContext,
    @Param('paymentId') paymentId: string,
    @Body(new ZodValidationPipe(RefundPaymentSchema)) body: RefundPaymentDto,
  ) {
    return this.invoicesService.refundPayment(auth, paymentId, {
      amount: body.amount,
      reason: body.reason,
    });
  }

  @Patch('payments/:paymentId/void')
  @Roles(UserRole.admin)
  voidPayment(@CurrentUser() auth: AuthContext, @Param('paymentId') paymentId: string) {
    return this.invoicesService.voidPayment(auth, paymentId);
  }
}
