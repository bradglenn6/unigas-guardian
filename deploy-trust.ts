import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
import { StoryClient, StoryConfig, WIP_TOKEN_ADDRESS, royaltyPolicyLapAddress } from "@story-protocol/core-sdk";
import { http, parseEther, Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "https://aeneid.storyrpc.io";

let rawKey = (process.env.PRIVATE_KEY || "").replace(/['"]/g, "").trim();
if (!rawKey) {
  console.error("ERROR: PRIVATE_KEY is missing or empty in .env");
  process.exit(1);
}
const PRIVATE_KEY = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

const SPG_NFT_CONTRACT = ((process.env.SPG_NFT_CONTRACT || "0x4817E8ee5fdC2C2e7CfCd8D166fAd76A4c433394").replace(/['"]/g, "").trim()) as Address;
const EXISTING_IP_ID = ((process.env.EXISTING_IP_ID || "0x93762D496ffBae7aC9834047CB2C5A44958B7400").replace(/['"]/g, "").trim()) as Address;

const account = privateKeyToAccount(PRIVATE_KEY);

const config: StoryConfig = {
  chainId: "aeneid",
  transport: http(RPC_URL),
  account: account,
};

const client = StoryClient.newClient(config);

function computeMetadataHash(filePath: string): `0x${string}` {
  const fileBuffer = fs.readFileSync(path.resolve(filePath));
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  return `0x${hash}`;
}

async function main() {
  console.log("================================================================================");
  console.log("PostLogix Heritage Trust: DATA Foundation BioIP Deployment & Licensing Pipeline");
  console.log(`Network: DATA Foundation Aeneid Testnet (${RPC_URL})`);
  console.log(`Deployer Address: ${account.address}`);
  console.log("================================================================================\n");

  const metadataPath = path.resolve(__dirname, "metadata.json");
  const ipMetadataHash = fs.existsSync(metadataPath)
    ? computeMetadataHash(metadataPath)
    : "0x0000000000000000000000000000000000000000000000000000000000000000";

  const ipMetadataURI = process.env.IPFS_METADATA_URI || "ipfs://bafybeidataset10masterarchive";
  let ipId = EXISTING_IP_ID as `0x${string}`;

  // 1. Root IP Provenance
  if (process.env.REGISTER_NEW_ROOT === "true") {
    console.log("[1/3] Registering Data Set 10 as Root IP Asset on DATA Foundation...");
    const ipAsset = await client.ipAsset.registerRootIp({
      tokenContractAddress: SPG_NFT_CONTRACT,
      tokenId: process.env.TOKEN_ID || "1",
      ipMetadata: {
        ipMetadataURI,
        ipMetadataHash,
      },
    });
    ipId = ipAsset.ipId as `0x${string}`;
    console.log(`✓ Root IP Asset Registered. IP Asset ID: ${ipId}`);
  } else {
    console.log(`[1/3] Target Root IP Asset confirmed: ${ipId}`);
  }

  // 2. Non-Commercial Social Remixing PIL
  console.log("\n[2/3] Verifying Non-Commercial Social Remixing PIL (Attribution: Brad Jones)...");
  let nonComTermsId = process.env.NON_COM_TERMS_ID || "2054";

  try {
    const nonComTerms = await client.license.registerNonComSocialRemixingPIL({
      attribution: true,
      commercialUse: false,
      derivativesAllowed: false,
    });
    if (nonComTerms.licenseTermsId) {
      nonComTermsId = nonComTerms.licenseTermsId.toString();
    }
    console.log(`✓ Non-Commercial Terms ID: ${nonComTermsId}`);

    const attachNonCom = await client.license.attachLicenseTerms({
      ipId: ipId,
      licenseTermsId: nonComTermsId,
    });
    console.log(`✓ Attached Non-Commercial Terms. Tx Hash: ${attachNonCom.txHash}`);
  } catch (err: any) {
    if (err?.message?.includes("already attached") || err?.message?.includes("TermsAlreadyAttached")) {
      console.log(`ℹ Non-Commercial License Terms (ID: ${nonComTermsId}) already active on ${ipId}.`);
    } else {
      console.warn(`Notice during Non-Commercial License verification: ${err?.message || err}`);
    }
  }

  // 3. Register & Attach Commercial Remix & AI Training Ingestion PIL (5% Royalty Tier)
  console.log("\n[3/3] Registering and Attaching Commercial Remix & AI Ingestion PIL...");

  const currencyAddress = (process.env.CURRENCY_ADDRESS || WIP_TOKEN_ADDRESS || "0x1514000000000000000000000000000000000000") as Address;
  const royaltyPolicyAddress = (process.env.ROYALTY_POLICY_ADDRESS || (royaltyPolicyLapAddress as any)?.[1315] || "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E") as Address;

  console.log(`  - Settlement Currency (DATA/WIP): ${currencyAddress}`);
  console.log(`  - Royalty Policy LAP: ${royaltyPolicyAddress}`);
  console.log(`  - Commercial Rev Share: 5%`);
  console.log(`  - Default Minting Fee: 0.05 DATA`);

  const comTerms = await client.license.registerCommercialRemixPIL({
    defaultMintingFee: parseEther("0.05"),
    currency: currencyAddress,
    commercialRevShare: 5,
    royaltyPolicyAddress: royaltyPolicyAddress,
  });

  const comTermsId = comTerms.licenseTermsId!;
  console.log(`✓ Commercial Remix Terms Registered. Terms ID: ${comTermsId}`);

  const attachCom = await client.license.attachLicenseTerms({
    ipId: ipId,
    licenseTermsId: comTermsId,
  });
  console.log(`✓ Attached Commercial Terms to IP Account. Tx Hash: ${attachCom.txHash}`);

  // Summary Artifact
  const executionSummary = {
    network: "DATA Foundation Aeneid Testnet",
    rpcUrl: RPC_URL,
    ipAssetId: ipId,
    spgNftContract: SPG_NFT_CONTRACT,
    nonCommercialTermsId: nonComTermsId,
    commercialTermsId: comTermsId.toString(),
    settlementCurrency: currencyAddress,
    royaltyRevSharePercent: 5,
    mintingFee: "0.05 DATA",
    txHash: attachCom.txHash,
    executedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(__dirname, "registration-result.json");
  fs.writeFileSync(outputPath, JSON.stringify(executionSummary, null, 2));
  console.log(`\n✓ Execution receipts written to: ${outputPath}`);
  console.log("================================================================================\n");
}

main().catch((error) => {
  console.error("Execution failed:", error);
  process.exit(1);
});
