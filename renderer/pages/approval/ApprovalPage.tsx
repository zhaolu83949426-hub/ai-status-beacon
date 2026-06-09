import { useEffect, useState } from "react";
import type { PendingPermission, PermissionDecision } from "../../../shared/types";

export function ApprovalPage() {
  const [pending, setPending] = useState<PendingPermission[]>([]);

  useEffect(() => {
    const fetchPending = () => {
      window.beaconApi.getPendingPermissions().then(setPending);
    };
    fetchPending();
    // Re-fetch on every snapshot push (permission added/removed)
    const unsub = window.beaconApi.onBeaconSnapshot(() => fetchPending());
    return unsub;
  }, []);

  const handleDecide = (id: string, decision: PermissionDecision) => {
    window.beaconApi.decidePermission(id, decision);
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="approval-container">
      <div className="approval-header">
        <span className="approval-title">审批请求</span>
        <span className="approval-count">{pending.length}</span>
      </div>
      <div className="approval-cards">
        {pending.map((p) => (
          <ApprovalCard key={p.id} permission={p} onDecide={handleDecide} />
        ))}
      </div>
      {pending.length === 0 && (
        <div className="approval-empty">无待审批请求</div>
      )}
    </div>
  );
}

function ApprovalCard({
  permission,
  onDecide,
}: {
  permission: PendingPermission;
  onDecide: (id: string, decision: PermissionDecision) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [textInput, setTextInput] = useState("");

  const p = permission;

  return (
    <div className="approval-card">
      <div className="approval-card-header">
        <span className="approval-agent">{(p as any).agentName ?? p.agentId}</span>
        <span className="approval-tool">{p.toolName}</span>
      </div>
      <div className="approval-summary">{p.summary}</div>
      {p.cwd && <div className="approval-cwd">📁 {p.cwd}</div>}
      {p.riskHint && <div className="approval-risk">⚠️ {p.riskHint}</div>}
      <button
        className="approval-expand-btn"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "收起" : "展开详情"}
      </button>
      {expanded && (
        <pre className="approval-raw">
          {JSON.stringify(p.rawInput, null, 2)}
        </pre>
      )}
      {p.requiresTextInput && (
        <input
          className="approval-text-input"
          placeholder="输入内容..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
        />
      )}
      <div className="approval-actions">
        <button
          className="btn-allow"
          onClick={() =>
            onDecide(p.id, {
              behavior: "allow",
              text: textInput || undefined,
            })
          }
        >
          允许
        </button>
        <button
          className="btn-deny"
          onClick={() =>
            onDecide(p.id, {
              behavior: "deny",
              text: textInput || undefined,
            })
          }
        >
          拒绝
        </button>
        {p.suggestions.map((s) => (
          <button
            key={s.id}
            className="btn-suggestion"
            onClick={() =>
              onDecide(p.id, {
                behavior: "suggestion",
                suggestionId: s.id,
                text: textInput || undefined,
              })
            }
            title={s.description}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
