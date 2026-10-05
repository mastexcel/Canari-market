-- CreateEnum
CREATE TYPE "PushDeviceKind" AS ENUM ('WEB', 'FCM');

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PushDeviceKind" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT,
    "auth" TEXT,
    "userAgent" TEXT,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_endpoint_key" ON "PushDevice"("endpoint");

-- CreateIndex
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
