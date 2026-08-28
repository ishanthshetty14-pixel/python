/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, CornerDownLeft, Sparkles, Copy, Check, Download, Trash2, ShieldAlert, Wrench, RefreshCw, Bot, Terminal as TerminalIcon, AlertOctagon, ArrowRight } from 'lucide-react';
import { CommandHistoryEntry, InteractiveAction, TerminalTheme } from '../types';
import { parseAnsiToReact } from '../utils/ansi';

interface TerminalProps {
  history: CommandHistoryEntry[];
  onExecute: (cmd: string) => Promise<void>;
  onClear: () => void;
  isRunning: boolean;
  theme: TerminalTheme;
  onInspectError: () => void;
}

const THEME_STYLES: Record<TerminalTheme, { bg: string; text: string; prompt: string; border: string }> = {
  'classic-dark': {
    bg: 'bg-[#0A0A0B]',
    text: 'text-slate-200',
    prompt: 'text-emerald-400',
    border: 'border-slate-800',
  },
  'tokyo-night': {
    bg: 'bg-[#1a1b26]',
    text: 'text-[#c0caf5]',
    prompt: 'text-[#7aa2f7]',
    border: 'border-[#24283b]',
  },
  'monokai': {
    bg: 'bg-[#272822]',
    text: 'text-[#f8f8f2]',
    prompt: 'text-[#a6e22e]',
    border: 'border-[#3e3d32]',
  },
  'dracula': {
    bg: 'bg-[#282a36]',
    text: 'text-[#f8f8f2]',
    prompt: 'text-[#50fa7b]',
    border: 'border-[#44475a]',
  },
  'nord': {
    bg: 'bg-[#2e3440]',
    text: 'text-[#d8dee9]',
    prompt: 'text-[#88c0d0]',
    border: 'border-[#434c5e]',
  },
  'clean-light': {
    bg: 'bg-slate-900',
    text: 'text-slate-100',
    prompt: 'text-blue-400',
    border: 'border-slate-700',
  },
};

const SUGGESTED_SHORTCUTS = [
  { label: 'faultline help', cmd: 'faultline help' },
  { label: 'faultline deploy', cmd: 'faultline deploy' },
  { label: 'faultline doctor --fix', cmd: 'faultline doctor --fix' },
  { label: 'faultline migrate', cmd: 'faultline migrate' },
  { label: 'faultline deploy --json', cmd: 'faultline deploy --json' },
  { label: 'faultline chaos rate-limit', cmd: 'faultline chaos rate-limit' },
  { label: 'faultline fs ls', cmd: 'faultline fs ls' },
];

const AUTOCOMPLETE_CATALOG = [
  'faultline deploy --env=staging',
  'faultline deploy --dry-run',
  'faultline deploy --json',
  'faultline deploy --retries=5',
  'faultline migrate',
  'faultline doctor',
  'faultline doctor --fix',
  'faultline config get',
  'faultline config set database.port 5432',
  'faultline config init',
  'faultline config validate',
  'faultline chaos typo',
  'faultline chaos missing-config',
  'faultline chaos corrupt-json',
  'faultline chaos permission-denied',
  'faultline chaos rate-limit',
  'faultline chaos rollback',
  'faultline chaos schema-error',
  'faultline chaos sigint',
  'faultline inspect',
  'faultline diagnose',
  'faultline fs ls',
  'faultline fs chmod 644 /workspace/.env.secret',
  'faultline fs cat /workspace/faultline.config.json',
  'faultline rollback',
  'faultline clear',
  'faultline version',
  'faultline help',
];

export const TerminalComponent: React.FC<TerminalProps> = ({
  history,
  onExecute,
  onClear,
  isRunning,
  theme,
  onInspectError,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  const currentTheme = THEME_STYLES[theme] || THEME_STYLES['classic-dark'];

  // Latest error entry for intelligent suggestion banner
  const latestErrorEntry = [...history].reverse().find((h) => h.result.exitCode !== 0);

  // Auto-scroll on new output
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isRunning]);

  // Focus input on click anywhere on terminal body
  const handleTerminalClick = (e: React.MouseEvent) => {
    if (window.getSelection()?.toString()) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'BUTTON' && target.tagName !== 'A') {
      inputRef.current?.focus();
    }
  };

  // Autocomplete suggestion ghost
  const ghostSuggestion = React.useMemo(() => {
    if (!inputVal.trim()) return '';
    const match = AUTOCOMPLETE_CATALOG.find((cmd) => cmd.startsWith(inputVal.trim()));
    if (match && match !== inputVal) {
      return match.slice(inputVal.length);
    }
    return '';
  }, [inputVal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isRunning) return;
    const cmdToRun = inputVal;
    setInputVal('');
    setHistoryIndex(null);
    await onExecute(cmdToRun);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (ghostSuggestion) {
        setInputVal(inputVal + ghostSuggestion);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputVal(history[nextIndex]?.command || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === null) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInputVal('');
      } else {
        setHistoryIndex(nextIndex);
        setInputVal(history[nextIndex]?.command || '');
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      onClear();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      onExecute('faultline chaos sigint');
    }
  };

  const handleCopyOutput = (entry: CommandHistoryEntry, index: number) => {
    const text = [
      `$ ${entry.command}`,
      ...entry.result.stdout,
      ...entry.result.stderr,
      `[Exit: ${entry.result.exitCode}]`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownloadLog = () => {
    const fullLog = history
      .map(
        (h) =>
          `[${h.timestamp}] $ ${h.command}\n${[...h.result.stdout, ...h.result.stderr].join('\n')}\nExit: ${h.result.exitCode} (${h.result.durationMs}ms)\n---`
      )
      .join('\n\n');
    const blob = new Blob([fullLog], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faultline-session-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col h-full ${currentTheme.bg} ${currentTheme.text} font-mono text-xs select-text relative`}>
      {/* Terminal Titlebar Bar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${currentTheme.border} bg-[#0F0F11]/80 text-slate-400 select-none shrink-0`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 ml-1">
            <TerminalIcon className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-300 font-semibold">developer@faultline</span>
            <span className="text-slate-600">:</span>
            <span className="text-blue-400">~/workspace</span>
            <span className="text-slate-500">(main)</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-500 hidden md:inline">
            <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px]">Tab</kbd> Complete •{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px]">Ctrl+L</kbd> Clear •{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px]">Ctrl+C</kbd> SIGINT
          </span>

          <div className="flex items-center gap-1">
            <button
              id="btn-download-log"
              onClick={handleDownloadLog}
              className="p-1 hover:text-white rounded hover:bg-slate-800 text-slate-400 transition-colors"
              title="Download full session log"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              id="btn-clear-terminal"
              onClick={onClear}
              className="p-1 hover:text-white rounded hover:bg-slate-800 text-slate-400 transition-colors"
              title="Clear terminal buffer (Ctrl+L)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Body / Output Stream */}
      <div
        id="terminal-output-container"
        onClick={handleTerminalClick}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 font-mono leading-relaxed cursor-text"
      >
        {/* Welcome message if empty */}
        {history.length === 0 && (
          <div className="text-slate-400 space-y-2 select-none border border-slate-800 bg-[#0F0F11]/60 p-4 rounded-xl shadow-sm">
            <div className="text-emerald-400 font-bold flex items-center gap-2 text-sm">
              <span>⚡ Welcome to Faultline CLI Interactive Sandbox</span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              This terminal is backed by a virtual POSIX filesystem and resilience engine.
              Execute commands, explore diagnostics, or inject chaos faults to observe how modern production CLIs handle failures.
            </p>
            <div className="text-[11px] text-slate-400 pt-1">
              Type <span className="text-blue-400 font-semibold">faultline help</span> or click any quick command below to begin.
            </div>
          </div>
        )}

        {/* Command History Stream */}
        {history.map((entry, idx) => {
          const isError = entry.result.exitCode !== 0;
          return (
            <div key={entry.id || idx} className="space-y-2.5 group">
              {/* Command Prompt Line */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-emerald-400 font-bold">➜</span>
                  <span className="text-blue-400 font-semibold">~/workspace</span>
                  <span className="text-slate-500">(main)</span>
                  <span className="text-slate-100 font-bold ml-1">{entry.command}</span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-500 opacity-80 group-hover:opacity-100 transition-opacity select-none">
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                      isError
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    Exit: {entry.result.exitCode}
                  </span>
                  <span>{entry.result.durationMs}ms</span>
                  <button
                    onClick={() => handleCopyOutput(entry, idx)}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 text-slate-400"
                    title="Copy command output"
                  >
                    {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Stdout lines */}
              {entry.result.stdout.length > 0 && (
                <div className="space-y-0.5 whitespace-pre-wrap pl-2 border-l-2 border-slate-800 text-slate-300">
                  {entry.result.stdout.map((line, lIdx) => (
                    <div key={`out-${lIdx}`}>{parseAnsiToReact(line, `out-${idx}-${lIdx}`)}</div>
                  ))}
                </div>
              )}

              {/* Stderr lines & Rich Diagnostic Card */}
              {entry.result.stderr.length > 0 && (
                <div className="space-y-1.5">
                  <div className="p-4 bg-red-500/10 border-l-4 border-red-500 rounded-r shadow-sm">
                    {entry.result.error && (
                      <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
                        <AlertOctagon className="w-4 h-4 shrink-0 text-red-400" />
                        <span>FATAL ERROR: {entry.result.error.message}</span>
                      </div>
                    )}

                    {entry.result.error?.code && (
                      <div className="text-red-300/90 text-xs mb-2 font-mono">
                        Code: <span className="bg-red-950/60 border border-red-800/60 px-1.5 py-0.5 rounded font-bold">{entry.result.error.code}</span>
                      </div>
                    )}

                    <div className="space-y-0.5 whitespace-pre-wrap text-slate-300">
                      {entry.result.stderr.map((line, lIdx) => (
                        <div key={`err-${lIdx}`}>{parseAnsiToReact(line, `err-${idx}-${lIdx}`)}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Embedded Interactive Action Buttons */}
              {entry.result.interactiveActions && entry.result.interactiveActions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1 pl-2">
                  {entry.result.interactiveActions.map((action, aIdx) => (
                    <button
                      key={`act-${aIdx}`}
                      onClick={async () => {
                        if (action.actionType === 'run-command') {
                          await onExecute(action.payload.command);
                        } else if (action.actionType === 'ai-diagnose') {
                          await onExecute('faultline diagnose');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-500 rounded-md transition-all shadow-sm active:scale-95"
                    >
                      {action.icon === 'wrench' && <Wrench className="w-3.5 h-3.5 text-amber-400" />}
                      {action.icon === 'bot' && <Bot className="w-3.5 h-3.5 text-purple-400" />}
                      {action.icon === 'sparkles' && <Sparkles className="w-3.5 h-3.5 text-blue-400" />}
                      {action.icon === 'search' && <ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Live Running Indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 text-blue-400 text-xs py-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Executing command pipeline...</span>
          </div>
        )}

        {/* Interactive Prompt Input Form */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 select-none shrink-0 text-xs">
            <span className="text-emerald-400 font-bold">➜</span>
            <span className="text-blue-400 font-semibold">~/workspace</span>
            <span className="text-slate-500 font-bold">$</span>
          </div>

          <div className="relative flex-1 flex items-center">
            {/* Ghost text autocomplete overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center text-slate-600 pl-0">
              <span className="invisible">{inputVal}</span>
              <span>{ghostSuggestion}</span>
            </div>

            <input
              id="terminal-interactive-input"
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="w-full bg-transparent text-white focus:outline-none font-mono text-xs z-10"
              placeholder={history.length === 0 ? "Type 'faultline help' or click a command..." : ""}
            />
          </div>

          <button
            type="submit"
            disabled={isRunning || !inputVal.trim()}
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Execute (Enter)"
          >
            <CornerDownLeft className="w-4 h-4" />
          </button>
        </form>

        <div ref={terminalBottomRef} />
      </div>

      {/* Intelligent Suggestion Banner from the Professional Polish Spec */}
      {latestErrorEntry && latestErrorEntry.result.error && (
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#0F0F11]/90 backdrop-blur-md select-none shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Intelligent Remediation Engine</span>
              </div>
              <div className="text-slate-200 text-xs sm:text-sm">
                {latestErrorEntry.result.error.diagnostics?.[0]?.hint ||
                  latestErrorEntry.result.error.suggestion ||
                  `Error code ${latestErrorEntry.result.error.code} reported. Run automated recovery or check configuration.`}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  const fixCmd =
                    latestErrorEntry.result.error?.diagnostics?.[0]?.autoFixCommand ||
                    'faultline doctor --fix';
                  onExecute(fixCmd);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-md shadow-lg shadow-blue-900/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <span>RUN AUTO-FIX</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onInspectError}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-md border border-slate-700 transition-colors"
              >
                Inspect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Command Shortcuts Footer */}
      <div className={`p-2 border-t ${currentTheme.border} bg-[#0A0A0B] flex items-center gap-1.5 overflow-x-auto select-none scrollbar-none shrink-0`}>
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0 px-2">
          Quick Run:
        </span>
        {SUGGESTED_SHORTCUTS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onExecute(item.cmd)}
            className="shrink-0 px-2.5 py-1 rounded text-[11px] bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors font-mono"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};
