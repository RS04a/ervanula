-- AlterTable
ALTER TABLE `PaymentOrder` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `Outbox` (
    `id` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,
    `leaseUntil` DATETIME(3) NULL,
    `leaseToken` VARCHAR(191) NULL,

    INDEX `Outbox_sentAt_leaseUntil_createdAt_idx`(`sentAt`, `leaseUntil`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PaymentOrder_status_expiresAt_idx` ON `PaymentOrder`(`status`, `expiresAt`);

-- CreateIndex
CREATE INDEX `PaymentOrder_merchantId_createdAt_id_idx` ON `PaymentOrder`(`merchantId`, `createdAt`, `id`);

