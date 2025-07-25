import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const CONTRACT_NAME = 'blockchain-disaster-recovery-fund';

Clarinet.test({
    name: "Test governance contract - admin management",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const newAdmin = accounts.get('wallet_1')!;
        const unauthorized = accounts.get('wallet_2')!;
        
        // Test initial admin is deployer
        let getAdminBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-admin', [], deployer.address)
        ]);
        assertEquals(getAdminBlock.receipts[0].result.expectOk(), types.principal(deployer.address));
        
        // Test successful admin change
        let setAdminBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-admin', [types.principal(newAdmin.address)], deployer.address)
        ]);
        assertEquals(setAdminBlock.receipts[0].result.expectOk(), types.principal(newAdmin.address));
        
        // Test unauthorized admin change
        let unauthorizedBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-admin', [types.principal(unauthorized.address)], unauthorized.address)
        ]);
        assertEquals(unauthorizedBlock.receipts[0].result.expectErr(), types.uint(401));
        
        // Test setting same admin (should fail)
        let sameAdminBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-admin', [types.principal(newAdmin.address)], newAdmin.address)
        ]);
        assertEquals(sameAdminBlock.receipts[0].result.expectErr(), types.uint(401));
        
        // Test setting zero address (should fail)
        let zeroAddressBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-admin', [types.principal('SP000000000000000000002Q6VF78')], newAdmin.address)
        ]);
        assertEquals(zeroAddressBlock.receipts[0].result.expectErr(), types.uint(401));
    },
});

Clarinet.test({
    name: "Test governance contract - donation limits",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const unauthorized = accounts.get('wallet_1')!;
        
        // Test initial minimum donation
        let getMinBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-min-donation', [], deployer.address)
        ]);
        assertEquals(getMinBlock.receipts[0].result.expectOk(), types.uint(10));
        
        // Test setting minimum donation by admin
        let setMinBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-min-donation', [types.uint(50)], deployer.address)
        ]);
        assertEquals(setMinBlock.receipts[0].result.expectOk(), types.uint(50));
        
        // Test unauthorized minimum donation change
        let unauthorizedMinBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-min-donation', [types.uint(100)], unauthorized.address)
        ]);
        assertEquals(unauthorizedMinBlock.receipts[0].result.expectErr(), types.uint(401));
        
        // Test invalid minimum donation (zero)
        let zeroMinBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-min-donation', [types.uint(0)], deployer.address)
        ]);
        assertEquals(zeroMinBlock.receipts[0].result.expectErr(), types.uint(402));
    },
});

Clarinet.test({
    name: "Test governance contract - withdrawal limits",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const unauthorized = accounts.get('wallet_1')!;
        
        // Test initial withdrawal limit
        let getWithdrawalLimitBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-withdrawal-limit', [], deployer.address)
        ]);
        assertEquals(getWithdrawalLimitBlock.receipts[0].result.expectOk(), types.uint(1000));
        
        // Test setting withdrawal limit by admin
        let setWithdrawalLimitBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-withdrawal-limit', [types.uint(2000)], deployer.address)
        ]);
        assertEquals(setWithdrawalLimitBlock.receipts[0].result.expectOk(), types.uint(2000));
        
        // Test unauthorized withdrawal limit change
        let unauthorizedWithdrawalBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-withdrawal-limit', [types.uint(5000)], unauthorized.address)
        ]);
        assertEquals(unauthorizedWithdrawalBlock.receipts[0].result.expectErr(), types.uint(401));
        
        // Test invalid withdrawal limit (zero)
        let zeroWithdrawalBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-withdrawal-limit', [types.uint(0)], deployer.address)
        ]);
        assertEquals(zeroWithdrawalBlock.receipts[0].result.expectErr(), types.uint(403));
    },
});

Clarinet.test({
    name: "Test governance contract - validation functions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        // Test donation validation - valid amount
        let validDonationBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'validate-donation', [types.uint(100)], deployer.address)
        ]);
        assertEquals(validDonationBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test donation validation - below minimum
        let invalidDonationBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'validate-donation', [types.uint(5)], deployer.address)
        ]);
        assertEquals(invalidDonationBlock.receipts[0].result.expectErr(), types.uint(404));
        
        // Test withdrawal validation - valid amount
        let validWithdrawalBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'validate-withdrawal', [types.uint(500)], deployer.address)
        ]);
        assertEquals(validWithdrawalBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test withdrawal validation - exceeds limit
        let invalidWithdrawalBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'validate-withdrawal', [types.uint(1500)], deployer.address)
        ]);
        assertEquals(invalidWithdrawalBlock.receipts[0].result.expectErr(), types.uint(405));
    },
});

Clarinet.test({
    name: "Test governance contract - signer management",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const signer1 = accounts.get('wallet_1')!;
        const signer2 = accounts.get('wallet_2')!;
        const unauthorized = accounts.get('wallet_3')!;
        
        // Test adding signers by admin
        let addSigner1Block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-signer', [types.principal(signer1.address)], deployer.address)
        ]);
        assertEquals(addSigner1Block.receipts[0].result.expectOk(), types.bool(true));
        
        let addSigner2Block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-signer', [types.principal(signer2.address)], deployer.address)
        ]);
        assertEquals(addSigner2Block.receipts[0].result.expectOk(), types.bool(true));
        
        // Test checking if address is signer
        let isSignerBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'is-signer', [types.principal(signer1.address)], deployer.address)
        ]);
        assertEquals(isSignerBlock.receipts[0].result, types.bool(true));
        
        // Test adding duplicate signer (should fail)
        let duplicateSignerBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-signer', [types.principal(signer1.address)], deployer.address)
        ]);
        assertEquals(duplicateSignerBlock.receipts[0].result.expectErr(), types.uint(403));
        
        // Test unauthorized signer addition
        let unauthorizedAddBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-signer', [types.principal(unauthorized.address)], unauthorized.address)
        ]);
        assertEquals(unauthorizedAddBlock.receipts[0].result.expectErr(), types.uint(401));
        
        // Test removing signer by admin
        let removeSignerBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'remove-signer', [types.principal(signer1.address)], deployer.address)
        ]);
        assertEquals(removeSignerBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test removing non-existent signer (should fail)
        let removeNonExistentBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'remove-signer', [types.principal(unauthorized.address)], deployer.address)
        ]);
        assertEquals(removeNonExistentBlock.receipts[0].result.expectErr(), types.uint(404));
        
        // Test unauthorized signer removal
        let unauthorizedRemoveBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'remove-signer', [types.principal(signer2.address)], unauthorized.address)
        ]);
        assertEquals(unauthorizedRemoveBlock.receipts[0].result.expectErr(), types.uint(401));
    },
});

Clarinet.test({
    name: "Test governance contract - admin change function",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const newAdmin = accounts.get('wallet_1')!;
        const unauthorized = accounts.get('wallet_2')!;
        
        // Test successful admin change
        let changeAdminBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'change-admin', [types.principal(newAdmin.address)], deployer.address)
        ]);
        assertEquals(changeAdminBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test unauthorized admin change
        let unauthorizedChangeBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'change-admin', [types.principal(unauthorized.address)], unauthorized.address)
        ]);
        assertEquals(unauthorizedChangeBlock.receipts[0].result.expectErr(), types.uint(401));
        
        // Test setting same admin (should fail)
        let sameAdminBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'change-admin', [types.principal(newAdmin.address)], newAdmin.address)
        ]);
        assertEquals(sameAdminBlock.receipts[0].result.expectErr(), types.uint(403));
        
        // Test setting zero address (should fail)
        let zeroAddressBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'change-admin', [types.principal('SP000000000000000000002Q6VF78')], newAdmin.address)
        ]);
        assertEquals(zeroAddressBlock.receipts[0].result.expectErr(), types.uint(404));
    },
});

Clarinet.test({
    name: "Test governance contract - transaction proposal system",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const signer1 = accounts.get('wallet_1')!;
        const nonSigner = accounts.get('wallet_2')!;
        
        // First add a signer
        let addSignerBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-signer', [types.principal(signer1.address)], deployer.address)
        ]);
        
        // Test transaction proposal by signer
        let proposeBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'propose-transaction', [
                types.ascii("transfer"),
                types.list([types.int(100), types.int(200)])
            ], signer1.address)
        ]);
        assertEquals(proposeBlock.receipts[0].result.expectOk(), types.uint(0));
        
        // Test transaction proposal by non-signer (should fail)
        let unauthorizedProposeBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'propose-transaction', [
                types.ascii("transfer"),
                types.list([types.int(50)])
            ], nonSigner.address)
        ]);
        assertEquals(unauthorizedProposeBlock.receipts[0].result.expectErr(), types.uint(401));
        
        // Test empty action string (should fail)
        let emptyActionBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'propose-transaction', [
                types.ascii(""),
                types.list([types.int(100)])
            ], signer1.address)
        ]);
        assertEquals(emptyActionBlock.receipts[0].result.expectErr(), types.uint(402));
        
        // Test getting pending transaction
        let getPendingBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-pending-transaction', [types.uint(0)], deployer.address)
        ]);
        getPendingBlock.receipts[0].result.expectSome();
        
        // Test getting transaction nonce
        let getNonceBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-tx-nonce', [], deployer.address)
        ]);
        assertEquals(getNonceBlock.receipts[0].result.expectOk(), types.uint(1));
    },
});

Clarinet.test({
    name: "Test governance contract - required signatures management",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const unauthorized = accounts.get('wallet_1')!;
        
        // Test initial required signatures
        let getRequiredBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-required-signatures', [], deployer.address)
        ]);
        assertEquals(getRequiredBlock.receipts[0].result.expectOk(), types.uint(3));
        
        // Test setting required signatures by admin
        let setRequiredBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-required-signatures', [types.uint(5)], deployer.address)
        ]);
        assertEquals(setRequiredBlock.receipts[0].result.expectOk(), types.bool(true));
        
        // Test unauthorized required signatures change
        let unauthorizedRequiredBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-required-signatures', [types.uint(2)], unauthorized.address)
        ]);
        assertEquals(unauthorizedRequiredBlock.receipts[0].result.expectErr(), types.uint(401));
        
        // Test invalid required signatures (zero)
        let zeroRequiredBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'set-required-signatures', [types.uint(0)], deployer.address)
        ]);
        assertEquals(zeroRequiredBlock.receipts[0].result.expectErr(), types.uint(403));
    },
});

Clarinet.test({
    name: "Test governance contract - edge cases and boundary conditions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const signer1 = accounts.get('wallet_1')!;
        
        // Add signer for transaction proposals
        let addSignerBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-signer', [types.principal(signer1.address)], deployer.address)
        ]);
        
        // Test maximum length action string (50 characters)
        let maxActionBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'propose-transaction', [
                types.ascii("12345678901234567890123456789012345678901234567890"), // 50 chars
                types.list([types.int(1)])
            ], signer1.address)
        ]);
        assertEquals(maxActionBlock.receipts[0].result.expectOk(), types.uint(0));
        
        // Test action string exceeding 50 characters (should fail)
        let oversizeActionBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'propose-transaction', [
                types.ascii("123456789012345678901234567890123456789012345678901"), // 51 chars
                types.list([types.int(1)])
            ], signer1.address)
        ]);
        assertEquals(oversizeActionBlock.receipts[0].result.expectErr(), types.uint(402));
        
        // Test maximum parameters list (10 items)
        let maxParamsBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'propose-transaction', [
                types.ascii("test"),
                types.list([
                    types.int(1), types.int(2), types.int(3), types.int(4), types.int(5),
                    types.int(6), types.int(7), types.int(8), types.int(9), types.int(10)
                ])
            ], signer1.address)
        ]);
        assertEquals(maxParamsBlock.receipts[0].result.expectOk(), types.uint(1));
        
        // Test parameters list exceeding 10 items (should fail)
        let oversizeParamsBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'propose-transaction', [
                types.ascii("test"),
                types.list([
                    types.int(1), types.int(2), types.int(3), types.int(4), types.int(5),
                    types.int(6), types.int(7), types.int(8), types.int(9), types.int(10),
                    types.int(11)
                ])
            ], signer1.address)
        ]);
        assertEquals(oversizeParamsBlock.receipts[0].result.expectErr(), types.uint(403));
    },
});

Clarinet.test({
    name: "Test governance contract - comprehensive read-only functions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const signer1 = accounts.get('wallet_1')!;
        const nonSigner = accounts.get('wallet_2')!;
        
        // Test all read-only functions with initial state
        let adminBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-admin', [], deployer.address),
            Tx.contractCall(CONTRACT_NAME, 'get-min-donation', [], deployer.address),
            Tx.contractCall(CONTRACT_NAME, 'get-withdrawal-limit', [], deployer.address),
            Tx.contractCall(CONTRACT_NAME, 'get-required-signatures', [], deployer.address),
            Tx.contractCall(CONTRACT_NAME, 'get-tx-nonce', [], deployer.address)
        ]);
        
        assertEquals(adminBlock.receipts[0].result.expectOk(), types.principal(deployer.address));
        assertEquals(adminBlock.receipts[1].result.expectOk(), types.uint(10));
        assertEquals(adminBlock.receipts[2].result.expectOk(), types.uint(1000));
        assertEquals(adminBlock.receipts[3].result.expectOk(), types.uint(3));
        assertEquals(adminBlock.receipts[4].result.expectOk(), types.uint(0));
        
        // Add signer and test is-signer function
        let addSignerBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'add-signer', [types.principal(signer1.address)], deployer.address)
        ]);
        
        let signerCheckBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'is-signer', [types.principal(signer1.address)], deployer.address),
            Tx.contractCall(CONTRACT_NAME, 'is-signer', [types.principal(nonSigner.address)], deployer.address)
        ]);
        
        assertEquals(signerCheckBlock.receipts[0].result, types.bool(true));
        assertEquals(signerCheckBlock.receipts[1].result, types.bool(false));
        
        // Test getting non-existent pending transaction
        let nonExistentTxBlock = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, 'get-pending-transaction', [types.uint(999)], deployer.address)
        ]);
        assertEquals(nonExistentTxBlock.receipts[0].result, types.none());
    },
});