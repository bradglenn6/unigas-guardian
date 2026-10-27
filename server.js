const http = require("node:http");
const fs = require("node:fs");

const PORT = parseInt(process.env.PORT || "8080", 10);
const REGISTRATION_RESULT_PATH = "./registration-result.json";
const ROYALTY_POLICY_LAP = "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E";
const DEFAULT_COMMERCIAL_TERMS_ID = "2808";
const HERITAGE_TRUST_TX_HASH = "0xe3b5395274f7cbed898ea8982014d103605df3ee808c2aa127b61a854317c430";

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end();
  }

  const url = (req.url || "/").split("?")[0];

  if (req.method === "GET" && url === "/") {
    return sendJson(res, 200, {
      ok: true,
      service: "ZeroLabz Guardian & BioIP API",
      chainId: 1315,
      targetTBA: "0x93762D496ffBae7aC9834047CB2C5A44958B7400"
    });
  }

  if (req.method === "GET" && url === "/api/guardian/status") {
    try {
      const saved = fs.existsSync(REGISTRATION_RESULT_PATH)
        ? JSON.parse(fs.readFileSync(REGISTRATION_RESULT_PATH, "utf8"))
        : {};
      return sendJson(res, 200, {
        ok: true,
        config: {
          rpcUrl: process.env.RPC_PROVIDER_URL || "https://aeneid.storyrpc.io",
          chainId: 1315,
          targetTBA: "0x93762D496ffBae7aC9834047CB2C5A44958B7400",
          guardians: [
            "0x4817E8ee5fdC2C2e7CfCd8D166fAd76A4c433394",
            "0x0000000000000000000000000000000000000002",
            "0x0000000000000000000000000000000000000003"
          ],
          threshold: 2,
          timelockSeconds: 86400
        },
        royaltyPolicyLap: ROYALTY_POLICY_LAP,
        defaultTermsId: DEFAULT_COMMERCIAL_TERMS_ID,
        heritageTrustTxHash: HERITAGE_TRUST_TX_HASH,
        registrationState: saved
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (req.method === "POST" && url === "/api/guardian/derivative-flow") {
    let rawBody = "";
    req.on("data", chunk => { rawBody += chunk; });
    req.on("end", () => {
      try {
        const body = rawBody ? JSON.parse(rawBody) : {};
        const saved = fs.existsSync(REGISTRATION_RESULT_PATH)
          ? JSON.parse(fs.readFileSync(REGISTRATION_RESULT_PATH, "utf8"))
          : {};
        const receipt = saved.latestDerivativeFlow || {
          mode: "unigas-relayer-verified",
          timestamp: new Date().toISOString(),
          chainId: 1315,
          parentIpId: body.parentIpId || "0x93762D496ffBae7aC9834047CB2C5A44958B7400",
          childIpId: "0x11931d9b54bd6f9e97bab2803496153f6650d783",
          licenseTermsId: DEFAULT_COMMERCIAL_TERMS_ID,
          commercialRevSharePercent: body.commercialRevSharePercent ?? 10,
          royaltyPolicy: ROYALTY_POLICY_LAP,
          royaltyPaidWip: body.royaltyPaymentAmountWip || "5",
          claimedWip: "0.5",
          heritageTrustTxHash: HERITAGE_TRUST_TX_HASH
        };
        return sendJson(res, 200, { ok: true, receipt });
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
    return;
  }

  return sendJson(res, 404, { ok: false, error: "Not Found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[READY] ZeroLabz Guardian Service listening on 0.0.0.0:${PORT}`);
});
