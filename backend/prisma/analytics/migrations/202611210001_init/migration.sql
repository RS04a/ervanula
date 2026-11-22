-- CreateTable
CREATE TABLE `Projection` (
    `merchantId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `collectedRevision` INTEGER NOT NULL DEFAULT -1,
    `collectedAt` DATETIME(3) NULL,
    `payload` JSON NULL,
    `retryAt` DATETIME(3) NULL,
    `leaseToken` VARCHAR(191) NULL,
    `leaseUntil` DATETIME(3) NULL,

    PRIMARY KEY (`merchantId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcessedEvent` (
    `eventId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`eventId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

