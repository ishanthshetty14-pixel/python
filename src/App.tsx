/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { TerminalComponent } from './components/Terminal';
import { TelemetryView } from './components/TelemetryView';
import { ErrorInspector } from './components/ErrorInspector';
import { ScenarioPlayground } from './components/ScenarioPlayground';
import { FileSystemExplorer } from './components/FileSystemExplorer';
import { PosixReference } from './components/PosixReference';
import { CommandHistoryEntry, CliError, TerminalTheme } from './types';
import { executeCommand, CommandContext } from './cli/commands';
import { vfs } from './cli/filesystem';
import { Folder, History, Layers, ShieldCheck, Terminal as TerminalIcon, Wrench } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'terminal' | 'inspector' | 'chaos' | 'filesystem' | 'posix' | 'telemetry'>('terminal');
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const [lastError, setLastError] = useState<CliError | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [theme, setTheme] = useState<TerminalTheme>('classic-dark');
  const [fsVersion, setFsVersion] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Command Execution Handler
  const handleExecute = useCallback(
    async (cmd: string) => {
      setIsRunning(true);

      const ctx: CommandContext = {
        lastError,
        setLastError: (err) => {
          setLastError(err);
        },
        onRunCommand: (nextCmd) => {
          handleExecute(nextCmd);
        },
        onInspectError: (err) => {
          setLastError(err);
          setActiveTab('inspector');
        },
      };

      // Slight simulation tick for realistic command execution
      await new Promise((r) => setTimeout(r, 60));

      const result = await executeCommand(cmd, ctx);

      // Add to command history
      const entry: CommandHistoryEntry = {
        id: 'hist_' + Math.random().toString(36).substring(2, 9),
        command: cmd,
        result,
        timestamp: new Date().toLocaleTimeString(),
      };

      setHistory((prev) => [...prev, entry]);
      setIsRunning(false);
      setFsVersion((v) => v + 1);

      // If an error occurred, keep track of it
      if (result.error) {
        setLastError(result.error);
      }
    },
    [lastError]
  );

  const handleClear = useCallback(() => {
    setHistory([]);
  }, []);

  const handleResetFs = useCallback(() => {
    vfs.resetToDefaults();
    setFsVersion((v) => v + 1);
    handleExecute('faultline doctor');
  }, [handleExecute]);

  // Initial welcome command on mount
  useEffect(() => {
    handleExecute('faultline help');
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0A0A0B] text-slate-300 font-sans overflow-hidden">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRunQuickCommand={handleExecute}
        onResetFs={handleResetFs}
        hasLastError={!!lastError}
        theme={theme}
        setTheme={setTheme}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Professional Workspace Sidebar */}
        <aside className={`w-60 xl:w-64 border-r border-slate-800 bg-[#0F0F11] flex-col shrink-0 ${sidebarOpen ? 'hidden md:flex' : 'hidden'} select-none`}>
          {/* Local Workspace Path Card */}
          <div className="p-4 border-b border-slate-800">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Local Workspace</span>
              <span className="text-emerald-400 font-mono text-[9px]">READY</span>
            </div>
            <div
              onClick={() => setActiveTab('filesystem')}
              className="flex items-center gap-2 text-xs font-mono text-slate-200 bg-slate-800/50 hover:bg-slate-800/80 p-2 rounded border border-slate-700/50 cursor-pointer transition-colors"
            >
              <span className="text-blue-400 font-bold">~</span>
              <span className="truncate">/workspace</span>
            </div>
          </div>

          {/* Sidebar Nav Sections */}
          <div className="flex-1 p-4 space-y-5 overflow-y-auto">
            {/* Session Command History */}
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Recent History</span>
                <span className="text-slate-600 font-mono text-[9px]">{history.length} runs</span>
              </div>
              <ul className="space-y-1 font-mono text-xs">
                {history.length === 0 ? (
                  <li className="text-[11px] text-slate-500 py-1 italic">No commands yet</li>
                ) : (
                  history.slice(-5).map((entry, i) => {
                    const isErr = entry.result.exitCode !== 0;
                    return (
                      <li
                        key={entry.id || i}
                        onClick={() => {
                          setActiveTab('terminal');
                          handleExecute(entry.command);
                        }}
                        className={`text-xs py-1.5 px-2 rounded flex items-center justify-between group cursor-pointer transition-colors ${
                          isErr
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        <span className="truncate max-w-[130px]">{entry.command}</span>
                        <span
                          className={`text-[9px] font-bold px-1 rounded ${
                            isErr
                              ? 'bg-red-950/60 text-red-300 border border-red-800/60'
                              : 'text-emerald-400 opacity-80 group-hover:opacity-100'
                          }`}
                        >
                          {isErr ? `FAIL:${entry.result.exitCode}` : 'OK'}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {/* Live Session Telemetry Card */}
            <div
              onClick={() => setActiveTab('telemetry')}
              className="bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 p-3 rounded-lg cursor-pointer transition-all space-y-2 group"
            >
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  <span>Session Telemetry</span>
                </span>
                <span className="text-blue-400 text-[10px] group-hover:underline">View &rarr;</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <div className="bg-[#0A0A0B] p-1.5 rounded border border-slate-800/60">
                  <div className="text-slate-500 text-[9px]">FAULTS</div>
                  <div className="text-red-400 font-bold">
                    {history.filter((h) => h.result.exitCode !== 0).length} / {history.length}
                  </div>
                </div>
                <div className="bg-[#0A0A0B] p-1.5 rounded border border-slate-800/60">
                  <div className="text-slate-500 text-[9px]">AVG LATENCY</div>
                  <div className="text-amber-400 font-bold">
                    {history.length > 0
                      ? Math.round(
                          history.reduce((a, b) => a + b.result.durationMs, 0) / history.length
                        )
                      : 0}{' '}
                    ms
                  </div>
                </div>
              </div>
            </div>

            {/* Environment Variables */}
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Environment
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-slate-900/80 border border-slate-800 p-2 rounded">
                  <div className="text-slate-500 mb-0.5 font-medium">NODE_ENV</div>
                  <div className="text-slate-300 font-mono font-semibold">production</div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-2 rounded">
                  <div className="text-slate-500 mb-0.5 font-medium">REGION</div>
                  <div className="text-slate-300 font-mono font-semibold">us-east</div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-2 rounded">
                  <div className="text-slate-500 mb-0.5 font-medium">POSIX</div>
                  <div className="text-emerald-400 font-mono font-semibold">sysexits-strict</div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-2 rounded">
                  <div className="text-slate-500 mb-0.5 font-medium">ROLLBACK</div>
                  <div className="text-blue-400 font-mono font-semibold">atomic-undo</div>
                </div>
              </div>
            </div>

            {/* Quick Chaos Triggers */}
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Quick Faults
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab('terminal');
                    handleExecute('faultline chaos corrupt-json');
                  }}
                  className="w-full text-left text-[11px] font-mono py-1 px-2 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors flex items-center justify-between"
                >
                  <span className="truncate">corrupt-json</span>
                  <span className="text-amber-500 text-[10px]">65</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('terminal');
                    handleExecute('faultline chaos rate-limit');
                  }}
                  className="w-full text-left text-[11px] font-mono py-1 px-2 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors flex items-center justify-between"
                >
                  <span className="truncate">rate-limit</span>
                  <span className="text-amber-500 text-[10px]">75</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('terminal');
                    handleExecute('faultline chaos rollback');
                  }}
                  className="w-full text-left text-[11px] font-mono py-1 px-2 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors flex items-center justify-between"
                >
                  <span className="truncate">migration-undo</span>
                  <span className="text-purple-400 text-[10px]">atomic</span>
                </button>
              </div>
            </div>
          </div>

          {/* Launcher Flags Bottom */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  setActiveTab('terminal');
                  handleExecute('faultline deploy --json');
                }}
                className="text-[10px] font-mono bg-slate-800/70 hover:bg-slate-800 px-2 py-1 rounded text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
              >
                --json
              </button>
              <button
                onClick={() => {
                  setActiveTab('terminal');
                  handleExecute('faultline deploy --dry-run');
                }}
                className="text-[10px] font-mono bg-slate-800/70 hover:bg-slate-800 px-2 py-1 rounded text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
              >
                --dry-run
              </button>
              <button
                onClick={() => {
                  setActiveTab('terminal');
                  handleExecute('faultline doctor');
                }}
                className="text-[10px] font-mono bg-slate-800/70 hover:bg-slate-800 px-2 py-1 rounded text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
              >
                --doctor
              </button>
            </div>
          </div>
        </aside>

        {/* Center Main Stage */}
        <main className="flex-1 flex flex-col bg-[#0A0A0B] relative overflow-hidden">
          {activeTab === 'terminal' && (
            <TerminalComponent
              history={history}
              onExecute={handleExecute}
              onClear={handleClear}
              isRunning={isRunning}
              theme={theme}
              onInspectError={() => setActiveTab('inspector')}
            />
          )}

          {activeTab === 'telemetry' && (
            <TelemetryView
              history={history}
              onRunCommand={handleExecute}
              onInspectError={(err) => {
                setLastError(err);
                setActiveTab('inspector');
              }}
              onSelectTab={setActiveTab}
            />
          )}

          {activeTab === 'inspector' && (
            <ErrorInspector
              error={lastError}
              onExecuteCommand={(cmd) => {
                setActiveTab('terminal');
                handleExecute(cmd);
              }}
            />
          )}

          {activeTab === 'chaos' && (
            <ScenarioPlayground
              onRunCommand={handleExecute}
              onSelectTab={setActiveTab}
            />
          )}

          {activeTab === 'filesystem' && (
            <FileSystemExplorer
              key={fsVersion}
              onRefreshFs={() => setFsVersion((v) => v + 1)}
              onRunCommand={(cmd) => {
                setActiveTab('terminal');
                handleExecute(cmd);
              }}
            />
          )}

          {activeTab === 'posix' && <PosixReference />}
        </main>
      </div>

      {/* Professional Footer Status Bar */}
      <footer className="h-8 bg-[#0F0F11] border-t border-slate-800 flex items-center justify-between px-4 text-[10px] font-medium text-slate-500 uppercase tracking-tighter shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> UTF-8
          </span>
          <span className="hidden sm:inline font-mono">POSIX Sysexits (BSD 4.3)</span>
          <span className="hidden md:inline font-mono">JavaScript (Node.js 22)</span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 font-mono">
          <button
            onClick={handleClear}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ctrl+L Clear
          </button>
          <button
            onClick={() => handleExecute('faultline help')}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            ? Help
          </button>
          <button
            onClick={() => handleExecute('faultline doctor --fix')}
            className="text-emerald-400 hover:text-emerald-300 transition-colors hidden sm:inline"
          >
            Auto-Repair
          </button>
        </div>
      </footer>
    </div>
  );
}
