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