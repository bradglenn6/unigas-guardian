const fs = require("fs");
const sdk = require("@story-protocol/core-sdk");

console.log("=== SDK EXPORTS ===");
console.log(Object.keys(sdk).filter(k => 
  k.toLowerCase().includes("royalty") || 
  k.toLowerCase().includes("wip") || 
  k.toLowerCase().includes("address") ||
  k.toLowerCase().includes("lap")
));

console.log("\n=== SEARCHING SDK BUNDLE ===");
const code = fs.readFileSync("node_modules/@story-protocol/core-sdk/dist/story-protocol-core-sdk.cjs.dev.js", "utf8");
const lines = code.split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("royaltyPolicyLapAddress") || lines[i].includes("RoyaltyPolicyLAP")) {
    console.log(`LAP (line ${i + 1}):`);
    for (let j = 0; j <= 6; j++) {
      if (lines[i + j]) console.log("  " + lines[i + j].trim());
    }
    break;
  }
}

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("wipAddress") || lines[i].includes("wipTokenAddress") || lines[i].includes("WipTokenAddress")) {
    console.log(`WIP (line ${i + 1}):`);
    for (let j = 0; j <= 6; j++) {
      if (lines[i + j]) console.log("  " + lines[i + j].trim());
    }
    break;
  }
}
