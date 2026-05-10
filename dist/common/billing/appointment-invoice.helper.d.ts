import type { Invoice } from "@prisma/client";
export declare function pickActiveInvoice(invoices: Invoice[] | null | undefined): Invoice | null;
