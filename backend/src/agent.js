const RISK_CODES = [
  {
    code: "IP-401",
    label: "Changing IP or location",
    indicators: ["ip_country_changed", "vpn_proxy_tor", "ip_reputation", "geo_velocity", "impossible_travel", "proxy"],
  },
  {
    code: "VEL-429",
    label: "Velocity or volume spike",
    indicators: ["transfers_5m", "transfers_1h", "beneficiary_changes_24h", "failed_login_count", "velocity", "volume"],
  },
  {
    code: "DEV-403",
    label: "Device or auth anomaly",
    indicators: ["new_device", "sim_swap_signal", "password_reset_within_1h", "emulator_signal", "rooted_or_jailbroken", "failed_mfa"],
  },
  {
    code: "BEN-409",
    label: "Beneficiary mismatch",
    indicators: ["beneficiary_age_minutes", "beneficiary_risk_score", "prior_fraud_link", "new_beneficiary", "payee"],
  },
  {
    code: "AML-451",
    label: "Mule or AML pattern",
    indicators: ["mule_network_distance", "rapid_cashout", "structuring", "blacklist_hit", "watchlist_match"],
  },
  {
    code: "DOC-422",
    label: "Invoice or vendor anomaly",
    indicators: ["invoice_mismatch", "vendor_bank_change", "spoofed_domain", "bec_signal"],
  },
  {
    code: "CRY-418",
    label: "Crypto, forex, or remittance risk",
    indicators: ["crypto", "forex", "remittance", "offshore"],
  },
  {
    code: "GEN-400",
    label: "General fraud signal",
    indicators: [],
  },
];

const REQUIRED_FIELDS = ["reporting_bank", "receiving_bank", "transaction_id", "customer_ref", "amount"];

function normalizeReport(input) {
  const report = { ...input };
  report.reporting_bank = String(report.reporting_bank || "").trim();
  report.receiving_bank = String(report.receiving_bank || "").trim();
  report.transaction_id = String(report.transaction_id || "").trim();
  report.customer_ref = maskCustomerRef(report.customer_ref);
  report.amount = String(report.amount || "").trim();
  report.currency = String(report.currency || inferCurrency(report.amount) || "KES").toUpperCase();
  report.bank_flag_source = String(report.bank_flag_source || "AG Screener").trim();
  return report;
}

function maskCustomerRef(value) {
  const raw = String(value || "*0000").trim();
  if (/^\*[A-Za-z0-9]{4}$/.test(raw)) return raw;
  const compact = raw.replace(/[^A-Za-z0-9]/g, "");
  return `*${compact.slice(-4).padStart(4, "0")}`;
}

function inferCurrency(amount) {
  const text = String(amount || "").toUpperCase();
  if (text.includes("USD")) return "USD";
  if (text.includes("KES")) return "KES";
  return "";
}

function missingFields(report) {
  return REQUIRED_FIELDS.filter((field) => !report[field]);
}

function amountNumber(report) {
  return Number(String(report.amount || "").replace(/[^0-9.]/g, "")) || 0;
}

function getSignals(report) {
  const signals = [];
  const amount = amountNumber(report);

  if (report.currency === "KES" && amount >= 500000) signals.push("High-value KES transaction");
  if (report.currency === "USD" && amount >= 2500) signals.push("High-value USD transaction");
  if (report.ip_country_changed || report.geo_velocity === "impossible" || report.impossible_travel) signals.push("Changing IP or impossible travel");
  if (report.vpn_proxy_tor || report.proxy_detected) signals.push("VPN/proxy/Tor network signal");
  if (report.device_status === "new_device" || report.new_device) signals.push("New device observed");
  if (report.password_reset_within_1h) signals.push("Recent password reset");
  if (report.sim_swap_signal) signals.push("SIM swap signal");
  if (Number(report.transfers_5m || 0) >= 4) signals.push("High transfer velocity in five minutes");
  if (Number(report.transfers_1h || 0) >= 10) signals.push("High transfer volume in one hour");
  if (Number(report.beneficiary_age_minutes || 999999) <= 60) signals.push("New beneficiary");
  if (Number(report.beneficiary_risk_score || 0) >= 75) signals.push("High-risk beneficiary");
  if (report.prior_fraud_link) signals.push("Prior fraud link found");
  if (report.mule_network_distance && Number(report.mule_network_distance) <= 2) signals.push("Close mule-network proximity");
  if (report.invoice_mismatch || report.vendor_bank_change || report.bec_signal) signals.push("Invoice or vendor anomaly");
  if (containsAny(report, ["crypto", "forex", "remittance", "offshore"])) signals.push("Crypto/forex/remittance risk");

  return [...new Set(signals)];
}

function containsAny(report, words) {
  const haystack = [
    report.payment_rail,
    report.channel,
    report.merchant,
    report.notes,
    ...(Array.isArray(report.evidence) ? report.evidence : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.some((word) => haystack.includes(word));
}

function deriveRiskCodes(report, signals) {
  const matched = RISK_CODES.filter((riskCode) =>
    riskCode.indicators.some((indicator) =>
      Boolean(report[indicator]) ||
      signals.some((signal) => signal.toLowerCase().includes(indicator.replaceAll("_", " "))) ||
      containsAny(report, [indicator.replaceAll("_", " ")])
    )
  );

  if (matched.length) return matched.slice(0, 3);
  return [RISK_CODES.find((riskCode) => riskCode.code === "GEN-400")];
}

function scoreReport(report, signals, missing) {
  let score = 20;
  for (const signal of signals) {
    if (signal.includes("High-value")) score += 12;
    else if (signal.includes("Prior fraud")) score += 25;
    else if (signal.includes("mule")) score += 20;
    else if (signal.includes("SIM swap") || signal.includes("password reset")) score += 18;
    else if (signal.includes("New device") || signal.includes("Changing IP")) score += 14;
    else if (signal.includes("velocity") || signal.includes("volume")) score += 16;
    else if (signal.includes("beneficiary")) score += 16;
    else score += 10;
  }

  if (report.mfa_result === "passed" && signals.length <= 2) score -= 10;
  if (report.known_beneficiary) score -= 15;
  if (report.trusted_device) score -= 12;
  score -= missing.length * 6;

  return Math.max(0, Math.min(99, Math.round(score)));
}

function statusFromScore(score, signals, missing) {
  if (missing.length >= 3) return "needs_review";
  if (score >= 85 && signals.length >= 2) return "validated_fraud";
  if (score >= 65) return "needs_review";
  return "not_fraud";
}

function recommendedAction(status, receivingBank) {
  if (status === "validated_fraud") {
    return `Send fraud alert to ${receivingBank}, hold settlement, and open a fraud case.`;
  }
  if (status === "needs_review") {
    return "Queue for analyst review and verify missing or conflicting signals.";
  }
  return "Do not send receiving-bank alert; store validation result in history.";
}

function validateFraudReport(input) {
  const report = normalizeReport(input);
  const missing = missingFields(report);
  const signals = getSignals(report);
  const riskCodes = deriveRiskCodes(report, signals);
  const confidence = scoreReport(report, signals, missing);
  const status = statusFromScore(confidence, signals, missing);

  return {
    status,
    confidence,
    validated_by: "Kifaru agent",
    bank_flag_source: report.bank_flag_source,
    reporting_bank: report.reporting_bank,
    receiving_bank: report.receiving_bank,
    transaction_id: report.transaction_id,
    customer_ref: report.customer_ref,
    amount: report.amount,
    currency: report.currency,
    risk_codes: riskCodes.map((riskCode) => ({
      code: riskCode.code,
      label: riskCode.label,
      evidence: evidenceForCode(riskCode, signals),
    })),
    key_signals: signals,
    missing_fields: missing,
    recommended_action: recommendedAction(status, report.receiving_bank),
    human_review_required: status === "needs_review",
    short_explanation: explain(status, signals, missing),
    created_at: new Date().toISOString(),
  };
}

function evidenceForCode(riskCode, signals) {
  const signal = signals.find((item) => item.toLowerCase().includes(riskCode.label.split(" ")[0].toLowerCase()));
  return signal || signals[0] || "Risk evidence was limited or generic.";
}

function explain(status, signals, missing) {
  if (missing.length) return `Missing fields reduced certainty: ${missing.join(", ")}.`;
  if (status === "validated_fraud") return `Fraud validated from ${signals.length} supporting signal(s).`;
  if (status === "needs_review") return "Signals are material but not strong enough for automatic validation.";
  return "Available signals do not support a fraud validation.";
}

module.exports = {
  RISK_CODES,
  validateFraudReport,
  normalizeReport,
};
