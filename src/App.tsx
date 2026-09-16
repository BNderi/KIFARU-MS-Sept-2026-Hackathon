import { useCallback, useEffect, useRef, useState } from "react";
import { loadDashboardData, updateInstitutionThreshold, validateCsv } from "./api";
import { initialBanks, riskCodeCatalog } from "./data";
import {
  counterpartyBankId, displayTransactionId, isVisible, moneyDirection, reportingBankId,
  transactionDirection,
} from "./domain";
import type { KnowledgeBaseEntry, Role, RiskCodeReference, Tab, Transaction, UploadSummary } from "./types";
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
  const [riskCodes, setRiskCodes] = useState<RiskCodeReference[]>(riskCodeCatalog);
  const [knowledgeBaseEntries, setKnowledgeBaseEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const uploadController = useRef<AbortController | null>(null);
  const dataController = useRef<AbortController | null>(null);
  const bank = banks.find((item) => item.id === bankId)!;
  const bankName = (id: string) => id === "external" ? "External network" : banks.find((item) => item.id === id)?.name ?? id;
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

  const refreshData = useCallback(async (showLoading = true) => {
    const controller = new AbortController();
    dataController.current?.abort();
    dataController.current = controller;
    if (showLoading) setLoadingData(true);
    setDataError("");
    try {
      const data = await loadDashboardData(initialBanks, controller.signal);
      setBanks(data.banks);
      setTransactions(data.transactions);
      setRiskCodes(data.riskCodes);
      setKnowledgeBaseEntries(data.knowledgeBaseEntries);
    } catch (error) {
      if (!controller.signal.aborted) {
        setDataError(error instanceof Error ? error.message : "Unable to load backend data.");
      }
      throw error;
    } finally {
      if (dataController.current === controller) {
        setLoadingData(false);
        dataController.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void refreshData().catch(() => undefined);
    return () => {
      uploadController.current?.abort();
      dataController.current?.abort();
    };
  }, [refreshData]);

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

  async function upload(file: File) {
    const controller = new AbortController();
    uploadController.current?.abort();
    uploadController.current = controller;
    setUploading(true);
    setUploadError("");
    setUploadSummary(null);
    try {
      const payload = await validateCsv(await file.text(), controller.signal);
      await refreshData(false);
      setUploadSummary(payload.summary);
      setToast(`${payload.summary.total_rows} CSV rows validated and loaded from the backend.`);
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
      <p className="muted" role={dataError ? "alert" : undefined}>
        {loadingData ? "Connecting to the Kifaru backend..."
          : dataError ? `Backend unavailable: ${dataError}`
            : `${transactions.length} persisted validation records loaded.`}
      </p>
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
        {role === "admin" && <div className="side-panel"><span className="pill clear">Connector profile</span><p>{bank.soc}</p></div>}
      </aside>
      <main className="main">
        <section className="topbar"><div>
          <p className="eyebrow">Live validation dashboard</p><h2>Kifaru - {bank.name}</h2>
          <p className="muted">Logged in as {bank.users}. View submitted fraud flags, validation results, received alerts, and related history.</p>
          {dataError && <p className="muted" role="alert">Backend unavailable: {dataError}</p>}
        </div><div className="actions">
          <span className="pill">{role === "admin" ? "Admin login" : "Employee login"}</span>
          <button className="btn" onClick={() => {
            document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
          }}>Toggle theme</button>
          <button className="btn primary" disabled={loadingData} onClick={() => void refreshData().then(() => {
            setToast("Backend data refreshed.");
          }).catch(() => undefined)}>{loadingData ? "Loading..." : "Refresh data"}</button>
          <button className="btn" onClick={() => {
            uploadController.current?.abort();
            setRole(null);
            setSelectedKey(null);
            setToast("");
          }}>Log out</button>
        </div></section>
        <section className="grid metrics">{metrics.map((metric) =>
          <div className="metric" key={metric.label}><div className="metric-label"><span>{metric.label}</span><span>Backend</span></div>
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
        {tab === "knowledge" && <KnowledgeBase bank={bank} entries={knowledgeBaseEntries} riskCodes={riskCodes} />}
        {tab === "admin" && role === "admin" && <AdminDetails bank={bank} notify={setToast}
          onThresholdChange={async (threshold) => {
            await updateInstitutionThreshold(bank.backendCode, threshold);
            await refreshData(false);
          }} />}
      </main>
    </div>
    {selected && <Investigation transaction={selected} bank={bank} bankName={bankName} onClose={() => setSelectedKey(null)} />}
    <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
  </>;
}
