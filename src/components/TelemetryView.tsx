/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Activity,
  Zap,
  ShieldAlert,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Filter,
  BarChart3,
  TrendingUp,
  Flame,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { CommandHistoryEntry } from '../types';
import { POSIX_EXIT_CODES } from '../cli/posix';

interface TelemetryViewProps {
  history: CommandHistoryEntry[];
  onRunCommand: (cmd: string) => void;
  onInspectError: (error: any) => void;
  onSelectTab: (tab: 'terminal' | 'inspector') => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Success: '#10b981', // emerald-500
  Configuration: '#f59e0b', // amber-500
  Permissions: '#ef4444', // red-500
  Network: '#3b82f6', // blue-500
  Transactions: '#8b5cf6', // purple-500
  'CLI Syntax': '#ec4899', // pink-500
  System: '#64748b', // slate-500
};

export const TelemetryView: React.FC<TelemetryViewProps> = ({
  history,
  onRunCommand,
  onInspectError,
  onSelectTab,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'errors' | 'success'>('all');
  const [hoveredData, setHoveredData] = useState<any>(null);

  // Compute key telemetry metrics from real session history
  const metrics = useMemo(() => {
    const total = history.length;
    if (total === 0) {
      return {
        total: 0,
        successCount: 0,
        errorCount: 0,
        successRate: 100,
        errorRate: 0,
        meanLatency: 0,
        p95Latency: 0,
        maxLatency: 0,
        minLatency: 0,
        rollbacks: 0,
      };
    }

    const errors = history.filter((h) => h.result.exitCode !== 0);
    const successes = history.filter((h) => h.result.exitCode === 0);
    const rollbacks = history.filter((h) => h.result.rollbackTriggered || h.result.error?.rollbackLog?.length);

    const latencies = history.map((h) => h.result.durationMs).sort((a, b) => a - b);
    const totalLatency = latencies.reduce((acc, l) => acc + l, 0);
    const meanLatency = Math.round(totalLatency / total);
    const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
    const p95Latency = latencies[p95Index] || 0;

    return {
      total,
      successCount: successes.length,
      errorCount: errors.length,
      successRate: Math.round((successes.length / total) * 100),
      errorRate: Math.round((errors.length / total) * 100),
      meanLatency,
      p95Latency,
      maxLatency: latencies[latencies.length - 1] || 0,
      minLatency: latencies[0] || 0,
      rollbacks: rollbacks.length,
    };
  }, [history]);

  // Transform history into Latency Time-Series for Recharts
  const latencyTimeSeries = useMemo(() => {
    let runningSuccess = 0;
    let runningErrors = 0;

    return history.map((entry, index) => {
      const isErr = entry.result.exitCode !== 0;
      if (isErr) {
        runningErrors += 1;
      } else {
        runningSuccess += 1;
      }

      const shortCmd =
        entry.command.length > 20 ? entry.command.substring(0, 18) + '...' : entry.command;

      return {
        index: index + 1,
        command: entry.command,
        shortCmd,
        latency: entry.result.durationMs,
        exitCode: entry.result.exitCode,
        status: isErr ? 'Error' : 'Success',
        errorLatency: isErr ? entry.result.durationMs : null,
        successLatency: !isErr ? entry.result.durationMs : null,
        timestamp: entry.timestamp,
        runningSuccess,
        runningErrors,
        error: entry.result.error,
      };
    });
  }, [history]);

  // Exit Code Frequency Distribution for Recharts BarChart
  const exitCodeDistribution = useMemo(() => {
    const counts: Record<number, { code: number; name: string; count: number; category: string }> = {};

    history.forEach((entry) => {
      const code = entry.result.exitCode;
      const posixInfo = POSIX_EXIT_CODES[code] || {
        code,
        name: `EXIT_${code}`,
        category: 'Custom',
        description: 'Command exit status',
      };

      if (!counts[code]) {
        counts[code] = {
          code,
          name: posixInfo.name,
          count: 0,
          category: posixInfo.category,
        };
      }
      counts[code].count += 1;
    });

    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [history]);

  // Error Category Breakdown for Recharts PieChart
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      Success: 0,
      Configuration: 0,
      Permissions: 0,
      Network: 0,
      Transactions: 0,
      'CLI Syntax': 0,
    };

    history.forEach((entry) => {
      if (entry.result.exitCode === 0) {
        counts['Success'] += 1;
      } else if (entry.result.error) {
        const code = entry.result.error.code || '';
        if (code.includes('CONFIG') || code.includes('SYNTAX') || code.includes('DATAERR')) {
          counts['Configuration'] += 1;
        } else if (code.includes('PERM') || code.includes('NOPERM') || code.includes('AUTH')) {
          counts['Permissions'] += 1;
        } else if (code.includes('RATE_LIMIT') || code.includes('NET') || code.includes('TEMPFAIL')) {
          counts['Network'] += 1;
        } else if (code.includes('MIGRATION') || code.includes('ROLLBACK') || code.includes('TX')) {
          counts['Transactions'] += 1;
        } else {
          counts['CLI Syntax'] += 1;
        }
      } else {
        counts['CLI Syntax'] += 1;
      }
    });

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || '#94a3b8',
      }));
  }, [history]);

  // Filtered log table entries
  const filteredHistory = useMemo(() => {
    return [...history].reverse().filter((entry) => {
      if (filterMode === 'errors') return entry.result.exitCode !== 0;
      if (filterMode === 'success') return entry.result.exitCode === 0;
      return true;
    });
  }, [history, filterMode]);

  // Quick Stress/Chaos Simulation trigger
  const runStressTest = () => {
    const testCommands = [
      'faultline deploy --env=staging',
      'faultline chaos corrupt-json',
      'faultline doctor',
      'faultline chaos rate-limit',
      'faultline config get',
      'faultline chaos rollback',
      'faultline doctor --fix',
      'faultline fs ls',
    ];

    let delay = 0;
    testCommands.forEach((cmd) => {
      setTimeout(() => {
        onRunCommand(cmd);
      }, delay);
      delay += 300;
    });
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#0A0A0B] text-slate-300 space-y-6 select-text">
      {/* Header Banner */}
      <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">CLI Telemetry & Error Frequency</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800 font-bold">
                  LIVE RECHARTS ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time latency distribution, POSIX sysexit code frequencies, failure rates, and resilience telemetry for session commands.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-telemetry-benchmark"
              onClick={runStressTest}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md transition-all shadow-sm"
              title="Execute a burst of commands to generate rich live telemetry"
            >
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate Burst</span>
            </button>

            <button
              onClick={() => onRunCommand('faultline doctor')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
            >
              <span>Run Doctor</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {/* Total Commands */}
          <div className="bg-[#0A0A0B] border border-slate-800/90 rounded-lg p-3 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Executed</span>
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">{metrics.total}</div>
            <div className="text-[10px] text-slate-400">Total session runs</div>
          </div>

          {/* Success Rate */}
          <div className="bg-[#0A0A0B] border border-slate-800/90 rounded-lg p-3 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Success Rate</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">{metrics.successRate}%</div>
            <div className="text-[10px] text-slate-400">{metrics.successCount} succeeded (Exit 0)</div>
          </div>

          {/* Error Rate */}
          <div className="bg-[#0A0A0B] border border-slate-800/90 rounded-lg p-3 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Error Rate</span>
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="text-xl font-bold font-mono text-red-400">{metrics.errorRate}%</div>
            <div className="text-[10px] text-slate-400">{metrics.errorCount} caught faults</div>
          </div>

          {/* Mean Latency */}
          <div className="bg-[#0A0A0B] border border-slate-800/90 rounded-lg p-3 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Mean Latency</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100">{metrics.meanLatency} ms</div>
            <div className="text-[10px] text-slate-400">Avg execution time</div>
          </div>

          {/* P95 Latency */}
          <div className="bg-[#0A0A0B] border border-slate-800/90 rounded-lg p-3 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>P95 Latency</span>
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-100">{metrics.p95Latency} ms</div>
            <div className="text-[10px] text-slate-400">95th percentile</div>
          </div>

          {/* Rollbacks */}
          <div className="bg-[#0A0A0B] border border-slate-800/90 rounded-lg p-3 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Rollbacks</span>
              <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-400">{metrics.rollbacks}</div>
            <div className="text-[10px] text-slate-400">Atomic state undos</div>
          </div>
        </div>
      </div>

      {/* Row 1: Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Execution Latency Over Time (2 Cols) */}
        <div className="lg:col-span-2 border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Command Execution Latency Timeline</span>
              </h3>
              <p className="text-[11px] text-slate-400">Duration in milliseconds across sequence of executions</p>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Success (0)
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Error (&gt;0)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {latencyTimeSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                No telemetry recorded. Run commands in Terminal to populate metrics.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyTimeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="index"
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: '#334155' }}
                    label={{ value: 'Run #', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: '#334155' }}
                    unit="ms"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs font-mono space-y-1.5 z-50">
                            <div className="font-bold text-white flex items-center justify-between gap-3">
                              <span>#{data.index}: {data.command}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <span>Latency:</span>
                              <span className="text-amber-400 font-bold">{data.latency} ms</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <span>Exit Status:</span>
                              <span
                                className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                  data.exitCode === 0
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : 'bg-red-950 text-red-400 border border-red-800'
                                }`}
                              >
                                {data.exitCode === 0 ? '0 (SUCCESS)' : `EXIT_${data.exitCode}`}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">{data.timestamp}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'SLA 200ms', fill: '#ef4444', fontSize: 10, position: 'top' }} />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#latencyGradient)"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isErr = payload.exitCode !== 0;
                      return (
                        <circle
                          key={`dot-${payload.index}`}
                          cx={cx}
                          cy={cy}
                          r={isErr ? 4 : 3}
                          fill={isErr ? '#ef4444' : '#10b981'}
                          stroke="#0A0A0B"
                          strokeWidth={1.5}
                        />
                      );
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Exit Code Frequency Distribution BarChart (1 Col) */}
        <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-4 shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>POSIX Exit Code Frequencies</span>
            </h3>
            <p className="text-[11px] text-slate-400">Distribution of exit statuses in this session</p>
          </div>

          <div className="h-64 w-full">
            {exitCodeDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                No exit code events recorded.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exitCodeDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="code"
                    stroke="#475569"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: '#334155' }}
                    tickFormatter={(val) => `Code ${val}`}
                  />
                  <YAxis
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: '#334155' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs font-mono space-y-1 z-50">
                            <div className="font-bold text-white">
                              Exit {data.code}: {data.name}
                            </div>
                            <div className="text-slate-300">Category: {data.category}</div>
                            <div className="text-amber-400 font-bold">Count: {data.count} runs</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {exitCodeDistribution.map((entry) => (
                      <Cell
                        key={`cell-${entry.code}`}
                        fill={
                          entry.code === 0
                            ? '#10b981'
                            : entry.code === 75
                            ? '#f59e0b'
                            : entry.code === 130
                            ? '#8b5cf6'
                            : '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart: Error Category Distribution (Donut / Pie) */}
        <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-4 shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Fault Categories Breakdown</span>
            </h3>
            <p className="text-[11px] text-slate-400">Classifications of triggered commands & faults</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            {categoryBreakdown.length === 0 ? (
              <div className="text-slate-500 text-xs font-mono">No category telemetry available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 rounded text-xs font-mono">
                            <span className="font-bold text-white">{data.name}: </span>
                            <span className="text-emerald-400 font-semibold">{data.value} runs</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconSize={8}
                    formatter={(val) => <span className="text-[10px] text-slate-400 font-mono">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Cumulative Reliability Progress Chart (2 Cols) */}
        <div className="lg:col-span-2 border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Cumulative Success vs Error Trend</span>
              </h3>
              <p className="text-[11px] text-slate-400">Cumulative tally of safe vs caught failures across session lifecycle</p>
            </div>
          </div>

          <div className="h-56 w-full">
            {latencyTimeSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                No session runs recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyTimeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="index"
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: '#334155' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2.5 rounded text-xs font-mono space-y-1">
                            <div className="text-white font-bold">At Run #{data.index}</div>
                            <div className="text-emerald-400">Total Succeeded: {data.runningSuccess}</div>
                            <div className="text-red-400">Total Failed: {data.runningErrors}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="runningSuccess"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    name="Successes"
                  />
                  <Area
                    type="monotone"
                    dataKey="runningErrors"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    name="Errors"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Session Execution Log & Deep Drilldown */}
      <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Session Telemetry Log & Latency Audit</span>
            </h3>
            <p className="text-[11px] text-slate-400">Detailed per-command performance and exit code telemetry</p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filterMode === 'all'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              All ({history.length})
            </button>
            <button
              onClick={() => setFilterMode('errors')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filterMode === 'errors'
                  ? 'bg-red-500/20 text-red-300 font-semibold border border-red-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Errors ({metrics.errorCount})
            </button>
            <button
              onClick={() => setFilterMode('success')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filterMode === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Success ({metrics.successCount})
            </button>
          </div>
        </div>

        {/* Table of commands */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                <th className="py-2.5 px-3 w-12">#</th>
                <th className="py-2.5 px-3">Command</th>
                <th className="py-2.5 px-3 w-28">Exit Status</th>
                <th className="py-2.5 px-3 w-24">Latency</th>
                <th className="py-2.5 px-3 w-28">Time</th>
                <th className="py-2.5 px-3 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 italic">
                    No commands matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((entry, idx) => {
                  const isErr = entry.result.exitCode !== 0;
                  const posixInfo = POSIX_EXIT_CODES[entry.result.exitCode];

                  return (
                    <tr key={entry.id || idx} className="hover:bg-slate-900/50 transition-colors group">
                      <td className="py-2.5 px-3 text-slate-500">{history.length - idx}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200 flex items-center gap-2">
                        <span className="truncate max-w-xs sm:max-w-md">{entry.command}</span>
                        {entry.result.rollbackTriggered && (
                          <span className="text-[9px] bg-purple-950 text-purple-300 border border-purple-800 px-1 rounded">
                            ROLLBACK
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[10px] px-1.5 py-0.5 rounded ${
                            isErr
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isErr ? (
                            <>
                              <XCircle className="w-2.5 h-2.5" />
                              <span>{posixInfo ? posixInfo.name : `FAIL:${entry.result.exitCode}`}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>EX_OK (0)</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-mono ${
                            entry.result.durationMs > 150 ? 'text-amber-400' : 'text-slate-300'
                          }`}
                        >
                          {entry.result.durationMs} ms
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{entry.timestamp}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {entry.result.error && (
                            <button
                              onClick={() => {
                                onInspectError(entry.result.error);
                                onSelectTab('inspector');
                              }}
                              className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-blue-300 rounded border border-slate-700 transition-colors"
                              title="Inspect error diagnostics"
                            >
                              Anatomy
                            </button>
                          )}
                          <button
                            onClick={() => {
                              onRunCommand(entry.command);
                              onSelectTab('terminal');
                            }}
                            className="p-1 hover:text-emerald-400 rounded hover:bg-slate-800 text-slate-400 transition-colors"
                            title="Rerun command in terminal"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
