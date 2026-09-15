const http = require("node:http");
const { URL } = require("node:url");
const { RISK_CODES } = require("./agent");
const {
  addValidation,
  addValidations,
  allValidations,
  reportsForBank,
  alertsForBank,
  submissionsForBank,
  summaryForBank,
} = require("./store");
const { parseCsv } = require("./csv");

const BANKS = ["NCBA", "KCB", "Equity", "I&M"];
const PORT = Number(process.env.PORT || 3000);

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(body, null, 2));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error(`Invalid JSON: ${error.message}`));
      }
    });
  });
}

function readText(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function summarizeValidations(validations) {
  return {
    total_rows: validations.length,
    validated_fraud: validations.filter((item) => item.status === "validated_fraud").length,
    not_fraud: validations.filter((item) => item.status === "not_fraud").length,
    needs_review: validations.filter((item) => item.status === "needs_review").length,
    top_risk_codes: Object.entries(validations.reduce((counts, item) => {
      for (const riskCode of item.risk_codes) {
        counts[riskCode.code] = (counts[riskCode.code] || 0) + 1;
      }
      return counts;
    }, {}))
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count })),
  };
}

function bankFromPath(pathname, prefix, suffix = "") {
  const encoded = pathname.slice(prefix.length, pathname.length - suffix.length || undefined);
  return decodeURIComponent(encoded);
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const { pathname } = url;

  if (request.method === "OPTIONS") return sendJson(response, 204, {});
  if (request.method === "GET" && pathname === "/health") {
    return sendJson(response, 200, { ok: true, service: "kifaru-backend-prototype" });
  }
  if (request.method === "GET" && pathname === "/banks") {
    return sendJson(response, 200, { banks: BANKS });
  }
  if (request.method === "GET" && pathname === "/risk-codes") {
    return sendJson(response, 200, { risk_codes: RISK_CODES.map(({ code, label }) => ({ code, label })) });
  }
  if (request.method === "GET" && pathname === "/validations") {
    return sendJson(response, 200, { validations: allValidations() });
  }
  if (request.method === "POST" && pathname === "/validate") {
    try {
      const validation = addValidation(await readJson(request));
      return sendJson(response, 201, { validation });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === "POST" && pathname === "/validate-csv") {
    try {
      const body = await readText(request);
      const rows = parseCsv(body);
      if (!rows.length) return sendJson(response, 400, { error: "CSV must include headers and at least one data row." });
      const validations = addValidations(rows);
      return sendJson(response, 201, {
        summary: summarizeValidations(validations),
        validations,
      });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  if (request.method === "GET" && pathname.startsWith("/banks/") && pathname.endsWith("/reports")) {
    const bank = bankFromPath(pathname, "/banks/", "/reports");
    return sendJson(response, 200, { bank, reports: reportsForBank(bank) });
  }
  if (request.method === "GET" && pathname.startsWith("/banks/") && pathname.endsWith("/alerts")) {
    const bank = bankFromPath(pathname, "/banks/", "/alerts");
    return sendJson(response, 200, { bank, alerts: alertsForBank(bank) });
  }
  if (request.method === "GET" && pathname.startsWith("/banks/") && pathname.endsWith("/submissions")) {
    const bank = bankFromPath(pathname, "/banks/", "/submissions");
    return sendJson(response, 200, { bank, submissions: submissionsForBank(bank) });
  }
  if (request.method === "GET" && pathname.startsWith("/banks/") && pathname.endsWith("/summary")) {
    const bank = bankFromPath(pathname, "/banks/", "/summary");
    return sendJson(response, 200, summaryForBank(bank));
  }

  return sendJson(response, 404, {
    error: "Not found",
    routes: [
      "GET /health",
      "GET /banks",
      "GET /risk-codes",
      "GET /validations",
      "POST /validate",
      "POST /validate-csv",
      "GET /banks/:bank/reports",
      "GET /banks/:bank/alerts",
      "GET /banks/:bank/submissions",
      "GET /banks/:bank/summary",
    ],
  });
}

if (require.main === module) {
  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => sendJson(response, 500, { error: error.message }));
  });
  server.listen(PORT, () => {
    console.log(`Kifaru backend listening on http://127.0.0.1:${PORT}`);
  });
}

module.exports = { handleRequest };
