import { knowledgeBase, riskCodeCatalog } from "../data";
import type { Bank } from "../types";
import { Card, KnowledgeItems } from "./Shared";

export function KnowledgeBase({ bank }: { bank: Bank }) {
  return <div className="grid kb-layout">
    <Card title="Knowledge base" subtitle={`${bank.name} can access tenant-scoped fraud rules, playbooks, and AI evidence references.`}
      actions={<span className="pill clear">Tenant scoped</span>}>
      <KnowledgeItems items={knowledgeBase.articles} />
    </Card>
    <div className="stack">
      <Card title="Detection playbooks" subtitle="Analyst guidance connected to model evidence."><KnowledgeItems items={knowledgeBase.playbooks} /></Card>
      <Card title="Model reference sources" subtitle="Trusted inputs the AI agent can cite during investigation."><KnowledgeItems items={knowledgeBase.sources} /></Card>
      <Card title="Risk code glossary" subtitle="HTTP-style fraud categories used to group validation reasons.">
        <KnowledgeItems items={riskCodeCatalog.map((item) => ({ title: `${item.code} - ${item.label}`, text: item.text }))} />
      </Card>
    </div>
  </div>;
}

export function AdminDetails({ bank, onChange, notify }: {
  bank: Bank; onChange: (bank: Bank) => void; notify: (message: string) => void;
}) {
  function updateThreshold(value: string) {
    if (!value.trim() || !Number.isFinite(Number(value))) {
      notify("Enter a threshold between 50 and 99.");
      return;
    }
    const threshold = Math.max(50, Math.min(99, Math.round(Number(value))));
    onChange({ ...bank, threshold });
    notify(`${bank.name} demo threshold updated to ${threshold}%.`);
  }
  function addSource() {
    const name = `New API source ${bank.inputSources.length + 1}`;
    onChange({ ...bank, inputSources: [...bank.inputSources, {
      name, type: "Custom input", method: "REST API", status: "Connected", cadence: "Realtime",
    }] });
    notify(`${name} added for ${bank.name} (demo only).`);
  }
  return <div className="grid admin-grid">
    <Card className="wide-card" title="Input source connections"
      subtitle={`Manage ${bank.name} input sources. Demo configuration only; no external connectors are contacted.`}
      actions={<button className="btn primary" onClick={addSource}>Add source</button>}>
      <div className="source-grid">{bank.inputSources.map((source) => <div className="source-item" key={source.name}>
        <div><strong>{source.name}</strong><p className="card-subtitle">{source.type} - {source.method}</p></div>
        <span className={`pill ${source.status === "Connected" ? "clear" : "review"}`}>{source.status}</span>
        <p className="muted">Cadence: {source.cadence}</p>
        <div className="source-actions">{["Test", "Edit", "Pause"].map((action) =>
          <button className="mini-btn" key={action} onClick={() => notify(`${action} requested for ${source.name}. Demo only; connector unchanged.`)}>{action}</button>,
        )}</div>
      </div>)}</div>
    </Card>
    <Card title="SOC connection details" subtitle={`${bank.name} illustrative connector status.`}>
      <KnowledgeItems items={[
        { title: "Connector status", text: bank.health === "healthy" ? "Live and healthy (demo)" : "Live with warning (demo)" },
        { title: "Endpoint", text: bank.connector.endpoint },
        { title: "Connected systems", text: bank.connector.systems },
        { title: "Stream latency", text: bank.connector.latency },
        { title: "Last sync (sample)", text: bank.connector.lastSync },
      ]} />
    </Card>
    <Card title="Tenant controls" subtitle="Demo settings; the backend's scoring policy is unchanged.">
      <div className="kb-list"><div className="kb-item">
        <strong>Kifaru validation threshold</strong>
        <div className="threshold-control">
          <input aria-label="Kifaru validation threshold slider" type="range" min="50" max="99" value={bank.threshold} onChange={(event) => updateThreshold(event.target.value)} />
          <input className="input" aria-label="Kifaru validation threshold percentage" type="number" min="50" max="99" value={bank.threshold} onChange={(event) => updateThreshold(event.target.value)} />
          <span className="muted">Current validation threshold: {bank.threshold}% confidence</span>
        </div>
      </div></div>
      <KnowledgeItems items={[
        { title: "Role policy", text: "Admins manage demo input sources and validation controls. Employees see scoped alert and history workflows." },
        { title: "Tenant data boundary", text: `${bank.name} views only related records. This client-side filter is not production authorization.` },
        { title: "Alert routing", text: "Validated fraud appears for the receiving bank. Not-fraud outcomes stay in history." },
      ]} />
    </Card>
    <Card title="Access policy" subtitle="What each demo role can view.">
      <KnowledgeItems items={[
        { title: "Admin", text: "Bank-submitted flags, received alerts, validation history, input sources, thresholds, and governance controls." },
        { title: "Employee", text: "Received alerts, submitted fraud flags, related history, case investigations, and operational fraud guidance." },
        { title: "Prototype access", text: "Role selection is not authentication. Production use requires server-side identity and tenant authorization." },
      ]} />
    </Card>
  </div>;
}
