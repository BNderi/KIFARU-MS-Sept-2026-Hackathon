export type Role = "admin" | "employee";
export type Tab = "incoming" | "outgoing" | "history" | "reports" | "knowledge" | "admin";
export type Outcome = "validated_fraud" | "not_fraud" | "needs_review";
export interface Source {
  name: string;
  type: string;
  method: string;
  status: string;
  cadence: string;
}
export interface Bank {
  id: string;
  name: string;
  region: string;
  users: string;
  shortName: string;
  health: string;
  threshold: number;
  soc: string;
  connector: { endpoint: string; systems: string; latency: string; lastSync: string };
  inputSources: Source[];
}
export interface Transaction {
  key: string;
  id: string;
  sourceBank: string;
  destinationBank: string;
  customerRef: string;
  merchant: string;
  country: string;
  amount: string;
  score: number;
  flagSource: string;
  validationStatus: Outcome;
  riskCode: { code: string; label: string };
  evidence: string[];
  action: string;
}
export interface Validation {
  transaction_id: string;
  reporting_bank: string;
  receiving_bank: string;
  customer_ref: string;
  currency: string;
  amount: string;
  confidence: number;
  status: Outcome;
  validated_by: string;
  risk_codes: { code: string; label: string }[];
  key_signals: string[];
  short_explanation: string;
  recommended_action: string;
}
export interface UploadSummary {
  total_rows: number;
  validated_fraud: number;
  not_fraud: number;
  needs_review: number;
  top_risk_codes: { code: string; count: number }[];
}
