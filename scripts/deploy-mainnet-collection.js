const fs = require('fs');
const path = require('path');

// Auto-detect UTF-16 LE vs UTF-8 encoding for Windows .env files
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const buffer = fs.readFileSync(envPath);
    let content;
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      content = buffer.toString('utf16le');
    } else {
      content = buffer.toString('utf8');
    }
    content = content.replace(/^\uFEFF/, '');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*\$/);
      if (match) {
        const key = match[1].trim();
        let val = (match[2] || '').trim().replace(/^["']|["']\$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (e) {}

// Enforce Mainnet RPC
const defaultMainnetRpc = "https://mainnet.storyrpc.io";
const configuredRpc = process.env.RPC_URL;
const rpcUrl = (configuredRpc && !configuredRpc.includes("aeneid")) ? configuredRpc : defaultMainnetRpc;

const CONFIG = {
  networkName: "DATA Foundation Mainnet (Homer)",
  chainId: 1514,
  rpcUrl: rpcUrl,
  spgNftName: "PostLogix Heritage Trust",
  spgNftSymbol: "PLHT",
  isPublicMinting: false,
  ipMetadataURI: "ipfs://bafkreia3x7yqpvb4g5h7l6w67yfx2vh3w2q5zflv4mvy7m6b3g5e7e4r4a",
  masterAttestationHash: "0x8eb930443983751607d19e11074639b38eed7484318df6f31ed490eb2cc4ced3",
  commercialRevSharePercent: 5,
  mintingFeeIp: "0.05",
  privateKey: process.env.PRIVATE_KEY || 
              process.env.STORY_PRIVATE_KEY || 
              process.env.DEPLOYER_PRIVATE_KEY || 
              process.env.WALLET_PRIVATE_KEY || 
              process.env.EVM_PRIVATE_KEY
};

async function main() {
  console.log("================================================================");
  console.log(`🚀 STORY PROTOCOL / DATA FOUNDATION HOMER MAINNET DEPLOYMENT`);
  console.log(`Target Network:   ${CONFIG.networkName} (Chain ID: ${CONFIG.chainId})`);
  console.log(`Primary RPC:      ${CONFIG.rpcUrl}`);
  console.log(`Metadata URI:     ${CONFIG.ipMetadataURI}`);
  console.log(`Forensic Hash:    ${CONFIG.masterAttestationHash}`);
  console.log(`Royalty Policy:   5% Commercial RevShare (Strict Integer)`);
  console.log("================================================================\n");

  if (!CONFIG.privateKey) {
    console.error("❌ ERROR: Private key not found in .env or environment.");
    process.exit(1);
  }

  let StoryClient, http, parseEther, privateKeyToAccount;
  try {
    const storySdk = await import("@story-protocol/core-sdk");
    const viem = await import("viem");
    const viemAccounts = await import("viem/accounts");

    StoryClient = storySdk.StoryClient;
    http = viem.http;
    parseEther = viem.parseEther;
    privateKeyToAccount = viemAccounts.privateKeyToAccount;
  } catch (err) {
    console.error("❌ Missing required dependencies. Run: npm install @story-protocol/core-sdk viem\n");
    process.exit(1);
  }

  const rawKey = CONFIG.privateKey.startsWith("0x") ? CONFIG.privateKey : `0x${CONFIG.privateKey}`;
  const account = privateKeyToAccount(rawKey);

  console.log(`Deployer Wallet:  ${account.address}`);
  console.log("Connecting to Homer Mainnet RPC...\n");

  // Uses "mainnet" to match @story-protocol/core-sdk@1.4.4
  const client = StoryClient.newClient({
    account,
    transport: http(CONFIG.rpcUrl),
    chainId: "mainnet"
  });

  // 1. Deploy SPG Collection
  console.log("[1/4] Deploying PostLogix SPG Collection contract...");
  const newCollection = await client.nftClient.createNFTCollection({
    name: CONFIG.spgNftName,
    symbol: CONFIG.spgNftSymbol,
    isPublicMinting: CONFIG.isPublicMinting,
    mintFeeRecipient: account.address,
    txOptions: { waitForTransaction: true }
  });
  console.log(`✔ SPG NFT Collection Deployed: ${newCollection.spgNftContract}`);

  // 2. Register Root IP Asset
  console.log("\n[2/4] Minting Token #1 and registering Root IP Asset...");
  const ipResponse = await client.ipAsset.registerRootIp({
    tokenContractAddress: newCollection.spgNftContract,
    tokenId: "1",
    ipMetadata: {
      ipMetadataURI: CONFIG.ipMetadataURI,
      ipMetadataHash: CONFIG.masterAttestationHash
    },
    txOptions: { waitForTransaction: true }
  });
  console.log(`✔ Root IP Asset Registered (ipId): ${ipResponse.ipId}`);

  // 3. Register & Attach PIL Terms
  console.log("\n[3/4] Registering Non-Commercial & Commercial PIL Terms...");
  const nonComTerms = await client.license.registerNonComSocialRemixingPIL({
    txOptions: { waitForTransaction: true }
  });
  console.log(`✔ Non-Commercial PIL Terms ID: ${nonComTerms.licenseTermsId}`);

  const comTerms = await client.license.registerCommercialRemixPIL({
    defaultMintingFee: parseEther(CONFIG.mintingFeeIp),
    commercialRevShare: CONFIG.commercialRevSharePercent,
    txOptions: { waitForTransaction: true }
  });
  console.log(`✔ Commercial PIL Terms ID:     ${comTerms.licenseTermsId}`);

  console.log("\n[4/4] Attaching license terms to Root IP...");
  await client.license.attachLicenseTerms({
    ipId: ipResponse.ipId,
    licenseTermsId: nonComTerms.licenseTermsId,
    txOptions: { waitForTransaction: true }
  });
  await client.license.attachLicenseTerms({
    ipId: ipResponse.ipId,
    licenseTermsId: comTerms.licenseTermsId,
    txOptions: { waitForTransaction: true }
  });

  console.log("\n================ HOMER MAINNET DEPLOYMENT RECEIPT ================");
  console.log(`Status:               SUCCESS`);
  console.log(`Network:              Homer Mainnet (Chain ID 1514)`);
  console.log(`Deployer Address:     ${account.address}`);
  console.log(`SPG NFT Contract:     ${newCollection.spgNftContract}`);
  console.log(`Root IP Asset (ipId): ${ipResponse.ipId}`);
  console.log(`Non-Com Terms ID:     ${nonComTerms.licenseTermsId}`);
  console.log(`Commercial Terms ID:  ${comTerms.licenseTermsId} (5% RevShare)`);
  console.log(`Metadata URI:         ${CONFIG.ipMetadataURI}`);
  console.log(`Forensic Hash:        ${CONFIG.masterAttestationHash}`);
  console.log(`StoryScan Explorer:   https://storyscan.xyz/tx/${ipResponse.txHash}`);
  console.log(`Story IP Explorer:    https://explorer.story.foundation/ipa/${ipResponse.ipId}`);
  console.log("==================================================================\n");
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  if (err.details) console.error("Details:", err.details);
  process.exit(1);
});
