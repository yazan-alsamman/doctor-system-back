-- Package credit snapshot for invoice↔appointment re-sync
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "packageAdjustment" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- One non-cancelled invoice per appointment (allows superseded cancelled rows for audit)
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_appointmentId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_one_active_per_appointment"
ON "Invoice" ("appointmentId")
WHERE "deletedAt" IS NULL AND "status" <> 'cancelled'::"InvoiceStatus";

CREATE TABLE IF NOT EXISTS "Refund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Refund_tenantId_paymentId_idx" ON "Refund"("tenantId", "paymentId");

ALTER TABLE "Refund" DROP CONSTRAINT IF EXISTS "Refund_paymentId_fkey";
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
