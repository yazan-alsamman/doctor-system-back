import { Prisma } from "@prisma/client";
import { PrismaService } from '../database/prisma.service';
import { AuthContext } from '../common/auth-context';
import { DomainEventsService } from '../common/events/domain-events.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
type Tx = Prisma.TransactionClient;
export declare class InvoicesService {
    private readonly prisma;
    private readonly domainEvents;
    private readonly auditLog;
    private readonly notifications;
    private readonly logger;
    constructor(prisma: PrismaService, domainEvents: DomainEventsService, auditLog: AuditLogService, notifications: NotificationsService);
    list(auth: AuthContext, query?: {
        status?: 'draft' | 'partial' | 'paid' | 'cancelled';
        from?: string;
        to?: string;
        page?: number;
        limit?: number;
    }): Promise<{
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
                medications: Prisma.JsonValue | null;
                vitals: Prisma.JsonValue | null;
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
                baseTotal: Prisma.Decimal;
                discount: Prisma.Decimal;
                finalTotal: Prisma.Decimal;
                manualPriceOverride: Prisma.Decimal | null;
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
                amount: Prisma.Decimal;
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
            discount: Prisma.Decimal;
            appointmentId: string;
            invoiceNumber: string | null;
            totalAmount: Prisma.Decimal;
            finalAmount: Prisma.Decimal;
            packageAdjustment: Prisma.Decimal;
            totalPaid: Prisma.Decimal;
            balance: Prisma.Decimal;
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
            medications: Prisma.JsonValue | null;
            vitals: Prisma.JsonValue | null;
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
            baseTotal: Prisma.Decimal;
            discount: Prisma.Decimal;
            finalTotal: Prisma.Decimal;
            manualPriceOverride: Prisma.Decimal | null;
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
                amount: Prisma.Decimal;
                paymentId: string;
                reason: string | null;
                actorUserId: string | null;
            }[];
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            invoiceId: string;
            amount: Prisma.Decimal;
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
        discount: Prisma.Decimal;
        appointmentId: string;
        invoiceNumber: string | null;
        totalAmount: Prisma.Decimal;
        finalAmount: Prisma.Decimal;
        packageAdjustment: Prisma.Decimal;
        totalPaid: Prisma.Decimal;
        balance: Prisma.Decimal;
    }>;
    pay(auth: AuthContext, id: string, input?: {
        paidAmount?: number;
        method?: 'cash' | 'card' | 'transfer' | 'other';
        reference?: string;
        idempotencyKey?: string;
    }): Promise<{
        payments: {
            id: string;
            createdAt: Date;
            tenantId: string;
            invoiceId: string;
            amount: Prisma.Decimal;
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
        discount: Prisma.Decimal;
        appointmentId: string;
        invoiceNumber: string | null;
        totalAmount: Prisma.Decimal;
        finalAmount: Prisma.Decimal;
        packageAdjustment: Prisma.Decimal;
        totalPaid: Prisma.Decimal;
        balance: Prisma.Decimal;
    }>;
    voidPayment(auth: AuthContext, paymentId: string): Promise<({
        payments: {
            id: string;
            createdAt: Date;
            tenantId: string;
            invoiceId: string;
            amount: Prisma.Decimal;
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
        discount: Prisma.Decimal;
        appointmentId: string;
        invoiceNumber: string | null;
        totalAmount: Prisma.Decimal;
        finalAmount: Prisma.Decimal;
        packageAdjustment: Prisma.Decimal;
        totalPaid: Prisma.Decimal;
        balance: Prisma.Decimal;
    }) | null>;
    refundPayment(auth: AuthContext, paymentId: string, input: {
        amount: Prisma.Decimal | string | number;
        reason?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        amount: Prisma.Decimal;
        paymentId: string;
        reason: string | null;
        actorUserId: string | null;
    }>;
    createDraftForAppointmentTx(tx: Tx, input: {
        tenantId: string;
        patientId: string;
        appointmentId: string;
        totalAmount: Prisma.Decimal | string | number;
        discount?: Prisma.Decimal | string | number;
        finalAmountOverride?: Prisma.Decimal | string | number;
        packageAdjustment?: Prisma.Decimal | string | number;
    }): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.InvoiceStatus;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        patientId: string;
        discount: Prisma.Decimal;
        appointmentId: string;
        invoiceNumber: string | null;
        totalAmount: Prisma.Decimal;
        finalAmount: Prisma.Decimal;
        packageAdjustment: Prisma.Decimal;
        totalPaid: Prisma.Decimal;
        balance: Prisma.Decimal;
    }>;
    syncInvoiceWithAppointmentTx(tx: Tx, auth: AuthContext, input: {
        appointmentId: string;
        totalAmount: Prisma.Decimal;
        discount: Prisma.Decimal;
        finalAmount: Prisma.Decimal;
        packageAdjustment: Prisma.Decimal;
    }): Promise<'noop' | 'updated' | 'superseded'>;
    private invoiceStatusFromPaid;
    cancelDraftInvoiceForAppointmentTx(tx: Tx, tenantId: string, appointmentId: string, actorUserId: string): Promise<void>;
    runBillingIntegritySweep(): Promise<{
        paymentMismatch: number;
        appointmentMismatch: number;
    }>;
}
export {};
