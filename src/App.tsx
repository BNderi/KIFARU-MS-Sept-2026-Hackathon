import { useEffect, useRef, useState } from "react";
import { validateCsv } from "./api";
import { initialBanks } from "./data";
import {
  counterpartyBankId, displayTransactionId, isVisible, moneyDirection, reportingBankId,
  transactionDirection, transactionFromValidation, validationLabel,
} from "./domain";
import type { Outcome, Role, Tab, Transaction, UploadSummary } from "./types";
import { Logo } from "./components/Shared";
import { Investigation, TransactionTable } from "./components/Transactions";
import { Reports } from "./components/Reports";
import { AdminDetails, KnowledgeBase } from "./components/ReferencePanels";

export default function App() {
  const [banks, setBanks] = useState(initialBanks);
  const [bankId, setBankId] = useState(initialBanks[0].id);
  const [role, setRole] = useState<Role | null>(null);
  const [tab, setTab] = useState<Tab>("incoming");
  const [collapsed, setCollapsed] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [reportView, setReportView] = useState("all");
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const uploadController = useRef<AbortController | null>(null);
  const bank = banks.find((item) => item.id === bankId)!;
  const bankName = (id: string) => id === "external" ? "External network" : banks.find((item) => item.id === id)?.name ?? id;
  const bankIdFromName = (name: string) => banks.find((item) => item.name.toLowerCase() === name.trim().toLowerCase())?.id
    ?? (name.trim().toLowerCase() === "external" ? "external" : `unknown:${name.trim().toLowerCase()}`);
  const records = transactions.filter((item) => isVisible(item, bankId));
  const selected = records.find((item) => item.key === selectedKey);
  const submitted = records.filter((item) => reportingBankId(item) === bankId).length;
  const received = records.filter((item) => counterpartyBankId(item) === bankId && item.validationStatus === "validated_fraud").length;
  const fraud = records.filter((item) => item.validationStatus === "validated_fraud").length;
  const notFraud = records.filter((item) => item.validationStatus === "not_fraud").length;
  const visible = records.filter((item) => filter === "all" || item.validationStatus === filter).filter((item) => {
    const text = [item.customerRef, item.merchant, item.country, item.id, displayTransactionId(item, bank.name),
      transactionDirection(item, bankId), moneyDirection(item, bankId), bankName(reportingBankId(item))].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => () => uploadController.current?.abort(), []);

  function login(nextRole: Role) {
    setRole(nextRole);
    setTab("incoming");
    setToast(`${nextRole === "admin" ? "Admin" : "Employee"} dashboard loaded.`);
  }

  function selectBank(id: string) {
    setBankId(id);
    setQuery("");
    setFilter("all");
    setReportView("all");
    setSelectedKey(null);
    setToast(`${bankName(id)} session loaded.`);
  }

  function simulate(status: Outcome) {
    const isFraud = status === "validated_fraud";
    const key = crypto.randomUUID();
    const transaction: Transaction = {
      key,
      id: `${bank.shortName}-${key.slice(0, 8)}`,
      sourceBank: bank.id,
      destinationBank: "external",
      customerRef: isFraud ? "*9901" : "*C774",
      merchant: isFraud ? "Cross-border transfer" : "Digital wallet cash-out",
      country: isFraud ? "Unknown route" : "Kenya",
      amount: isFraud ? "KES 2,392,000" : "USD 2,740",
      score: isFraud ? 97 : 78,
      flagSource: isFraud ? "Kifaru agent" : "AG Screener",
      validationStatus: status,
      riskCode: { code: "DEV-403", label: "Device or auth anomaly" },
      evidence: isFraud
        ? ["Credential stuffing signal", "High-risk beneficiary", "Behavior pattern drift"]
        : ["Wallet reputation warning", "Recent device change", "Below Kifaru validation threshold"],
      action: isFraud ? "Demo: validated fraud; receiving-bank alert simulated." : "Demo: bank-submitted flag marked not fraud.",
    };
    setTransactions((current) => [transaction, ...current]);
    setToast(`${validationLabel(status)} demo record added for ${bank.name}.`);
  }

  async function upload(file: File) {
    const controller = new AbortController();
    uploadController.current?.abort();
    uploadController.current = controller;
    setUploading(true);
    setUploadError("");
    setUploadSummary(null);
    try {
      const payload = await validateCsv(await file.text(), controller.signal);
      const incoming = payload.validations.map((validation) =>
        transactionFromValidation(validation, bankIdFromName, crypto.randomUUID()));
      setTransactions((current) => [...incoming, ...current]);
      setUploadSummary(payload.summary);
      setToast(`${payload.summary.total_rows} CSV log rows validated.`);
    } catch (error) {
      if (!controller.signal.aborted) {
        setUploadError(error instanceof Error ? error.message : "CSV upload failed.");
      }
    } finally {
      if (uploadController.current === controller) {
        setUploading(false);
        uploadController.current = null;
      }
    }
  }

  if (!role) return <section className="login-screen">
    <div className="login-card">
      <div className="login-logo"><Logo /><div><p className="eyebrow">Kifaru access portal</p><h1>Choose your role</h1></div></div>
      <p>This prototype uses button-based login. Admin users can view SOC connection details,
        governance controls, metrics, and knowledge-base sources. Employees can access flagged transactions
        and operational fraud guidance. This is a demo, not production authentication.</p>
      <div className="role-grid">
        <button className="role-card" onClick={() => login("admin")}><strong>Admin</strong><span>Full tenant operations, SOC connection details, model governance, thresholds, and knowledge base.</span></button>
        <button className="role-card" onClick={() => login("employee")}><strong>Employee</strong><span>Received alerts, submitted flags, investigation details, and fraud playbooks.</span></button>
      </div>
    </div>
  </section>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "incoming", label: "Alerts received" }, { id: "outgoing", label: "Flags submitted" },
    { id: "reports", label: "Reports" }, ...(role === "admin" ? [{ id: "admin" as const, label: "Admin details" }] : []),
  ];
  const metrics = [
    { label: "Related history", value: records.length, detail: "Records tied to this bank" },
    { label: "Submitted flags", value: submitted, detail: "From this bank's fraud system" },
    { label: "Alerts received", value: received, detail: "Validated fraud sent to this bank" },
    { label: "Kifaru outcomes", value: fraud, detail: `${notFraud} not fraud - ${records.filter((item) => item.amount.startsWith("USD")).length} USD cases` },
  ];
  const transactionTabs = {
    incoming: { title: "Alerts received", subtitle: "Validated fraud alerts sent to this bank by the reporting bank." },
    outgoing: { title: "Bank fraud flags submitted", subtitle: "Transactions your bank submitted for centralized validation." },
    history: { title: "Related fraud history", subtitle: "All validation records involving the selected bank as reporting or receiving bank." },
  };
  return <>
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`} id="appShell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand"><Logo /><div><h1>Kifaru</h1><p>AI fraud SOC command</p></div></div>
          <button className="sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "\u203a" : "\u2039"}</button>
        </div>
        <p className="sidebar-label">Institution login</p>
        <div className="bank-list">{banks.map((item) =>
          <button className={`bank-card ${bankId === item.id ? "active" : ""}`} key={item.id} data-short={item.shortName} title={item.name} aria-label={item.name} aria-pressed={bankId === item.id} onClick={() => selectBank(item.id)}>
            <span><span className="bank-name">{item.name}</span><span className="bank-meta">{item.region} - {item.users}</span></span>
            <span className={`dot ${item.health === "warning" ? "warning" : ""}`} aria-hidden="true" />
          </button>,
        )}</div>
        <p className="sidebar-label">Workspace</p>
        <button className={`side-nav-btn ${tab === "history" ? "active" : ""}`} data-short="HI" aria-label="Related history" aria-pressed={tab === "history"} onClick={() => setTab("history")}><span className="nav-text">Related history</span></button>
        <button className={`side-nav-btn ${tab === "knowledge" ? "active" : ""}`} data-short="KB" aria-label="Knowledge base" aria-pressed={tab === "knowledge"} onClick={() => setTab("knowledge")}><span className="nav-text">Knowledge base</span></button>
        <div className="side-panel">
          <label className="pill" htmlFor="csvUpload">CSV log upload</label>
          <p className="muted">Upload bank fraud logs to the Kifaru validation agent.</p>
          <input className="file-input" id="csvUpload" type="file" accept=".csv,text/csv" disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }} />
          <div className="upload-output" aria-live="polite" aria-busy={uploading}>
            {uploading && <span className="muted">Processing CSV...</span>}
            {uploadError && <div role="alert"><span className="pill review">Upload failed</span><p>{uploadError}</p></div>}
            {uploadSummary && <>
              <span><strong>{uploadSummary.total_rows}</strong> rows processed</span>
              <span><strong>{uploadSummary.validated_fraud}</strong> validated fraud</span>
              <span><strong>{uploadSummary.not_fraud}</strong> marked not fraud</span>
              <span><strong>{uploadSummary.needs_review}</strong> needs review</span>
              <span className="muted">{uploadSummary.top_risk_codes.map((item) => `${item.code} (${item.count})`).join(" - ") || "No risk codes"}</span>
            </>}
            {!uploading && !uploadError && !uploadSummary && <span className="muted">Validation API: /api</span>}
          </div>
        </div>
        {role === "admin" && <div className="side-panel"><span className="pill clear">SOC link (demo)</span><p>{bank.soc}</p></div>}
      </aside>
      <main className="main">
        <section className="topbar"><div>
          <p className="eyebrow">Command dashboard prototype</p><h2>Kifaru - {bank.name}</h2>
          <p className="muted">Logged in as {bank.users}. View submitted fraud flags, validation results, received alerts, and related history.</p>
        </div><div className="actions">
          <span className="pill">{role === "admin" ? "Admin login" : "Employee login"}</span>
          <button className="btn" onClick={() => {
            document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
          }}>Toggle theme</button>
          <button className="btn" onClick={() => simulate("not_fraud")}>Simulate not fraud</button>
          <button className="btn primary" onClick={() => simulate("validated_fraud")}>Submit fraud flag (demo)</button>
          <button className="btn" onClick={() => {
            uploadController.current?.abort();
            setRole(null);
            setSelectedKey(null);
            setToast("");
          }}>Log out</button>
        </div></section>
        <section className="grid metrics">{metrics.map((metric) =>
          <div className="metric" key={metric.label}><div className="metric-label"><span>{metric.label}</span><span>Session</span></div>
            <div className="metric-value">{metric.value}</div><div className="metric-detail">{metric.detail}</div>
          </div>,
        )}</section>
        <nav className="tabs" aria-label="Dashboard sections">{tabs.map((item) =>
          <button key={item.id} className={`tab-btn ${tab === item.id ? "active" : ""}`} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>,
        )}</nav>
        {(tab === "incoming" || tab === "outgoing" || tab === "history") && <>
          <div className="transaction-controls"><div><h3 className="card-title">Kifaru validation workspace</h3>
            <p className="card-subtitle"><strong>Alerts received</strong> are validated fraud reports sent to your bank.
              <strong> Flags submitted</strong> are cases your bank sent for centralized validation.</p></div>
            <div className="control-row">
              <input className="input" aria-label="Search transactions" placeholder="Search customer ref, reporting bank, country" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select className="select" aria-label="Filter by risk" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">All outcomes</option><option value="validated_fraud">Validated fraud</option>
                <option value="not_fraud">Marked not fraud</option><option value="needs_review">Under review</option>
              </select>
            </div>
          </div>
          <TransactionTable {...transactionTabs[tab]} records={visible.filter((item) => tab === "history"
            || (tab === "outgoing" ? reportingBankId(item) === bankId : counterpartyBankId(item) === bankId && item.validationStatus === "validated_fraud"))}
            bank={bank} bankName={bankName} history={tab === "history"} onOpen={setSelectedKey} />
        </>}
        {tab === "reports" && <Reports records={records} bank={bank} view={reportView} onView={setReportView} />}
        {tab === "knowledge" && <KnowledgeBase bank={bank} />}
        {tab === "admin" && role === "admin" && <AdminDetails bank={bank} notify={setToast} onChange={(updated) => setBanks((current) => current.map((item) => item.id === updated.id ? updated : item))} />}
      </main>
    </div>
    {selected && <Investigation transaction={selected} bank={bank} bankName={bankName} onClose={() => setSelectedKey(null)}
      onMark={() => {
        setTransactions((current) => current.map((item) => item.key === selected.key
          ? { ...item, validationStatus: "not_fraud", score: Math.min(item.score, 31), action: "Marked not fraud in this demo session." }
          : item));
        setSelectedKey(null);
        setToast(`${displayTransactionId(selected, bank.name)} marked not fraud (session only).`);
      }}
      onAlert={() => {
        setToast(`Demo bank alert for ${displayTransactionId(selected, bank.name)}. No external alert sent.`);
        setSelectedKey(null);
      }} />}
    <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
  </>;
}
