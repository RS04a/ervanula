-- CreateTable
CREATE TABLE `PaymentOrder` (
    `id` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `network` VARCHAR(191) NOT NULL,
    `tokenSymbol` VARCHAR(191) NOT NULL,
    `tokenContract` VARCHAR(191) NOT NULL,
    `recipientAddress` VARCHAR(191) NOT NULL,
    `amountBaseUnits` VARCHAR(191) NOT NULL,
    `tokenDecimals` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'DETECTED', 'CONFIRMING', 'CONFIRMED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `expiresAt` DATETIME(3) NOT NULL,
    `transactionHash` VARCHAR(191) NULL,
    `failureCode` ENUM('TRANSACTION_NOT_FOUND', 'NETWORK_MISMATCH', 'INVALID_TOKEN', 'WRONG_RECIPIENT', 'AMOUNT_MISMATCH', 'TRANSACTION_FAILED', 'INSUFFICIENT_CONFIRMATIONS', 'ORDER_EXPIRED', 'DUPLICATE_TRANSACTION', 'PROVIDER_UNAVAILABLE', 'INVALID_TRANSACTION_DATA') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `confirmedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PaymentOrder_transactionHash_key`(`transactionHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockchainTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `network` VARCHAR(191) NOT NULL,
    `transactionHash` VARCHAR(191) NOT NULL,
    `contractAddress` VARCHAR(191) NOT NULL,
    `senderAddress` VARCHAR(191) NOT NULL,
    `recipientAddress` VARCHAR(191) NOT NULL,
    `amountBaseUnits` VARCHAR(191) NOT NULL,
    `blockNumber` BIGINT NOT NULL,
    `confirmed` BOOLEAN NOT NULL,
    `rawPayload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BlockchainTransaction_network_transactionHash_key`(`network`, `transactionHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentAuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `paymentOrderId` VARCHAR(191) NOT NULL,
    `previousStatus` ENUM('PENDING', 'DETECTED', 'CONFIRMING', 'CONFIRMED', 'REJECTED', 'EXPIRED') NULL,
    `newStatus` ENUM('PENDING', 'DETECTED', 'CONFIRMING', 'CONFIRMED', 'REJECTED', 'EXPIRED') NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `failureCode` ENUM('TRANSACTION_NOT_FOUND', 'NETWORK_MISMATCH', 'INVALID_TOKEN', 'WRONG_RECIPIENT', 'AMOUNT_MISMATCH', 'TRANSACTION_FAILED', 'INSUFFICIENT_CONFIRMATIONS', 'ORDER_EXPIRED', 'DUPLICATE_TRANSACTION', 'PROVIDER_UNAVAILABLE', 'INVALID_TRANSACTION_DATA') NULL,
    `details` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentAuditEvent_paymentOrderId_createdAt_idx`(`paymentOrderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PaymentAuditEvent` ADD CONSTRAINT `PaymentAuditEvent_paymentOrderId_fkey` FOREIGN KEY (`paymentOrderId`) REFERENCES `PaymentOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

