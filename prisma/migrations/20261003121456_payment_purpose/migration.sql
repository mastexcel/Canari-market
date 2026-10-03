-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('ORDER', 'SUPPLEMENT');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "orderItemId" TEXT,
ADD COLUMN     "purpose" "PaymentPurpose" NOT NULL DEFAULT 'ORDER';
