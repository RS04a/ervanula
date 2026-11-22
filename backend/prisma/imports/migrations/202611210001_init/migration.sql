-- CreateTable
CREATE TABLE `ImportJob` (
    `id` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `contentDigest` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `confirmedAt` DATETIME(3) NULL,

    INDEX `ImportJob_merchantId_createdAt_id_idx`(`merchantId`, `createdAt`, `id`),
    INDEX `ImportJob_status_updatedAt_idx`(`status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportRowResult` (
    `jobId` VARCHAR(191) NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `sku` VARCHAR(191) NULL,
    `product` JSON NULL,
    `status` VARCHAR(16) NOT NULL,
    `error` VARCHAR(191) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `retryAt` DATETIME(3) NULL,
    `leaseToken` VARCHAR(191) NULL,
    `leaseUntil` DATETIME(3) NULL,

    INDEX `ImportRowResult_status_retryAt_leaseUntil_idx`(`status`, `retryAt`, `leaseUntil`),
    PRIMARY KEY (`jobId`, `rowNumber`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ImportRowResult` ADD CONSTRAINT `ImportRowResult_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `ImportJob`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

