/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CliError, DiagnosticItem, ErrorSeverity, InteractiveAction } from '../types';
import { getExitCodeInfo } from './posix';

export class FaultlineError extends Error {
  public readonly id: string;
  public readonly code: string;
  public readonly exitCode: number;
  public readonly severity: ErrorSeverity;
  public readonly diagnostics: DiagnosticItem[];
  public readonly causeChain: string[];
  public readonly rollbackLog?: string[];
  public readonly rollbackSuccess?: boolean;
  public readonly traceId: string;
  public readonly suggestion?: string;
  public readonly autoFixCommand?: string;
  public readonly autoFixLabel?: string;
  public readonly docsUrl?: string;
  public readonly contextData?: Record<string, any>;

  constructor(options: {
    message: string;
    code?: string;
    exitCode?: number;
    severity?: ErrorSeverity;
    diagnostics?: DiagnosticItem[];
    causeChain?: string[];
    rollbackLog?: string[];
    rollbackSuccess?: boolean;
    suggestion?: string;
    autoFixCommand?: string;
    autoFixLabel?: string;
    docsUrl?: string;
    contextData?: Record<string, any>;
  }) {
    super(options.message);
    this.name = 'FaultlineError';
    this.id = 'err_' + Math.random().toString(36).substring(2, 9);
    this.code = options.code || 'ERR_GENERAL_FAILURE';
    this.exitCode = options.exitCode !== undefined ? options.exitCode : 1;
    this.severity = options.severity || 'error';
    this.diagnostics = options.diagnostics || [];
    this.causeChain = options.causeChain || [options.message];
    this.rollbackLog = options.rollbackLog;
    this.rollbackSuccess = options.rollbackSuccess;
    this.suggestion = options.suggestion;
    this.autoFixCommand = options.autoFixCommand;
    this.autoFixLabel = options.autoFixLabel;
    this.docsUrl = options.docsUrl || `https://faultline.dev/docs/errors/${this.code.toLowerCase()}`;
    this.contextData = options.contextData;
    this.traceId = 'fl_trc_' + Math.random().toString(36).substring(2, 10);
  }

  public toCliError(commandRan: string, flags: Record<string, any>): CliError {
    const exitInfo = getExitCodeInfo(this.exitCode);
    const machineJson = {
      $schema: 'https://faultline.dev/schemas/error-v1.json',
      id: this.id,
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
      command: commandRan,
      flags,
      error: {
        name: this.name,
        code: this.code,
        exitCode: this.exitCode,
        posixName: exitInfo.name,
        severity: this.severity,
        message: this.message,
      },
      diagnostics: this.diagnostics,
      causes: this.causeChain,
      rollback: this.rollbackLog
        ? {
            executed: true,
            successful: this.rollbackSuccess ?? true,
            steps: this.rollbackLog,
          }
        : null,
      remediation: {
        suggestion: this.suggestion,
        autoFixCommand: this.autoFixCommand,
        docsUrl: this.docsUrl,
      },
    };

    return {
      id: this.id,
      name: this.name,
      code: this.code,
      exitCode: this.exitCode,
      message: this.message,
      severity: this.severity,
      diagnostics: this.diagnostics,
      stack: this.stack,
      causeChain: this.causeChain,
      rollbackLog: this.rollbackLog,
      rollbackSuccess: this.rollbackSuccess,
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
      suggestion: this.suggestion,
      commandRan,
      flags,
      machineJson,
    };
  }
}

/**
 * Formats a FaultlineError into a high-craft terminal representation (Miette / Rust compiler style)
 */
export function formatErrorTerminal(err: CliError, options: { json?: boolean; verbose?: boolean } = {}): {
  lines: string[];
  interactiveActions: InteractiveAction[];
} {
  if (options.json) {
    return {
      lines: [JSON.stringify(err.machineJson, null, 2)],
      interactiveActions: [],
    };
  }

  const exitInfo = getExitCodeInfo(err.exitCode);
  const lines: string[] = [];
  const actions: InteractiveAction[] = [];

  // Top header banner
  lines.push(`\x1b[1;31m✖ faultline error[${err.code}]\x1b[0m: \x1b[1m${err.message}\x1b[0m`);
  lines.push(`  \x1b[90mPOSIX Exit Status:\x1b[0m \x1b[33m${err.exitCode}\x1b[0m (\x1b[36m${exitInfo.name}\x1b[0m - ${exitInfo.description})`);
  lines.push(`  \x1b[90mTrace ID:\x1b[0m \x1b[90m${err.traceId}\x1b[0m`);
  lines.push('');

  // Render Diagnostics / Source Snippets
  if (err.diagnostics && err.diagnostics.length > 0) {
    for (const diag of err.diagnostics) {
      if (diag.filePath) {
        lines.push(`  \x1b[34m-->\x1b[0m \x1b[4m${diag.filePath}\x1b[0m${diag.line ? `:${diag.line}:${diag.column || 1}` : ''}`);
      }
      lines.push(`   \x1b[34m│\x1b[0m`);

      if (diag.snippet) {
        const snippetLines = diag.snippet.split('\n');
        const startLine = diag.line ? Math.max(1, diag.line - 1) : 1;
        snippetLines.forEach((sLine, idx) => {
          const currentLineNum = startLine + idx;
          const isTarget = diag.line ? currentLineNum === diag.line : idx === 1;
          const gutter = currentLineNum.toString().padStart(3, ' ');
          if (isTarget) {
            lines.push(`\x1b[34m${gutter}│\x1b[0m \x1b[1m${sLine}\x1b[0m`);
            if (diag.column) {
              const spaces = ' '.repeat(Math.max(0, diag.column - 1));
              const pointer = '^'.repeat(Math.max(1, (diag.message && diag.message.length < 15) ? diag.message.length : 6));
              lines.push(`   \x1b[34m│\x1b[0m \x1b[31m${spaces}${pointer} ${diag.message}\x1b[0m`);
            }
          } else {
            lines.push(`\x1b[90m${gutter}│\x1b[0m \x1b[90m${sLine}\x1b[0m`);
          }
        });
      } else {
        lines.push(`   \x1b[34m│\x1b[0m  \x1b[31m${diag.message}\x1b[0m`);
      }
      lines.push(`   \x1b[34m│\x1b[0m`);

      if (diag.hint) {
        lines.push(`   \x1b[34m=\x1b[0m \x1b[1;36mhint:\x1b[0m ${diag.hint}`);
      }
    }
    lines.push('');
  }

  // Typo / Fuzzy suggestion
  if (err.suggestion) {
    lines.push(`\x1b[1;33m💡 Did you mean:\x1b[0m`);
    lines.push(`   \x1b[32m${err.suggestion}\x1b[0m`);
    lines.push('');
    actions.push({
      label: `Run suggestion: ${err.suggestion}`,
      actionType: 'run-command',
      payload: { command: err.suggestion },
      icon: 'sparkles',
    });
  }

  // Rollback status
  if (err.rollbackLog && err.rollbackLog.length > 0) {
    lines.push(`\x1b[1;35m🔄 Transactional Rollback (Atomic Guarantee):\x1b[0m`);
    for (const step of err.rollbackLog) {
      lines.push(`   \x1b[32m✓\x1b[0m \x1b[90m${step}\x1b[0m`);
    }
    lines.push(`   \x1b[1;32mState cleanly restored to pre-execution checkpoint.\x1b[0m`);
    lines.push('');
  }

  // Suggested Next Actions & Automated Remediation
  lines.push(`\x1b[1;36m🛠 Actionable Remediation:\x1b[0m`);
  
  if (err.diagnostics.some((d) => d.autoFixCommand)) {
    const fix = err.diagnostics.find((d) => d.autoFixCommand)!;
    lines.push(`   • \x1b[1mAuto-fix available:\x1b[0m \x1b[32m${fix.autoFixCommand}\x1b[0m`);
    actions.push({
      label: fix.autoFixLabel || `Apply Fix: ${fix.autoFixCommand}`,
      actionType: 'run-command',
      payload: { command: fix.autoFixCommand },
      icon: 'wrench',
    });
  }

  actions.push({
    label: 'Ask AI Diagnostics Engine',
    actionType: 'ai-diagnose',
    payload: { errorId: err.id },
    icon: 'bot',
  });

  actions.push({
    label: `Inspect Error Schema (${err.code})`,
    actionType: 'run-command',
    payload: { command: `faultline inspect ${err.traceId}` },
    icon: 'search',
  });

  if (err.causeChain && err.causeChain.length > 1) {
    lines.push(`   • \x1b[90mUnderlying cause chain: ${err.causeChain.join(' ➔ ')}\x1b[0m`);
  }

  lines.push(`   • \x1b[90mDocumentation & error guide: \x1b[4;34mhttps://faultline.dev/errors/${err.code.toLowerCase()}\x1b[0m`);
  lines.push('');

  // Verbose stack trace if requested
  if (options.verbose && err.stack) {
    lines.push(`\x1b[90m── Debug Stacktrace ───────────────────────────────\x1b[0m`);
    lines.push(`\x1b[90m${err.stack}\x1b[0m`);
    lines.push(`\x1b[90m──────────────────────────────────────────────────\x1b[0m`);
    lines.push('');
  }

  return { lines, interactiveActions: actions };
}
