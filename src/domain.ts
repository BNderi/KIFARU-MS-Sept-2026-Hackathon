import type { Transaction, Validation } from "./types.ts";

export function reportingBankId(transaction: Transaction) {
  return transaction.sourceBank === "external" ? transaction.destinationBank : transaction.sourceBank;
}

export function counterpartyBankId(transaction: Transaction) {
  return reportingBankId(transaction) === transaction.sourceBank
    ? transaction.destinationBank
    : transaction.sourceBank;
}

export function isVisible(transaction: Transaction, bankId: string) {
  return reportingBankId(transaction) === bankId || counterpartyBankId(transaction) === bankId;
}

export function moneyDirection(transaction: Transaction, bankId: string) {
  if (transaction.sourceBank === bankId) return "Outgoing";
  if (transaction.destinationBank === bankId) return "Incoming";
  return "Network";
}

export function transactionDirection(transaction: Transaction, bankId: string) {
  return reportingBankId(transaction) === bankId ? "Submitted flag" : "Received alert";
}

export function displayTransactionId(transaction: Transaction, bankName: string) {
  return `${bankName}-${transaction.id.split("-").at(-1)}`;
}

export function validationLabel(status: string) {
  if (status === "validated_fraud") return "Validated fraud";
  if (status === "not_fraud") return "Marked not fraud";
  return "Under review";
}

export function statusClass(status: string) {
  if (status === "validated_fraud") return "fraud";
  if (status === "not_fraud") return "clear";
  return "review";
}

export function riskCounts(records: Transaction[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.riskCode.code, (counts.get(record.riskCode.code) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function transactionFromValidation(
  validation: Validation,
  bankIdFromName: (name: string) => string,
  key: string,
): Transaction {
  return {
    key,
    id: validation.transaction_id,
    sourceBank: bankIdFromName(validation.reporting_bank),
    destinationBank: bankIdFromName(validation.receiving_bank),
    customerRef: validation.customer_ref,
    merchant: "Uploaded CSV log",
    country: validation.currency,
    amount: validation.amount,
    score: validation.confidence,
    flagSource: validation.validated_by,
    validationStatus: validation.status,
    riskCode: validation.risk_codes[0] ?? { code: "GEN-400", label: "General fraud signal" },
    evidence: validation.key_signals.length ? validation.key_signals : [validation.short_explanation],
    action: validation.recommended_action,
  };
}
