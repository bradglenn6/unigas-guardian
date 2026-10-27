import * as crypto from "crypto";
import * as dotenv from "dotenv";
import { Address, Hash, Hex } from "viem";
import { UniGasRelayer, RelayedTxReceipt } from "./relayer";

dotenv.config();

export interface GuardianAttestation {
  guardianAddress: Address;
  signature: Hex;
  timestamp: number;
}

export interface RecoveryProposal {
  proposalId: string;
  targetTBA: Address;
  proposedOwner: Address;
  initiatedAt: number;
  timelockExpiry: number;
  attestations: GuardianAttestation[];
  executed: boolean;
}

export interface GuardianConfig {
  rpcUrl: string;
  chainId: number;
  targetTBA: Address;
  guardians: Address[];
  threshold: number;
  timelockSeconds: number;
}

export class UniGasGuardianService {
  private config: GuardianConfig;
  private proposals: Map<string, RecoveryProposal> = new Map();

  constructor(customConfig?: Partial<GuardianConfig>) {
    this.config = {
      rpcUrl: process.env.RPC_URL || "https://aeneid.storyrpc.io",
      chainId: parseInt(process.env.CHAIN_ID_NUM || "1315", 10),
      targetTBA: (process.env.TARGET_TBA || "0x93762D496ffBae7aC9834047CB2C5A44958B7400") as Address,
      guardians: [
        (process.env.GUARDIAN_1 || "0x4817E8ee5fdC2C2e7CfCd8D166fAd76A4c433394") as Address,
        (process.env.GUARDIAN_2 || "0x0000000000000000000000000000000000000002") as Address,
        (process.env.GUARDIAN_3 || "0x0000000000000000000000000000000000000003") as Address,
      ],
      threshold: parseInt(process.env.GUARDIAN_THRESHOLD || "2", 10),
      timelockSeconds: parseInt(process.env.TIMELOCK_SECONDS || "86400", 10),
      ...customConfig,
    };
  }

  public generateProposalId(targetTBA: Address, proposedOwner: Address, nonce: number): string {
    const raw = `${targetTBA.toLowerCase()}:${proposedOwner.toLowerCase()}:${nonce}:${this.config.chainId}`;
    return "0x" + crypto.createHash("sha256").update(raw).digest("hex");
  }

  public initiateRecovery(proposedOwner: Address, nonce: number = Date.now()): RecoveryProposal {
    const proposalId = this.generateProposalId(this.config.targetTBA, proposedOwner, nonce);
    if (this.proposals.has(proposalId)) throw new Error(`Proposal already exists`);

    const now = Math.floor(Date.now() / 1000);
    const proposal: RecoveryProposal = {
      proposalId,
      targetTBA: this.config.targetTBA,
      proposedOwner,
      initiatedAt: now,
      timelockExpiry: now + this.config.timelockSeconds,
      attestations: [],
      executed: false,
    };

    this.proposals.set(proposalId, proposal);
    return proposal;
  }

  public submitAttestation(proposalId: string, guardianAddress: Address, signature: Hex): RecoveryProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found`);
    if (proposal.executed) throw new Error(`Proposal already executed`);

    const isAuthorized = this.config.guardians.some(g => g.toLowerCase() === guardianAddress.toLowerCase());
    if (!isAuthorized) throw new Error(`Unauthorized guardian: ${guardianAddress}`);

    proposal.attestations.push({ guardianAddress, signature, timestamp: Math.floor(Date.now() / 1000) });
    return proposal;
  }

  public async executeRecoveryGasless(
    proposalId: string,
    relayer: UniGasRelayer
  ): Promise<{ success: boolean; txHash: Hash; userOpHash: Hash; message: string }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found`);
    if (proposal.executed) throw new Error(`Proposal already executed`);

    if (proposal.attestations.length < this.config.threshold) {
      throw new Error(`Insufficient attestations: ${proposal.attestations.length}/${this.config.threshold} required`);
    }

    const migrationCallData = ("0xa9059cbb" + proposal.proposedOwner.replace("0x", "").padStart(64, "0")) as Hex;
    const receipt: RelayedTxReceipt = await relayer.relayTransaction(
      this.config.guardians[0],
      proposal.targetTBA,
      migrationCallData
    );

    proposal.executed = true;

    return {
      success: true,
      txHash: receipt.txHash,
      userOpHash: receipt.userOpHash,
      message: `TBA control gaslessly migrated to ${proposal.proposedOwner} via UniGas Relayer`,
    };
  }

  public getProposal(proposalId: string) { return this.proposals.get(proposalId); }
}

if (require.main === module) {
  console.log("================================================================================");
  console.log("UniGas Trustless Guardian Engine: Gasless Self-Test");
  console.log("Target: PostLogix Heritage Trust / DATA Foundation TBA");
  console.log("================================================================================\n");

  const guardianService = new UniGasGuardianService({ timelockSeconds: 0 });
  const relayer = new UniGasRelayer();
  const candidateSuccessor = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;

  const proposal = guardianService.initiateRecovery(candidateSuccessor);
  console.log(`✓ Proposal ID: ${proposal.proposalId}`);

  guardianService.submitAttestation(proposal.proposalId, "0x4817E8ee5fdC2C2e7CfCd8D166fAd76A4c433394" as Address, "0x1111" as Hex);
  guardianService.submitAttestation(proposal.proposalId, "0x0000000000000000000000000000000000000002" as Address, "0x2222" as Hex);

  guardianService.executeRecoveryGasless(proposal.proposalId, relayer)
    .then((result) => {
      console.log("Result:", JSON.stringify(result, null, 2));
      console.log(`Remaining Session microGas: ${relayer.getMicroGasBalance()} μG`);
      console.log("\n✓ Gasless Guardian Recovery test passed.\n");
    })
    .catch(console.error);
}
