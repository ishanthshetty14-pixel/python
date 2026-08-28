/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldAlert, Bot, Check, Copy, Wrench, RotateCcw, BookOpen, Sparkles, Terminal, Code2, AlertTriangle, ArrowRight } from 'lucide-react';
import { CliError } from '../types';
import { getExitCodeInfo } from '../cli/posix';

interface ErrorInspectorProps {
  error: CliError | null;
  onExecuteCommand: (cmd: string) => void;
}

export const ErrorInspector: React.FC<ErrorInspectorProps> = ({ error, onExecuteCommand }) => {
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<any>(null);

  const handleCopyJson = () => {
    if (!error) return;
    navigator.clipboard.writeText(JSON.stringify(error.machineJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunAiDiagnosis = async () => {
    if (!error) return;
    setAiLoading(true);
    try {
      const resp = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: error.commandRan,
          errorCode: error.code,
          exitCode: error.exitCode,
          message: error.message,
          snippet: error.diagnostics?.[0]?.snippet,
          stack: error.stack,
          context: error.flags,
        }),
      });
      const data = await resp.json();
      setAiDiagnosis(data);
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  if (!error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#0A0A0B] text-slate-400 select-none">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-sm">
          <Terminal className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-100">No Active Error Recorded</h3>
        <p className="text-xs text-slate-400 max-w-md mt-1 mb-6">
          The CLI environment has not logged an unhandled error in this session, or the last executed command exited with code 0 (success).
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => onExecuteCommand('faultline chaos corrupt-json')}
            className="px-3.5 py-2 text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors shadow-sm"
          >
            Trigger Corrupt JSON Fault
          </button>
          <button
            onClick={() => onExecuteCommand('faultline chaos rollback')}
            className="px-3.5 py-2 text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md transition-colors shadow-sm"
          >
            Trigger Migration Rollback
          </button>
        </div>
      </div>
    );
  }

  const exitInfo = getExitCodeInfo(error.exitCode);

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#0A0A0B] text-slate-300 space-y-6 select-text">
      {/* Top Header Error Card */}
      <div className="border border-red-500/40 bg-[#0F0F11] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-red-950/70 text-red-200 border border-red-700 font-bold">
                  {error.code}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Exit Status: {error.exitCode} ({exitInfo.name})
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-100 mt-1">{error.message}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
              title="Copy structured JSON error payload"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied JSON' : 'Copy JSON'}</span>
            </button>

            <button
              onClick={handleRunAiDiagnosis}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 rounded-md transition-colors shadow-sm"
            >
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>{aiLoading ? 'Analyzing...' : 'AI Deep Analysis'}</span>
            </button>
          </div>
        </div>

        {/* Command Context Bar */}
        <div className="text-xs font-mono text-slate-400 bg-slate-900/90 p-3 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-slate-500">Command:</span> <span className="text-emerald-400 font-semibold">{error.commandRan}</span>
          </div>
          <div>
            <span className="text-slate-500">Trace ID:</span> <span className="text-slate-300">{error.traceId}</span>
          </div>
          <div>
            <span className="text-slate-500">Timestamp:</span> <span className="text-slate-300">{error.timestamp.replace('T', ' ').slice(0, 19)}</span>
          </div>
        </div>
      </div>

      {/* Grid: Diagnostics & POSIX Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Code Context & Remediation (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Diagnostic Code Pointer Box */}
          {error.diagnostics && error.diagnostics.length > 0 && (
            <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-blue-400" />
                  <span>Source Context & Pointer</span>
                </h4>
                {error.diagnostics[0]?.filePath && (
                  <span className="text-xs font-mono text-slate-400">
                    {error.diagnostics[0].filePath}:{error.diagnostics[0].line || 1}
                  </span>
                )}
              </div>

              {error.diagnostics.map((diag, dIdx) => (
                <div key={dIdx} className="space-y-3">
                  <div className="text-xs text-red-300 bg-red-500/10 p-2.5 rounded border border-red-500/30 font-mono">
                    {diag.message}
                  </div>

                  {diag.snippet && (
                    <pre className="text-xs font-mono p-3.5 bg-[#0A0A0B] rounded-lg border border-slate-800 overflow-x-auto text-slate-300 leading-relaxed">
                      {diag.snippet}
                    </pre>
                  )}

                  {diag.hint && (
                    <div className="text-xs text-blue-300 bg-blue-500/10 p-3 rounded-lg border border-blue-500/30 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>{diag.hint}</span>
                    </div>
                  )}

                  {diag.autoFixCommand && (
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => onExecuteCommand(diag.autoFixCommand!)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-md transition-colors shadow-sm"
                      >
                        <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Run Auto-Fix: {diag.autoFixCommand}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Rollback Ledger Box */}
          {error.rollbackLog && error.rollbackLog.length > 0 && (
            <div className="border border-purple-900/40 bg-purple-950/20 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                  Atomic Rollback Ledger
                </h4>
              </div>
              <p className="text-xs text-slate-400">
                A multi-step operation encountered a failure midway. The atomic transaction manager caught the failure and rolled back state to prevent data corruption.
              </p>
              <div className="space-y-1.5 font-mono text-xs bg-[#0A0A0B] p-3.5 rounded-lg border border-purple-900/30">
                {error.rollbackLog.map((step, sIdx) => (
                  <div key={sIdx} className="flex items-center gap-2 text-slate-300">
                    <span className="text-emerald-400">✓</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Root Cause Diagnostics Box */}
          {aiDiagnosis && (
            <div className="border border-purple-800/60 bg-purple-950/30 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                    AI Deep Diagnostic Analysis
                  </h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/80 text-purple-300 border border-purple-700">
                  {aiDiagnosis.source === 'gemini-ai' ? 'Gemini 2.5 Flash' : 'Deterministic Rules Engine'}
                </span>
              </div>

              <div className="text-xs text-slate-200 space-y-2">
                <p className="font-semibold text-white">{aiDiagnosis.summary}</p>
                <p className="text-slate-300 leading-relaxed">{aiDiagnosis.rootCause}</p>
              </div>

              {Array.isArray(aiDiagnosis.suggestedFixes) && aiDiagnosis.suggestedFixes.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-bold text-slate-300">Recommended Steps:</span>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                    {aiDiagnosis.suggestedFixes.map((f: string, idx: number) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Cause Chain Hierarchy */}
          {error.causeChain && error.causeChain.length > 0 && (
            <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Root Cause Call Chain
              </h4>
              <div className="space-y-1.5 font-mono text-xs">
                {error.causeChain.map((cause, cIdx) => (
                  <div key={cIdx} className="flex items-start gap-2 text-slate-400">
                    <span className="text-slate-600 font-bold">{cIdx + 1}.</span>
                    <span className={cIdx === error.causeChain.length - 1 ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                      {cause}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: POSIX Standard & Sysexits Card */}
        <div className="space-y-6">
          {/* POSIX Card */}
          <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                POSIX Exit Standards
              </h4>
            </div>

            <div className="p-3.5 bg-[#0A0A0B] rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Exit Code:</span>
                <span className="font-mono text-amber-400 font-bold">{error.exitCode}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Symbolic Name:</span>
                <span className="font-mono text-blue-400">{exitInfo.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Category:</span>
                <span className="text-slate-300">{exitInfo.category}</span>
              </div>
              <p className="text-xs text-slate-400 pt-2 border-t border-slate-800/80 leading-relaxed">
                {exitInfo.description}
              </p>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Standardized exit codes allow CI/CD runners and bash scripts to reliably distinguish between transient failures (e.g. 75 retryable) vs permanent usage errors (e.g. 64).
            </p>
          </div>

          {/* Machine JSON View */}
          <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Machine JSON Payload
              </h4>
              <button
                onClick={handleCopyJson}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="text-[10px] font-mono p-3 bg-[#0A0A0B] rounded-lg border border-slate-800 text-slate-400 max-h-60 overflow-y-auto leading-tight">
              {JSON.stringify(error.machineJson, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
