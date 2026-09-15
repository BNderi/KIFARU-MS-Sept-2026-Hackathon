const { randomUUID } = require("node:crypto");
const { validateFraudReport } = require("./agent");

const seedReports = [];

const validations = seedReports.map(createValidation);

function createValidation(report) {
  return {
    id: randomUUID(),
    ...validateFraudReport(report),
  };
}

function addValidation(report) {
  const validation = createValidation(report);
  validations.unshift(validation);
  return validation;
}

function addValidations(reports) {
  const created = reports.map(createValidation);
  validations.unshift(...created);
  return created;
}

function allValidations() {
  return validations;
}

function reportsForBank(bankName) {
  const normalizedBank = bankName.toLowerCase();
  return validations.filter((item) =>
    item.reporting_bank.toLowerCase() === normalizedBank ||
    item.receiving_bank.toLowerCase() === normalizedBank
  );
}

function alertsForBank(bankName) {
  const normalizedBank = bankName.toLowerCase();
  return validations.filter((item) =>
    item.receiving_bank.toLowerCase() === normalizedBank &&
    item.status === "validated_fraud"
  );
}

function submissionsForBank(bankName) {
  const normalizedBank = bankName.toLowerCase();
  return validations.filter((item) => item.reporting_bank.toLowerCase() === normalizedBank);
}

function summaryForBank(bankName) {
  const reports = reportsForBank(bankName);
  const codeCounts = reports.reduce((counts, item) => {
    for (const riskCode of item.risk_codes) {
      counts[riskCode.code] = (counts[riskCode.code] || 0) + 1;
    }
    return counts;
  }, {});

  return {
    bank: bankName,
    total_reports: reports.length,
    submitted_flags: submissionsForBank(bankName).length,
    alerts_received: alertsForBank(bankName).length,
    fraud_blocked: reports.filter((item) => item.status === "validated_fraud").length,
    false_positives: reports.filter((item) => item.status === "not_fraud").length,
    needs_review: reports.filter((item) => item.status === "needs_review").length,
    top_risk_codes: Object.entries(codeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count })),
  };
}

module.exports = {
  addValidation,
  addValidations,
  allValidations,
  reportsForBank,
  alertsForBank,
  submissionsForBank,
  summaryForBank,
};
