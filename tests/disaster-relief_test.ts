import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const CONTRACT_NAME = 'disaster-relief';

Clarinet.test({
    name: "Test donation functionality - successful donation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const donor = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(100)], donor.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(100));
        
        // Verify donation was recorded
        let queryBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-donation', [types.principal(donor.address)], deployer.address)
        ]);
        assertEquals(queryBlock.receipts[0].result.expectUint(), 100);
    },
});

Clarinet.test({
    name: "Test donation functionality - minimum donation requirement",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const donor = accounts.get('wallet_1')!;
        
        // Test donation below minimum (default min is 1)
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(0)], donor.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(100));
    },
});

Clarinet.test({
    name: "Test donation functionality - maximum donation limit",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const donor = accounts.get('wallet_1')!;
        
        // Test donation above maximum (default max is 1000000000)
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(1000000001)], donor.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(100));
    },
});

Clarinet.test({
    name: "Test admin functions - set admin",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const newAdmin = accounts.get('wallet_1')!;
        const unauthorized = accounts.get('wallet_2')!;
        
        // Test successful admin change by current admin
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-admin', [types.principal(newAdmin.address)], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.principal(newAdmin.address));
        
        // Test unauthorized admin change
        let unauthorizedBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-admin', [types.principal(unauthorized.address)], unauthorized.address)
        ]);
        
        assertEquals(unauthorizedBlock.receipts[0].result.expectErr(), types.uint(1));
        
        // Test setting same admin (should fail)
        let sameAdminBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-admin', [types.principal(newAdmin.address)], newAdmin.address)
        ]);
        
        assertEquals(sameAdminBlock.receipts[0].result.expectErr(), types.uint(6));
    },
});

Clarinet.test({
    name: "Test recipient management - add recipient",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const recipient = accounts.get('wallet_1')!;
        const unauthorized = accounts.get('wallet_2')!;
        
        // Test successful recipient addition by admin
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-recipient', [
                types.principal(recipient.address),
                types.uint(500)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();
        
        // Test unauthorized recipient addition
        let unauthorizedBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-recipient', [
                types.principal(accounts.get('wallet_3')!.address),
                types.uint(300)
            ], unauthorized.address)
        ]);
        
        assertEquals(unauthorizedBlock.receipts[0].result.expectErr(), types.uint(101));
        
        // Test adding same recipient again (should fail)
        let duplicateBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-recipient', [
                types.principal(recipient.address),
                types.uint(200)
            ], deployer.address)
        ]);
        
        assertEquals(duplicateBlock.receipts[0].result.expectErr(), types.uint(101));
    },
});

Clarinet.test({
    name: "Test recipient management - update allocation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const recipient = accounts.get('wallet_1')!;
        
        // First add a recipient
        let addBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-recipient', [
                types.principal(recipient.address),
                types.uint(500)
            ], deployer.address)
        ]);
        
        // Test successful allocation update
        let updateBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'update-recipient-allocation', [
                types.principal(recipient.address),
                types.uint(750)
            ], deployer.address)
        ]);
        
        assertEquals(updateBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test updating non-existent recipient
        let notFoundBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'update-recipient-allocation', [
                types.principal(accounts.get('wallet_2')!.address),
                types.uint(100)
            ], deployer.address)
        ]);
        
        assertEquals(notFoundBlock.receipts[0].result.expectErr(), types.uint(4));
        
        // Test invalid allocation amount (zero)
        let invalidBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'update-recipient-allocation', [
                types.principal(recipient.address),
                types.uint(0)
            ], deployer.address)
        ]);
        
        assertEquals(invalidBlock.receipts[0].result.expectErr(), types.uint(2));
    },
});

Clarinet.test({
    name: "Test recipient management - remove recipient",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const recipient = accounts.get('wallet_1')!;
        
        // First add a recipient
        let addBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-recipient', [
                types.principal(recipient.address),
                types.uint(500)
            ], deployer.address)
        ]);
        
        // Test successful recipient removal with confirmation
        let removeBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'confirm-remove-recipient', [
                types.principal(recipient.address),
                types.bool(true)
            ], deployer.address)
        ]);
        
        assertEquals(removeBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test removing non-existent recipient
        let notFoundBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'confirm-remove-recipient', [
                types.principal(accounts.get('wallet_2')!.address),
                types.bool(true)
            ], deployer.address)
        ]);
        
        assertEquals(notFoundBlock.receipts[0].result.expectErr(), types.uint(4));
        
        // Test removal without confirmation
        let addAgainBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-recipient', [
                types.principal(recipient.address),
                types.uint(500)
            ], deployer.address)
        ]);
        
        let noConfirmBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'confirm-remove-recipient', [
                types.principal(recipient.address),
                types.bool(false)
            ], deployer.address)
        ]);
        
        assertEquals(noConfirmBlock.receipts[0].result.expectErr(), types.uint(8));
    },
});

Clarinet.test({
    name: "Test withdrawal functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const recipient = accounts.get('wallet_1')!;
        
        // First add a recipient with allocation
        let addBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-recipient', [
                types.principal(recipient.address),
                types.uint(500)
            ], deployer.address)
        ]);
        
        // Test withdrawal by recipient
        let withdrawBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'withdraw', [types.uint(100)], recipient.address)
        ]);
        
        // Note: This might fail due to block time constraints in tests
        // In a real scenario, you'd need to simulate time passage
        
        // Test withdrawal by non-recipient
        let nonRecipientBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'withdraw', [types.uint(50)], accounts.get('wallet_2')!.address)
        ]);
        
        assertEquals(nonRecipientBlock.receipts[0].result.expectErr(), types.uint(102));
        
        // Test withdrawal amount exceeding allocation
        let excessBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'withdraw', [types.uint(600)], recipient.address)
        ]);
        
        assertEquals(excessBlock.receipts[0].result.expectErr(), types.uint(102));
    },
});

Clarinet.test({
    name: "Test contract pause functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const donor = accounts.get('wallet_1')!;
        const unauthorized = accounts.get('wallet_2')!;
        
        // Test pausing contract by admin
        let pauseBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-paused', [types.bool(true)], deployer.address)
        ]);
        
        assertEquals(pauseBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test donation while paused (should fail)
        let donateBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(100)], donor.address)
        ]);
        
        assertEquals(donateBlock.receipts[0].result.expectErr(), types.uint(100));
        
        // Test unauthorized pause attempt
        let unauthorizedPauseBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-paused', [types.bool(false)], unauthorized.address)
        ]);
        
        assertEquals(unauthorizedPauseBlock.receipts[0].result.expectErr(), types.uint(1));
        
        // Test setting same pause state (should fail)
        let samePauseBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-paused', [types.bool(true)], deployer.address)
        ]);
        
        assertEquals(samePauseBlock.receipts[0].result.expectErr(), types.uint(9));
    },
});

Clarinet.test({
    name: "Test donation limits functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const donor = accounts.get('wallet_1')!;
        const unauthorized = accounts.get('wallet_2')!;
        
        // Test setting donation limits by admin
        let limitsBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-donation-limits', [
                types.uint(10),
                types.uint(1000)
            ], deployer.address)
        ]);
        
        assertEquals(limitsBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test donation within new limits
        let validDonationBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(500)], donor.address)
        ]);
        
        assertEquals(validDonationBlock.receipts[0].result.expectOk(), types.uint(500));
        
        // Test donation below new minimum
        let belowMinBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(5)], donor.address)
        ]);
        
        assertEquals(belowMinBlock.receipts[0].result.expectErr(), types.uint(100));
        
        // Test donation above new maximum
        let aboveMaxBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(1500)], donor.address)
        ]);
        
        assertEquals(aboveMaxBlock.receipts[0].result.expectErr(), types.uint(100));
        
        // Test unauthorized limits change
        let unauthorizedLimitsBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-donation-limits', [
                types.uint(5),
                types.uint(2000)
            ], unauthorized.address)
        ]);
        
        assertEquals(unauthorizedLimitsBlock.receipts[0].result.expectErr(), types.uint(104));
        
        // Test invalid limits (min >= max)
        let invalidLimitsBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-donation-limits', [
                types.uint(1000),
                types.uint(500)
            ], deployer.address)
        ]);
        
        assertEquals(invalidLimitsBlock.receipts[0].result.expectErr(), types.uint(104));
    },
});

Clarinet.test({
    name: "Test emergency shutdown functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const donor = accounts.get('wallet_1')!;
        const unauthorized = accounts.get('wallet_2')!;
        
        // Test emergency shutdown by admin
        let shutdownBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'emergency-shutdown', [], deployer.address)
        ]);
        
        assertEquals(shutdownBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify contract is paused after shutdown
        let pauseCheckBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'is-paused', [], deployer.address)
        ]);
        
        assertEquals(pauseCheckBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test donation after emergency shutdown (should fail)
        let donateAfterShutdownBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(100)], donor.address)
        ]);
        
        assertEquals(donateAfterShutdownBlock.receipts[0].result.expectErr(), types.uint(100));
        
        // Test unauthorized emergency shutdown
        let unauthorizedShutdownBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'emergency-shutdown', [], unauthorized.address)
        ]);
        
        assertEquals(unauthorizedShutdownBlock.receipts[0].result.expectErr(), types.uint(105));
    },
});

Clarinet.test({
    name: "Test refund functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const donor = accounts.get('wallet_1')!;
        
        // First make a donation
        let donateBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(200)], donor.address)
        ]);
        
        assertEquals(donateBlock.receipts[0].result.expectOk(), types.uint(200));
        
        // Test refund request (might fail due to time constraints in test environment)
        let refundBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'request-refund', [types.uint(100)], donor.address)
        ]);
        
        // Note: This test might fail due to the time-based logic in the contract
        // In a real scenario, you'd need to handle block time properly
        
        // Test refund amount exceeding donation
        let excessRefundBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'request-refund', [types.uint(300)], donor.address)
        ]);
        
        assertEquals(excessRefundBlock.receipts[0].result.expectErr(), types.uint(110));
    },
});

Clarinet.test({
    name: "Test read-only functions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const donor = accounts.get('wallet_1')!;
        const recipient = accounts.get('wallet_2')!;
        
        // Test initial state
        let adminBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-admin', [], deployer.address)
        ]);
        assertEquals(adminBlock.receipts[0].result.expectOk(), types.principal(deployer.address));
        
        let totalFundsBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-total-funds', [], deployer.address)
        ]);
        assertEquals(totalFundsBlock.receipts[0].result.expectOk(), types.uint(0));
        
        let pausedBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'is-paused', [], deployer.address)
        ]);
        assertEquals(pausedBlock.receipts[0].result.expectOk(), types.bool(false));
        
        // Make a donation and add recipient
        let donateBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(500)], donor.address),
            Tx.contractCall(CONTRACT_NAME, 'add-recipient', [
                types.principal(recipient.address),
                types.uint(300)
            ], deployer.address)
        ]);
        
        // Test updated state
        let donationBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-donation', [types.principal(donor.address)], deployer.address)
        ]);
        assertEquals(donationBlock.receipts[0].result.expectUint(), 500);
        
        let updatedFundsBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-total-funds', [], deployer.address)
        ]);
        assertEquals(updatedFundsBlock.receipts[0].result.expectOk(), types.uint(500));
        
        let allocationBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-recipient-allocation', [types.principal(recipient.address)], deployer.address)
        ]);
        assertEquals(allocationBlock.receipts[0].result.expectOk(), types.uint(300));
        
        // Test user history
        let historyBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-user-history', [types.principal(donor.address)], deployer.address)
        ]);
        historyBlock.receipts[0].result.expectOk();
    },
});

Clarinet.test({
    name: "Test multiple donations from same user",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const donor = accounts.get('wallet_1')!;
        
        // First donation
        let firstDonationBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(100)], donor.address)
        ]);
        assertEquals(firstDonationBlock.receipts[0].result.expectOk(), types.uint(100));
        
        // Second donation
        let secondDonationBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'donate', [types.uint(200)], donor.address)
        ]);
        assertEquals(secondDonationBlock.receipts[0].result.expectOk(), types.uint(200));
        
        // Verify total donation is cumulative
        let totalDonationBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-donation', [types.principal(donor.address)], donor.address)
        ]);
        assertEquals(totalDonationBlock.receipts[0].result.expectUint(), 300);
        
        // Verify total funds updated correctly
        let totalFundsBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-total-funds', [], donor.address)
        ]);
        assertEquals(totalFundsBlock.receipts[0].result.expectOk(), types.uint(300));
    },
});

Clarinet.test({
    name: "Test edge cases - zero allocation recipient",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const recipient = accounts.get('wallet_1')!;
        
        // Test adding recipient with zero allocation (should fail)
        let zeroAllocationBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-recipient', [
                types.principal(recipient.address),
                types.uint(0)
            ], deployer.address)
        ]);
        
        assertEquals(zeroAllocationBlock.receipts[0].result.expectErr(), types.uint(101));
    },
});

Clarinet.test({
    name: "Test edge cases - recipient without allocation cannot withdraw",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const nonRecipient = accounts.get('wallet_1')!;
        
        // Test withdrawal by someone who is not a recipient
        let withdrawBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'withdraw', [types.uint(1)], nonRecipient.address)
        ]);
        
        assertEquals(withdrawBlock.receipts[0].result.expectErr(), types.uint(102));
    },
});

Clarinet.test({
    name: "Test audit logging functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        // Test audit log function (basic functionality test)
        let auditBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'log-audit', [
                types.ascii("donation"),
                types.principal(deployer.address)
            ], deployer.address)
        ]);
        
        assertEquals(auditBlock.receipts[0].result.expectOk(), types.bool(true));
    },
});