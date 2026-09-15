const test = require("node:test");
const assert = require("node:assert/strict");
const { validateFraudReport } = require("../src/agent");
const { summaryForBank } = require("../src/store");
const { parseCsv } = require("../src/csv");

test("validates high-risk fraud report", () => {
  const result = validateFraudReport({
    reporting_bank: "NCBA",
    receiving_bank: "KCB",
    transaction_id: "TX-1",
    customer_ref: "customer-123456",
    amount: "KES 1,200,000",
    currency: "KES",
    device_status: "new_device",
    password_reset_within_1h: true,
    transfers_5m: 6,
    beneficiary_age_minutes: 5,
    prior_fraud_link: true,
  });

  assert.equal(result.status, "validated_fraud");
  assert.equal(result.validated_by, "Kifaru agent");
  assert.equal(result.customer_ref, "*3456");
  assert.ok(result.confidence >= 85);
  assert.ok(result.risk_codes.length >= 1);
});

test("marks weak report not fraud", () => {
  const result = validateFraudReport({
    reporting_bank: "I&M",
    receiving_bank: "Equity",
    transaction_id: "TX-2",
    customer_ref: "*A5f6",
    amount: "KES 12,000",
    currency: "KES",
    known_beneficiary: true,
    trusted_device: true,
    mfa_result: "passed",
  });

  assert.equal(result.status, "not_fraud");
  assert.equal(result.human_review_required, false);
});

test("summarizes bank history", () => {
  const summary = summaryForBank("NCBA");
  assert.equal(summary.bank, "NCBA");
  assert.equal(summary.total_reports, 0);
  assert.ok(Array.isArray(summary.top_risk_codes));
});

test("parses csv logs into report objects", () => {
  const rows = parseCsv(`reporting_bank,receiving_bank,transaction_id,customer_ref,amount,transfers_5m,ip_country_changed
NCBA,KCB,TX-1,*8622,"KES 1,200,000",6,true`);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].reporting_bank, "NCBA");
  assert.equal(rows[0].amount, "KES 1,200,000");
  assert.equal(rows[0].transfers_5m, 6);
  assert.equal(rows[0].ip_country_changed, true);
});
