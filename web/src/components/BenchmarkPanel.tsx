import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { BenchmarkReport } from "../types";

interface BenchmarkPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBenchmark();
      setReport(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !report) {
      void fetchBenchmark();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-primary)" }}>
            BENCHMARK ABLATION // 6 DETERMINISTIC SCENARIOS
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => void fetchBenchmark()} disabled={loading}>
              {loading ? "EVALUATING..." : "RE-EVALUATE"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              CLOSE [ESC]
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ margin: "14px 16px" }}>
            Benchmark failure: {error}
          </div>
        )}

        {loading && (
          <div style={{ padding: "36px", textAlign: "center", color: "var(--ink-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            Executing benchmark ablation across First-Shot, Naive Heuristic, and Post-Repair strategies...
          </div>
        )}

        {!loading && report && (
          <div className="benchmark-body">
            <div className="benchmark-summary-cards">
              <div className="metric-card">
                <div className="metric-label">FIRST-SHOT (ZERO REPAIR)</div>
                <div className="metric-value text-red">
                  {report.strategies.firstShot.successRate.toFixed(1)}%
                </div>
                <div className="metric-sub">
                  {report.strategies.firstShot.finalSuccesses} of {report.totalScenarios} scenarios
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">NAIVE SURFACE HEURISTIC</div>
                <div className="metric-value text-amber">
                  {report.strategies.naiveHeuristic.successRate.toFixed(1)}%
                </div>
                <div className="metric-sub">
                  Blind surface fill
                </div>
              </div>

              <div className="metric-card highlight-card">
                <div className="metric-label">COUNTEREXAMPLE-GUIDED REPAIR</div>
                <div className="metric-value text-green">
                  {report.strategies.postRepair.successRate.toFixed(1)}%
                </div>
                <div className="metric-sub">
                  Authoritative verifier loop
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--ink-muted)", letterSpacing: 0.5 }}>
                STRATEGY COMPARISON MATRIX
              </span>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>STRATEGY</th>
                    <th>SUCCESS RATE</th>
                    <th>AVG ATTEMPTS</th>
                    <th>AVG PATCH OPS</th>
                    <th>AVG LATENCY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700 }}>FIRST-SHOT (NO REPAIR)</td>
                    <td className="text-red">{report.strategies.firstShot.successRate.toFixed(1)}%</td>
                    <td>1.0</td>
                    <td>0.0</td>
                    <td>{report.strategies.firstShot.avgVerificationLatencyMs.toFixed(2)} ms</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>NAIVE SURFACE HEURISTIC</td>
                    <td className="text-amber">{report.strategies.naiveHeuristic.successRate.toFixed(1)}%</td>
                    <td>1.0</td>
                    <td>{report.strategies.naiveHeuristic.avgPatchOperations.toFixed(1)}</td>
                    <td>{report.strategies.naiveHeuristic.avgVerificationLatencyMs.toFixed(2)} ms</td>
                  </tr>
                  <tr className="highlight-row">
                    <td style={{ fontWeight: 700 }}>FORGELOOP CEGIS REPAIR</td>
                    <td className="text-green font-bold">{report.strategies.postRepair.successRate.toFixed(1)}%</td>
                    <td>{report.strategies.postRepair.avgRepairAttempts.toFixed(1)}</td>
                    <td>{report.strategies.postRepair.avgPatchOperations.toFixed(1)}</td>
                    <td>{(report.strategies.postRepair.avgVerificationLatencyMs + report.strategies.postRepair.avgRepairLatencyMs).toFixed(2)} ms</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--ink-muted)", letterSpacing: 0.5 }}>
                SCENARIO ABLATION BREAKDOWN ({report.scenarios.length} SCENARIOS)
              </span>
              <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-rule)" }}>
                <table className="comparison-table" style={{ border: "none" }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>SCENARIO</th>
                      <th>FIRST-SHOT</th>
                      <th>NAIVE</th>
                      <th>FORGELOOP REPAIR</th>
                      <th>ATTEMPTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.scenarios.map((sc) => (
                      <tr key={sc.scenarioId}>
                        <td style={{ fontFamily: "var(--font-mono)" }}>{sc.scenarioId}</td>
                        <td>{sc.name}</td>
                        <td>
                          <span className={`badge ${sc.firstShotPassed ? "badge-pass" : "badge-fail"}`}>
                            {sc.firstShotPassed ? "PASS" : "FAIL"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${sc.naiveHeuristicPassed ? "badge-pass" : "badge-fail"}`}>
                            {sc.naiveHeuristicPassed ? "PASS" : "FAIL"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${sc.postRepairPassed ? "badge-pass" : "badge-fail"}`}>
                            {sc.postRepairPassed ? "PASS" : "FAIL"}
                          </span>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)" }}>{sc.aiRepairAttempts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ fontSize: 10, color: "var(--ink-muted)", fontFamily: "var(--font-mono)", textAlign: "right" }}>
              Report timestamp: {new Date(report.timestamp).toISOString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
