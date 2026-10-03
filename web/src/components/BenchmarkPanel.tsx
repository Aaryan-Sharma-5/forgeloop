import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { BenchmarkReport } from '../types';

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
      <div className="modal-content benchmark-modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <div className="panel-title">
            <span className="dot dot-cyan"></span>
            Ablation Benchmark Report (First-Shot vs Naive vs AI Repair)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => void fetchBenchmark()} disabled={loading}>
              {loading ? 'Running Benchmark...' : 'Re-run Benchmark'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ margin: '16px 0' }}>
            ⚠️ Benchmark Error: {error}
          </div>
        )}

        {loading && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <span className="pulse-indicator"></span> Running deterministic benchmark ablation across 6 scenarios...
          </div>
        )}

        {!loading && report && (
          <div className="benchmark-body">
            <div className="benchmark-summary-cards">
              <div className="metric-card">
                <div className="metric-label">FIRST-SHOT PASS RATE</div>
                <div className="metric-value text-red">
                  {report.strategies.firstShot.successRate.toFixed(1)}%
                </div>
                <div className="metric-sub">
                  {report.strategies.firstShot.finalSuccesses} / {report.totalScenarios} passed
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">NAIVE HEURISTIC PASS RATE</div>
                <div className="metric-value text-amber">
                  {report.strategies.naiveHeuristic.successRate.toFixed(1)}%
                </div>
                <div className="metric-sub">
                  Blind surface fill
                </div>
              </div>
              <div className="metric-card highlight-card">
                <div className="metric-label">FORGELOOP REPAIR PASS RATE</div>
                <div className="metric-value text-green">
                  {report.strategies.postRepair.successRate.toFixed(1)}%
                </div>
                <div className="metric-sub">
                  Counterexample-guided BFS
                </div>
              </div>
            </div>

            <h4 style={{ margin: '18px 0 8px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              STRATEGY COMPARISON MATRIX
            </h4>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Success Rate</th>
                  <th>Avg Attempts</th>
                  <th>Avg Patch Ops</th>
                  <th>Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>First-Shot (No Repair)</strong></td>
                  <td className="text-red">{report.strategies.firstShot.successRate.toFixed(1)}%</td>
                  <td>1.0</td>
                  <td>0.0</td>
                  <td>{report.strategies.firstShot.avgVerificationLatencyMs.toFixed(2)} ms</td>
                </tr>
                <tr>
                  <td><strong>Naive Heuristic</strong></td>
                  <td className="text-amber">{report.strategies.naiveHeuristic.successRate.toFixed(1)}%</td>
                  <td>1.0</td>
                  <td>{report.strategies.naiveHeuristic.avgPatchOperations.toFixed(1)}</td>
                  <td>{report.strategies.naiveHeuristic.avgVerificationLatencyMs.toFixed(2)} ms</td>
                </tr>
                <tr className="highlight-row">
                  <td><strong>ForgeLoop AI Repair</strong></td>
                  <td className="text-green font-bold">{report.strategies.postRepair.successRate.toFixed(1)}%</td>
                  <td>{report.strategies.postRepair.avgRepairAttempts.toFixed(1)}</td>
                  <td>{report.strategies.postRepair.avgPatchOperations.toFixed(1)}</td>
                  <td>{(report.strategies.postRepair.avgVerificationLatencyMs + report.strategies.postRepair.avgRepairLatencyMs).toFixed(2)} ms</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ margin: '18px 0 8px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              SCENARIO ABLATION BREAKDOWN ({report.scenarios.length} Scenarios)
            </h4>
            <div className="table-container" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              <table className="comparison-table scenario-table">
                <thead>
                  <tr>
                    <th>Scenario ID</th>
                    <th>Name</th>
                    <th>First-Shot</th>
                    <th>Naive</th>
                    <th>ForgeLoop Repair</th>
                    <th>Repair Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {report.scenarios.map((sc) => (
                    <tr key={sc.scenarioId}>
                      <td className="font-mono text-xs">{sc.scenarioId}</td>
                      <td>{sc.name}</td>
                      <td>
                        <span className={`badge ${sc.firstShotPassed ? 'badge-pass' : 'badge-fail'}`}>
                          {sc.firstShotPassed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${sc.naiveHeuristicPassed ? 'badge-pass' : 'badge-fail'}`}>
                          {sc.naiveHeuristicPassed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${sc.postRepairPassed ? 'badge-pass' : 'badge-fail'}`}>
                          {sc.postRepairPassed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="font-mono text-center">{sc.aiRepairAttempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
              Report generated at: {new Date(report.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
