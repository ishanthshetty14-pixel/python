/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface PosixExitCodeInfo {
  code: number;
  name: string;
  category: string;
  description: string;
}

export interface DiagnosticItem {
  code: string;
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
  snippet?: string;
  hint?: string;
  autoFixCommand?: string;
  autoFixLabel?: string;
  docsUrl?: string;
}

export interface CliError {
  id: string;
  name: string;
  code: string;
  exitCode: number;
  message: string;
  severity: ErrorSeverity;
  diagnostics: DiagnosticItem[];
  stack?: string;
  causeChain: string[];
  rollbackLog?: string[];
  rollbackSuccess?: boolean;
  traceId: string;
  timestamp: string;
  suggestion?: string;
  commandRan: string;
  flags: Record<string, any>;
  machineJson: Record<string, any>;
}

export interface VirtualFile {
  path: string;
  name: string;
  content: string;
  mode: number; // e.g. 0o644 (rw-r--r--), 0o400 (r--------)
  owner: string;
  updatedAt: string;
  isDirectory: boolean;
  size?: number;
}

export interface InteractiveAction {
  label: string;
  actionType: 'run-command' | 'fix-file' | 'retry' | 'ai-diagnose' | 'rollback';
  payload: any;
  icon?: string;
}

export interface ExecutionResult {
  stdout: string[];
  stderr: string[];
  exitCode: number;
  durationMs: number;
  error?: CliError;
  rollbackTriggered?: boolean;
  interactiveActions?: InteractiveAction[];
  rawCommand: string;
  timestamp: string;
}

export interface ChaosScenario {
  id: string;
  category: 'Configuration' | 'Permissions' | 'Network' | 'Concurrency' | 'Filesystem' | 'CLI Syntax' | 'Transactions';
  title: string;
  description: string;
  command: string;
  expectedError: string;
  exitCode: number;
  resilienceFeature: string;
  tags: string[];
  setupHook?: () => void;
}

export type TerminalTheme = 'classic-dark' | 'monokai' | 'dracula' | 'tokyo-night' | 'clean-light' | 'nord';

export interface CommandHistoryEntry {
  id: string;
  command: string;
  result: ExecutionResult;
  timestamp: string;
}
