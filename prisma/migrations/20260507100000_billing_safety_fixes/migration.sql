-- ─────────────────────────────────────────────────────────────────────────────
-- Billing Safety Fixes — 2026-05-07
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add `cancelled` status to InvoiceStatus enum
--    Allows no-show / deleted appointment invoices to be closed cleanly
--    instead of staying in `draft` and inflating accounts-receivable reports.
DO $$ BEGIN
    ALTER TYPE "InvoiceStatus" ADD VALUE 'cancelled';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add per-tenant invoice sequence counter to Tenant
--    Enables human-readable sequential invoice numbers (INV-2026-00042).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "invoiceSeq" INTEGER NOT NULL DEFAULT 0;

-- 3. Add invoiceNumber to Invoice
--    Unique per tenant; generated atomically from Tenant.invoiceSeq.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_tenantId_invoiceNumber_key"
    ON "Invoice"("tenantId", "invoiceNumber");

-- 4. Add pricePerSession to PatientPackage
--    Locks the covered-amount per session at the price when the package was sold,
--    preventing service price changes from silently altering coverage values.
ALTER TABLE "PatientPackage" ADD COLUMN IF NOT EXISTS "pricePerSession" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill existing packages with current service price (best-effort snapshot).
UPDATE "PatientPackage" pp
SET    "pricePerSession" = s.price
FROM   "Service" s
WHERE  s.id = pp."serviceId"
  AND  pp."pricePerSession" = 0;

-- 5. Add idempotencyKey to Payment
--    Client-supplied key lets the server detect duplicate payment submissions
--    (e.g. network retry after response is lost) and return the existing payment.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key"
    ON "Payment"("idempotencyKey");

-- 6. Add DB-level balance integrity constraint
--    Enforces balance = finalAmount - totalPaid at the row level.
--    Any code path that updates only one side will be caught immediately.
--    NOTE: Run `SELECT COUNT(*) FROM "Invoice" WHERE ABS("balance" - ("finalAmount" - "totalPaid")) > 0.01`
--    first to verify existing data is consistent before applying.
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS invoice_balance_check;
ALTER TABLE "Invoice" ADD CONSTRAINT invoice_balance_check
    CHECK ("balance" = "finalAmount" - "totalPaid");
