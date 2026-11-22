-- CreateTable
CREATE TABLE `CashRegister` (
    `merchantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `activeId` VARCHAR(191) NULL,

    PRIMARY KEY (`merchantId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashSession` (
    `id` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `openReference` VARCHAR(191) NOT NULL,
    `closeReference` VARCHAR(191) NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `closedBy` VARCHAR(191) NULL,
    `openingBase` VARCHAR(64) NOT NULL,
    `expectedBase` VARCHAR(64) NOT NULL,
    `countedBase` VARCHAR(64) NULL,
    `differenceBase` VARCHAR(64) NULL,

    INDEX `CashSession_merchantId_openedAt_id_idx`(`merchantId`, `openedAt`, `id`),
    UNIQUE INDEX `CashSession_merchantId_openReference_key`(`merchantId`, `openReference`),
    UNIQUE INDEX `CashSession_merchantId_closeReference_key`(`merchantId`, `closeReference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashMovement` (
    `id` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `asset` VARCHAR(8) NOT NULL,
    `amountBase` VARCHAR(64) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CashMovement_merchantId_createdAt_id_idx`(`merchantId`, `createdAt`, `id`),
    UNIQUE INDEX `CashMovement_merchantId_reference_key`(`merchantId`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `CashRegister`(`merchantId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `CashRegister`(`merchantId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `CashSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

