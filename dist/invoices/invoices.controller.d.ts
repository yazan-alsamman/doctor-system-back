import { InvoicesService } from './invoices.service';
import type { AuthContext } from '../common/auth-context';
import type { PayInvoiceDto } from './dto/pay-invoice.dto';
import type { RefundPaymentDto } from './dto/refund-payment.dto';
export declare class InvoicesController {
    private readonly invoicesService;
    constructor(invoicesService: InvoicesService);
    list(auth: AuthContext, status?: 'draft' | 'partial' | 'paid' | 'cancelled', from?: string, to?: string, page?: string, limit?: string): Promise<{
        items: ({
            patient: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                tenantId: string;
                phone: string;
                dob: Date | null;
                notes: string | null;
                sex: import("@prisma/client").$Enums.PatientSex;
                bloodType: string;
                recordStatus: import("@prisma/client").$Enums.PatientRecordStatus;
                ageYears: number | null;
                allergies: string[];
                medications: import("@prisma/client/runtime/client").JsonValue | null;
                vitals: import("@prisma/client/runtime/client").JsonValue | null;
            };
            appointment: {
                id: string;
                status: import("@prisma/client").$Enums.AppointmentStatus;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                tenantId: string;
                notes: string | null;
                doctorId: string;
                patientId: string;
                serviceId: string;
                baseTotal: import("@prisma/client-runtime-utils").Decimal;
                discount: import("@prisma/client-runtime-utils").Decimal;
                finalTotal: import("@prisma/client-runtime-utils").Decimal;
                manualPriceOverride: import("@prisma/client-runtime-utils").Decimal | null;
                consentObtained: boolean;
                treatmentDetails: string | null;
                doctorRemarks: string | null;
                specialConditions: string | null;
                startTime: Date;
                endTime: Date;
                overbooked: boolean;
            };
            payments: {
                id: string;
                createdAt: Date;
                tenantId: string;
                invoiceId: string;
                amount: import("@prisma/client-runtime-utils").Decimal;
                method: import("@prisma/client").$Enums.PaymentMethod;
                reference: string | null;
                idempotencyKey: string | null;
                voidedAt: Date | null;
            }[];
        } & {
            id: string;
            status: import("@prisma/client").$Enums.InvoiceStatus;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            tenantId: string;
            patientId: string;
            discount: import("@prisma/client-runtime-utils").Decimal;
            appointmentId: string;
            invoiceNumber: string | null;
            totalAmount: import("@prisma/client-runtime-utils").Decimal;
            finalAmount: import("@prisma/client-runtime-utils").Decimal;
            packageAdjustment: import("@prisma/client-runtime-utils").Decimal;
            totalPaid: import("@prisma/client-runtime-utils").Decimal;
            balance: import("@prisma/client-runtime-utils").Decimal;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    findOne(auth: AuthContext, id: string): Promise<{
        patient: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            tenantId: string;
            phone: string;
            dob: Date | null;
            notes: string | null;
            sex: import("@prisma/client").$Enums.PatientSex;
            bloodType: string;
            recordStatus: import("@prisma/client").$Enums.PatientRecordStatus;
            ageYears: number | null;
            allergies: string[];
            medications: import("@prisma/client/runtime/client").JsonValue | null;
            vitals: import("@prisma/client/runtime/client").JsonValue | null;
        };
        appointment: {
            id: string;
            status: import("@prisma/client").$Enums.AppointmentStatus;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            tenantId: string;
            notes: string | null;
            doctorId: string;
            patientId: string;
            serviceId: string;
            baseTotal: import("@prisma/client-runtime-utils").Decimal;
            discount: import("@prisma/client-runtime-utils").Decimal;
            finalTotal: import("@prisma/client-runtime-utils").Decimal;
            manualPriceOverride: import("@prisma/client-runtime-utils").Decimal | null;
            consentObtained: boolean;
            treatmentDetails: string | null;
            doctorRemarks: string | null;
            specialConditions: string | null;
            startTime: Date;
            endTime: Date;
            overbooked: boolean;
        };
        payments: ({
            refunds: {
                id: string;
                createdAt: Date;
                tenantId: string;
                amount: import("@prisma/client-runtime-utils").Decimal;
                paymentId: string;
                reason: string | null;
                actorUserId: string | null;
            }[];
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            invoiceId: string;
            amount: import("@prisma/client-runtime-utils").Decimal;
            method: import("@prisma/client").$Enums.PaymentMethod;
            reference: string | null;
            idempotencyKey: string | null;
            voidedAt: Date | null;
        })[];
    } & {
        id: string;
        status: import("@prisma/client").$Enums.InvoiceStatus;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        patientId: string;
        discount: import("@prisma/client-runtime-utils").Decimal;
        appointmentId: string;
        invoiceNumber: string | null;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        finalAmount: import("@prisma/client-runtime-utils").Decimal;
        packageAdjustment: import("@prisma/client-runtime-utils").Decimal;
        totalPaid: import("@prisma/client-runtime-utils").Decimal;
        balance: import("@prisma/client-runtime-utils").Decimal;
    }>;
    pay(auth: AuthContext, id: string, body: PayInvoiceDto): Promise<{
        payments: {
            id: string;
            createdAt: Date;
            tenantId: string;
            invoiceId: string;
            amount: import("@prisma/client-runtime-utils").Decimal;
            method: import("@prisma/client").$Enums.PaymentMethod;
            reference: string | null;
            idempotencyKey: string | null;
            voidedAt: Date | null;
        }[];
    } & {
        id: string;
        status: import("@prisma/client").$Enums.InvoiceStatus;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        patientId: string;
        discount: import("@prisma/client-runtime-utils").Decimal;
        appointmentId: string;
        invoiceNumber: string | null;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        finalAmount: import("@prisma/client-runtime-utils").Decimal;
        packageAdjustment: import("@prisma/client-runtime-utils").Decimal;
        totalPaid: import("@prisma/client-runtime-utils").Decimal;
        balance: import("@prisma/client-runtime-utils").Decimal;
    }>;
    refundPayment(auth: AuthContext, paymentId: string, body: RefundPaymentDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        paymentId: string;
        reason: string | null;
        actorUserId: string | null;
    }>;
    voidPayment(auth: AuthContext, paymentId: string): Promise<({
        payments: {
            id: string;
            createdAt: Date;
            tenantId: string;
            invoiceId: string;
            amount: import("@prisma/client-runtime-utils").Decimal;
            method: import("@prisma/client").$Enums.PaymentMethod;
            reference: string | null;
            idempotencyKey: string | null;
            voidedAt: Date | null;
        }[];
    } & {
        id: string;
        status: import("@prisma/client").$Enums.InvoiceStatus;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        patientId: string;
        discount: import("@prisma/client-runtime-utils").Decimal;
        appointmentId: string;
        invoiceNumber: string | null;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        finalAmount: import("@prisma/client-runtime-utils").Decimal;
        packageAdjustment: import("@prisma/client-runtime-utils").Decimal;
        totalPaid: import("@prisma/client-runtime-utils").Decimal;
        balance: import("@prisma/client-runtime-utils").Decimal;
    }) | null>;
}
