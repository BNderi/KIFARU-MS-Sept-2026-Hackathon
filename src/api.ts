import type { UploadSummary, Validation } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidation(value: unknown): value is Validation {
  if (!isRecord(value)) return false;
  const stringFields = ["transaction_id", "reporting_bank", "receiving_bank", "customer_ref",
    "currency", "amount", "validated_by", "short_explanation", "recommended_action"];
  return stringFields.every((field) => typeof value[field] === "string")
    && typeof value.confidence === "number" && Number.isFinite(value.confidence)
    && ["validated_fraud", "not_fraud", "needs_review"].includes(String(value.status))
    && Array.isArray(value.risk_codes)
    && value.risk_codes.every((code) => isRecord(code) && typeof code.code === "string" && typeof code.label === "string")
    && Array.isArray(value.key_signals) && value.key_signals.every((signal) => typeof signal === "string");
}

function isSummary(value: unknown): value is UploadSummary {
  return isRecord(value)
    && ["total_rows", "validated_fraud", "not_fraud", "needs_review"]
      .every((field) => typeof value[field] === "number" && Number.isInteger(value[field]) && Number(value[field]) >= 0)
    && Array.isArray(value.top_risk_codes)
    && value.top_risk_codes.every((item) => isRecord(item) && typeof item.code === "string" && typeof item.count === "number");
}

export async function validateCsv(csv: string, signal?: AbortSignal) {
  const response = await fetch("/api/validate-csv", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csv,
    signal,
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The validation API is unavailable. Start the backend with npm run backend.");
  }
  const payload: unknown = await response.json();
  if (!response.ok) {
    throw new Error(isRecord(payload) && typeof payload.error === "string"
      ? payload.error : `CSV validation failed (HTTP ${response.status}).`);
  }
  if (!isRecord(payload) || !Array.isArray(payload.validations)
    || !payload.validations.every(isValidation) || !isSummary(payload.summary)) {
    throw new Error("The validation API returned an unexpected response.");
  }
  return { validations: payload.validations, summary: payload.summary };
}
