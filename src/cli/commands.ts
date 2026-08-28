/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExecutionResult, CliError, InteractiveAction } from '../types';
import { vfs } from './filesystem';
import { FaultlineError, formatErrorTerminal } from './errorEngine';
import { findClosestSuggestions } from './levenshtein';

export interface CommandContext {
  lastError: CliError | null;
  setLastError: (err: CliError | null) => void;
  onRunCommand: (cmd: string) => void;
  onInspectError: (err: CliError) => void;
}

const KNOWN_COMMANDS = [
  'run',
  'deploy',
  'migrate',
  'doctor',
  'config',
  'chaos',
  'inspect',
  'rollback',
  'fs',
  'help',
  'version',
  'clear',
  'diagnose',
];

const KNOWN_DEPLOY_FLAGS = [
  '--env',
  '--config',
  '--dry-run',
  '--retries',
  '--timeout',
  '--json',
  '--verbose',
  '--force',
  '--quiet',
];

/**
 * Parses arguments into positional args and flags
 */
function parseArgs(rawArgs: string[]): {
  positionals: string[];
  flags: Record<string, any>;
  rawFlags: string[];
} {
  const positionals: string[] = [];
  const flags: Record<string, any> = {};
  const rawFlags: string[] = [];

  let i = 0;
  while (i < rawArgs.length) {
    const arg = rawArgs[i];
    if (arg.startsWith('--')) {
      rawFlags.push(arg);
      const [key, val] = arg.slice(2).split('=');
      if (val !== undefined) {
        flags[key] = val;
      } else if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) {
        flags[key] = rawArgs[i + 1];
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      rawFlags.push(arg);
      const shortKey = arg.slice(1);
      if (shortKey === 'v') flags['verbose'] = true;
      else if (shortKey === 'q') flags['quiet'] = true;
      else if (shortKey === 'h') flags['help'] = true;
      else if (shortKey === 'j') flags['json'] = true;
      else flags[shortKey] = true;
    } else {
      positionals.push(arg);
    }
    i++;
  }

  return { positionals, flags, rawFlags };
}

/**
 * Core CLI execution engine
 */
export async function executeCommand(
  rawInput: string,
  ctx: CommandContext
): Promise<ExecutionResult> {
  const startTime = performance.now();
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      stdout: [],
      stderr: [],
      exitCode: 0,
      durationMs: 0,
      rawCommand: rawInput,
      timestamp: new Date().toISOString(),
    };
  }

  // Split tokens (respecting quotes)
  const tokens: string[] = [];
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    tokens.push(match[1] || match[2] || match[0]);
  }

  const rootBin = tokens[0];
  let subArgs = tokens.slice(1);

  // If user didn't prefix with "faultline" or "fl", assume they meant faultline
  if (rootBin !== 'faultline' && rootBin !== 'fl') {
    // Check if it's a known shell utility or direct subcommand
    if (rootBin === 'clear' || rootBin === 'help' || rootBin === 'doctor' || KNOWN_COMMANDS.includes(rootBin)) {
      subArgs = tokens;
    } else if (rootBin.startsWith('fault') || rootBin.startsWith('faul') || rootBin.startsWith('flt')) {
      // Typo in binary name
      const err = new FaultlineError({
        message: `Command '${rootBin}' not recognized.`,
        code: 'ERR_BINARY_NOT_FOUND',
        exitCode: 127,
        suggestion: `faultline ${subArgs.join(' ')}`.trim(),
        diagnostics: [
          {
            code: 'ERR_COMMAND_TYPO',
            message: `Did you mean the primary binary 'faultline'?`,
            hint: `Use 'faultline --help' to list available subcommands.`,
          },
        ],
      });
      const cliErr = err.toCliError(rawInput, {});
      ctx.setLastError(cliErr);
      const { lines, interactiveActions } = formatErrorTerminal(cliErr);
      return {
        stdout: [],
        stderr: lines,
        exitCode: 127,
        durationMs: Math.round(performance.now() - startTime),
        error: cliErr,
        interactiveActions,
        rawCommand: rawInput,
        timestamp: new Date().toISOString(),
      };
    }
  }

  const { positionals, flags, rawFlags } = parseArgs(subArgs);
  const isJson = !!flags['json'];
  const isVerbose = !!flags['verbose'];
  const isDryRun = !!flags['dry-run'];

  const subcommand = positionals[0] || (flags['help'] || flags['h'] ? 'help' : (flags['version'] ? 'version' : 'help'));

  try {
    // Handle typos on subcommands
    if (subcommand && !KNOWN_COMMANDS.includes(subcommand) && !flags['help']) {
      const suggestions = findClosestSuggestions(subcommand, KNOWN_COMMANDS);
      const suggestedCmd = suggestions.length > 0 ? `faultline ${suggestions[0]} ${subArgs.slice(1).join(' ')}`.trim() : undefined;
      
      throw new FaultlineError({
        message: `Unknown subcommand '${subcommand}'.`,
        code: 'ERR_UNKNOWN_SUBCOMMAND',
        exitCode: 64, // EX_USAGE
        suggestion: suggestedCmd,
        diagnostics: [
          {
            code: 'ERR_INVALID_USAGE',
            message: `Command 'faultline ${subcommand}' does not exist.`,
            hint: suggestions.length > 0 ? `Did you mean 'faultline ${suggestions[0]}'?` : `Run 'faultline --help' for a full list of commands.`,
            autoFixCommand: suggestedCmd,
            autoFixLabel: suggestedCmd ? `Run: ${suggestedCmd}` : undefined,
          },
        ],
      });
    }

    // Dispatch subcommands
    let result: { stdout: string[]; stderr: string[]; exitCode: number };

    switch (subcommand) {
      case 'help':
        result = handleHelp(positionals.slice(1), flags);
        break;

      case 'version':
        result = handleVersion(flags);
        break;

      case 'clear':
        result = { stdout: ['\x1b[2J\x1b[H\x1b[90m[Terminal screen buffer cleared]\x1b[0m'], stderr: [], exitCode: 0 };
        break;

      case 'doctor':
        result = await handleDoctor(flags);
        break;

      case 'deploy':
        result = await handleDeploy(positionals.slice(1), flags, rawFlags, rawInput);
        break;

      case 'migrate':
        result = await handleMigrate(positionals.slice(1), flags, rawInput);
        break;

      case 'config':
        result = handleConfig(positionals.slice(1), flags);
        break;

      case 'fs':
        result = handleFileSystem(positionals.slice(1), flags);
        break;

      case 'chaos':
        result = await handleChaos(positionals.slice(1), flags, ctx);
        break;

      case 'inspect':
        result = handleInspect(positionals.slice(1), ctx, flags);
        break;

      case 'rollback':
        result = handleRollback();
        break;

      case 'diagnose':
      case 'ai-fix':
        result = await handleDiagnose(ctx, flags);
        break;

      default:
        result = handleHelp([], flags);
        break;
    }

    ctx.setLastError(null);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: Math.round(performance.now() - startTime),
      rawCommand: rawInput,
      timestamp: new Date().toISOString(),
    };
  } catch (rawError: any) {
    let err: FaultlineError;
    if (rawError instanceof FaultlineError) {
      err = rawError;
    } else {
      err = new FaultlineError({
        message: rawError?.message || 'An unexpected operational failure occurred.',
        code: 'ERR_RUNTIME_PANIC',
        exitCode: 70, // EX_SOFTWARE
        causeChain: [rawError?.message || String(rawError)],
      });
    }

    const cliErr = err.toCliError(rawInput, flags);
    ctx.setLastError(cliErr);

    const { lines, interactiveActions } = formatErrorTerminal(cliErr, {
      json: isJson,
      verbose: isVerbose,
    });

    return {
      stdout: [],
      stderr: lines,
      exitCode: cliErr.exitCode,
      durationMs: Math.round(performance.now() - startTime),
      error: cliErr,
      interactiveActions,
      rawCommand: rawInput,
      timestamp: new Date().toISOString(),
    };
  }
}

function handleHelp(args: string[], flags: Record<string, any>) {
  if (flags['json']) {
    return {
      stdout: [
        JSON.stringify(
          {
            name: 'faultline',
            version: '2.4.0',
            description: 'Ultra-resilient developer CLI engine with deterministic error handling & diagnostics',
            commands: KNOWN_COMMANDS,
          },
          null,
          2
        ),
      ],
      stderr: [],
      exitCode: 0,
    };
  }

  const lines = [
    `\x1b[1;36mFAULTLINE CLI\x1b[0m \x1b[90mv2.4.0 (x86_64-linux-gnu)\x1b[0m`,
    `Production-grade command line tool built for extreme resilience and graceful error recovery.`,
    '',
    `\x1b[1mUSAGE:\x1b[0m`,
    `  \x1b[32mfaultline\x1b[0m <subcommand> [flags] [arguments]`,
    '',
    `\x1b[1mPRIMARY SUBCOMMANDS:\x1b[0m`,
    `  \x1b[32mdeploy\x1b[0m        Deploy service to cluster with pre-flight schema checks and auto-retry`,
    `  \x1b[32mmigrate\x1b[0m       Execute transactional database migrations with atomic rollback`,
    `  \x1b[32mdoctor\x1b[0m        Run multi-point system health diagnostics & verify permissions`,
    `  \x1b[32mconfig\x1b[0m        Validate, inspect, or modify configuration files and keys`,
    `  \x1b[32mchaos\x1b[0m         Inject simulated real-world faults to test CLI resilience behavior`,
    `  \x1b[32minspect\x1b[0m       Deep-dive into the schema, stack, and causes of the most recent error`,
    `  \x1b[32mdiagnose\x1b[0m      Ask the AI diagnostic engine for root cause & remediation diffs`,
    `  \x1b[32mfs\x1b[0m            Simulated filesystem operations (ls, cat, chmod, write, rm, reset)`,
    `  \x1b[32mrollback\x1b[0m      Revert filesystem to the latest healthy transaction snapshot`,
    `  \x1b[32mclear\x1b[0m         Clear the terminal screen buffer`,
    `  \x1b[32mversion\x1b[0m       Display CLI build version, runtime environment, and POSIX compatibility`,
    '',
    `\x1b[1mGLOBAL FLAGS:\x1b[0m`,
    `  \x1b[33m--json\x1b[0m        Output machine-readable JSON schema (essential for CI/CD pipelines)`,
    `  \x1b[33m--dry-run\x1b[0m     Simulate command execution without applying state modifications`,
    `  \x1b[33m--verbose, -v\x1b[0m Enable verbose debug output, stack traces, and timing spans`,
    `  \x1b[33m--quiet, -q\x1b[0m   Suppress non-essential informational messages`,
    `  \x1b[33m--help, -h\x1b[0m    Show context-sensitive help for commands and flags`,
    '',
    `\x1b[90mTip: Try intentionally breaking things with 'faultline chaos' to inspect error mechanics.\x1b[0m`,
  ];

  return { stdout: lines, stderr: [], exitCode: 0 };
}

function handleVersion(flags: Record<string, any>) {
  if (flags['json']) {
    return {
      stdout: [
        JSON.stringify(
          {
            binary: 'faultline',
            version: '2.4.0-stable',
            commit: '8b4f19a',
            target: 'x86_64-linux-gnu',
            node: 'v22.14.0',
            posixSpec: 'IEEE Std 1003.1-2017',
            exitCodeSpec: 'BSD sysexits.h',
          },
          null,
          2
        ),
      ],
      stderr: [],
      exitCode: 0,
    };
  }

  return {
    stdout: [
      `\x1b[1;36mfaultline\x1b[0m 2.4.0 (commit: \x1b[90m8b4f19a\x1b[0m, target: \x1b[90mx86_64-linux-gnu\x1b[0m)`,
      `POSIX Standard: IEEE Std 1003.1-2017 / BSD Sysexits compliance`,
      `Resilience Engine: Atomic Snapshots & Levenshtein Typo Guard Enabled`,
    ],
    stderr: [],
    exitCode: 0,
  };
}

async function handleDeploy(
  positionals: string[],
  flags: Record<string, any>,
  rawFlags: string[],
  rawCommand: string
) {
  // Check for typo in flags (e.g. --enviroment instead of --env)
  for (const rf of rawFlags) {
    const flagKey = rf.split('=')[0];
    if (!KNOWN_DEPLOY_FLAGS.includes(flagKey)) {
      const suggestions = findClosestSuggestions(flagKey, KNOWN_DEPLOY_FLAGS);
      const fixedCmd = suggestions.length > 0 ? rawCommand.replace(flagKey, suggestions[0]) : undefined;
      throw new FaultlineError({
        message: `Unknown option '${flagKey}' passed to 'faultline deploy'.`,
        code: 'ERR_CLI_INVALID_FLAG',
        exitCode: 64, // EX_USAGE
        suggestion: fixedCmd,
        diagnostics: [
          {
            code: 'ERR_FLAG_TYPO',
            message: `Flag '${flagKey}' is not supported.`,
            hint: suggestions.length > 0 ? `Did you mean '${suggestions[0]}'?` : `Supported flags: ${KNOWN_DEPLOY_FLAGS.join(', ')}`,
            autoFixCommand: fixedCmd,
          },
        ],
      });
    }
  }

  const env = flags['env'] || 'staging';
  const configPath = flags['config'] || '/workspace/faultline.config.json';
  const isDryRun = !!flags['dry-run'];
  const maxRetries = parseInt(flags['retries'] || '3', 10);

  const lines: string[] = [];
  lines.push(`\x1b[1;34m[1/4]\x1b[0m \x1b[1mValidating deployment environment and credentials...\x1b[0m`);

  // Step 1: Read configuration file
  if (!vfs.exists(configPath)) {
    throw new FaultlineError({
      message: `Configuration file '${configPath}' does not exist.`,
      code: 'ERR_CONFIG_NOT_FOUND',
      exitCode: 66, // EX_NOINPUT
      diagnostics: [
        {
          filePath: configPath,
          code: 'ENOENT',
          message: `Cannot open file for reading (No such file or directory)`,
          hint: `Run 'faultline config init' to generate a default configuration.`,
          autoFixCommand: `faultline config init`,
          autoFixLabel: `Initialize Default Config`,
        },
      ],
    });
  }

  const configFile = vfs.readFile(configPath);
  let configObj: any;
  try {
    configObj = JSON.parse(configFile.content);
  } catch (jsonErr: any) {
    // Find approximate line of JSON error
    const match = /position (\d+)/i.exec(jsonErr.message);
    const pos = match ? parseInt(match[1], 10) : 0;
    const linesBefore = configFile.content.slice(0, pos).split('\n');
    const lineNum = linesBefore.length;
    const colNum = linesBefore[linesBefore.length - 1].length + 1;

    throw new FaultlineError({
      message: `Failed to parse configuration file '${configPath}': ${jsonErr.message}`,
      code: 'ERR_CONFIG_SYNTAX_ERROR',
      exitCode: 65, // EX_DATAERR
      diagnostics: [
        {
          code: 'ERR_CONFIG_SYNTAX',
          filePath: configPath,
          line: lineNum,
          column: colNum,
          snippet: configFile.content,
          message: `Syntax error: Invalid JSON structure near character ${pos}`,
          hint: `Ensure all quotes are closed and trailing commas are removed.`,
          autoFixCommand: `faultline config validate --fix`,
          autoFixLabel: `Auto-repair Config JSON`,
        },
      ],
    });
  }

  // Schema Validation Check
  if (!configObj.database || typeof configObj.database.port !== 'number') {
    throw new FaultlineError({
      message: `Invalid configuration schema in '${configPath}'.`,
      code: 'ERR_CONFIG_INVALID_SCHEMA',
      exitCode: 65, // EX_DATAERR
      diagnostics: [
        {
          code: 'ERR_PORT_TYPE',
          filePath: configPath,
          line: 14,
          column: 14,
          snippet: `"database": {\n  "port": ${JSON.stringify(configObj.database?.port ?? 'MISSING')},\n  "name": "app_prod"\n}`,
          message: `Field 'database.port' must be a valid positive integer between 1024 and 65535`,
          hint: `Update 'database.port' to 5432 or use 'faultline config set database.port 5432'.`,
          autoFixCommand: `faultline config set database.port 5432`,
          autoFixLabel: `Set database.port to 5432`,
        },
      ],
    });
  }

  // Step 2: Check Secret permissions (.env.secret)
  lines.push(`\x1b[1;34m[2/4]\x1b[0m \x1b[1mChecking runtime secrets permissions...\x1b[0m`);
  try {
    vfs.readFile('/workspace/.env.secret');
  } catch (secErr: any) {
    if (secErr.code === 'EACCES') {
      throw new FaultlineError({
        message: `Permission denied reading secret vault '/workspace/.env.secret'.`,
        code: 'ERR_PERMISSION_DENIED',
        exitCode: 77, // EX_NOPERM
        diagnostics: [
          {
            filePath: '/workspace/.env.secret',
            code: 'EACCES',
            message: `Current process user (developer) lacks read permissions (mode: 0400, owned by root).`,
            hint: `Run 'chmod 644 /workspace/.env.secret' or use 'faultline fs chmod 644 /workspace/.env.secret'.`,
            autoFixCommand: `faultline fs chmod 644 /workspace/.env.secret`,
            autoFixLabel: `Fix File Permission (chmod 644)`,
          },
        ],
      });
    }
    throw secErr;
  }

  // Step 3: Network & Gateway Deployment Simulation
  lines.push(`\x1b[1;34m[3/4]\x1b[0m \x1b[1mConnecting to deployment orchestrator (cluster: ${configObj.cluster?.region || 'us-central1'})...\x1b[0m`);

  // Check if simulated network failure is active
  if (configObj.environment === 'chaos-rate-limit') {
    lines.push(`  \x1b[33m⚡ HTTP 429 Too Many Requests: Rate limit exceeded on gateway endpoint.\x1b[0m`);
    lines.push(`  \x1b[90mInitiating exponential backoff retry algorithm (max: ${maxRetries} attempts)...\x1b[0m`);
    
    // Simulate retries
    for (let r = 1; r <= maxRetries; r++) {
      const backoffMs = Math.round(100 * Math.pow(1.8, r));
      lines.push(`  \x1b[33m⟳ Attempt ${r}/${maxRetries} (backed off ${backoffMs}ms): 429 RateLimit\x1b[0m`);
    }

    throw new FaultlineError({
      message: `Gateway rate limit reached after ${maxRetries} exponential backoff retries.`,
      code: 'ERR_RATE_LIMIT_EXHAUSTED',
      exitCode: 75, // EX_TEMPFAIL
      causeChain: [
        'POST https://api.cluster.internal/v1/deploy 429 Too Many Requests',
        `Retry-After header requested 30s pause`,
        `Exponential backoff exhausted limit (${maxRetries} attempts)`,
      ],
      diagnostics: [
        {
          code: 'ERR_TEMPFAIL_RETRYABLE',
          message: `Upstream gateway is experiencing traffic throttling.`,
          hint: `Wait 30 seconds and retry, or run with '--retries=5'. This error code (75) is temporary.`,
          autoFixCommand: `faultline deploy --retries=5`,
        },
      ],
    });
  }

  // Step 4: Complete deployment
  lines.push(`\x1b[1;34m[4/4]\x1b[0m \x1b[1mApplying service manifest (${configObj.name}:${configObj.version})...\x1b[0m`);

  if (isDryRun) {
    lines.push('');
    lines.push(`\x1b[1;33m[DRY-RUN MODE]\x1b[0m Validation passed. No real cluster state was altered.`);
    lines.push(`  • Target Environment: \x1b[36m${env}\x1b[0m`);
    lines.push(`  • Replicas: \x1b[36m${configObj.cluster?.replicas || 3}\x1b[0m`);
    lines.push(`  • Image: \x1b[36m${configObj.name}:${configObj.version}\x1b[0m`);
    lines.push(`  • Safety Check: \x1b[32mPASSED (0 warnings)\x1b[0m`);
  } else {
    lines.push('');
    lines.push(`\x1b[1;32m✔ Deployment successfully concluded!\x1b[0m`);
    lines.push(`  • Service: \x1b[1m${configObj.name}\x1b[0m (v${configObj.version})`);
    lines.push(`  • Active URL: \x1b[4;36mhttps://${configObj.name}.${env}.cloud.internal\x1b[0m`);
    lines.push(`  • Replicas Healthy: \x1b[32m${configObj.cluster?.replicas || 3}/${configObj.cluster?.replicas || 3}\x1b[0m`);
  }

  return { stdout: lines, stderr: [], exitCode: 0 };
}

async function handleMigrate(
  positionals: string[],
  flags: Record<string, any>,
  rawCommand: string
) {
  const isDryRun = !!flags['dry-run'];
  const lines: string[] = [];

  lines.push(`\x1b[1;34m[1/3]\x1b[0m \x1b[1mAcquiring exclusive migration advisory lock...\x1b[0m`);
  lines.push(`  \x1b[32m✓\x1b[0m Lock acquired on cluster database \x1b[90m(pid: 4182)\x1b[0m`);

  lines.push(`\x1b[1;34m[2/3]\x1b[0m \x1b[1mCreating pre-migration snapshot checkpoint...\x1b[0m`);
  const snapshotId = vfs.createSnapshot();
  lines.push(`  \x1b[32m✓\x1b[0m Checkpoint #\x1b[36m${snapshotId}\x1b[0m captured \x1b[90m(schema, tables, indices)\x1b[0m`);

  lines.push(`\x1b[1;34m[3/3]\x1b[0m \x1b[1mExecuting migration scripts in sequential order...\x1b[0m`);
  
  // Migration 001
  lines.push(`  \x1b[32m➔\x1b[0m Applying \x1b[1m001_init.sql\x1b[0m... \x1b[32m[DONE in 14ms]\x1b[0m`);
  
  // Migration 002
  lines.push(`  \x1b[32m➔\x1b[0m Applying \x1b[1m002_add_index.sql\x1b[0m... \x1b[32m[DONE in 21ms]\x1b[0m`);

  // Migration 003 (Intentionally broken to demonstrate atomic rollback guarantee)
  const brokenMigration = vfs.readFile('/workspace/migrations/003_broken_syntax.sql');
  if (brokenMigration.content.includes('INVALID_SYNTAX_TRIGGER_FAIL')) {
    // Perform transactional rollback!
    vfs.rollbackToLastSnapshot();

    const rollbackSteps = [
      'Released PostgreSQL advisory lock 0x4182',
      'Reverted CREATE INDEX idx_audit_created ON audit_logs',
      'Dropped newly created table audit_logs',
      `Restored snapshot #${snapshotId} cleanly`,
    ];

    throw new FaultlineError({
      message: `Migration 003_broken_syntax.sql failed. Atomic rollback executed.`,
      code: 'ERR_MIGRATION_FAILED_ATOMIC_ROLLBACK',
      exitCode: 65, // EX_DATAERR
      causeChain: [
        'PostgreSQL syntax error at or near "INVALID_SYNTAX_TRIGGER_FAIL"',
        'Statement execution aborted midway at migration step 3 of 3',
        'Transactional safety manager initiated rollback of steps 1 & 2',
      ],
      rollbackLog: rollbackSteps,
      rollbackSuccess: true,
      diagnostics: [
        {
          code: 'ERR_SQL_SYNTAX',
          filePath: '/workspace/migrations/003_broken_syntax.sql',
          line: 1,
          column: 49,
          snippet: brokenMigration.content,
          message: `SQL syntax error: unexpected token 'INVALID_SYNTAX_TRIGGER_FAIL'`,
          hint: `Fix the SQL statement syntax in 003_broken_syntax.sql. No partial migration data remains in the database.`,
          autoFixCommand: `faultline fs write /workspace/migrations/003_broken_syntax.sql "ALTER TABLE orders ADD COLUMN notes TEXT;"`,
          autoFixLabel: `Fix 003 SQL Syntax`,
        },
      ],
    });
  }

  lines.push(`  \x1b[32m➔\x1b[0m Applying \x1b[1m003_broken_syntax.sql\x1b[0m... \x1b[32m[DONE in 18ms]\x1b[0m`);
  lines.push('');
  lines.push(`\x1b[1;32m✔ All 3 database migrations applied cleanly with zero errors.\x1b[0m`);
  return { stdout: lines, stderr: [], exitCode: 0 };
}

async function handleDoctor(flags: Record<string, any>) {
  const shouldFix = !!flags['fix'];
  const lines: string[] = [];
  const issues: string[] = [];
  const fixesApplied: string[] = [];

  lines.push(`\x1b[1;36mFAULTLINE SYSTEM HEALTH DOCTOR\x1b[0m`);
  lines.push(`Scanning CLI runtime environment, permissions, filesystem, and configs...\n`);

  // Check 1: Config file presence & JSON validity
  lines.push(`\x1b[1m1. Configuration Health Check:\x1b[0m`);
  if (!vfs.exists('/workspace/faultline.config.json')) {
    issues.push('Config file is missing');
    if (shouldFix) {
      vfs.resetToDefaults();
      fixesApplied.push('Generated clean default faultline.config.json');
      lines.push(`  \x1b[32m✔\x1b[0m \x1b[32m[AUTO-FIXED]\x1b[0m Re-created default faultline.config.json`);
    } else {
      lines.push(`  \x1b[31m✖\x1b[0m Missing '/workspace/faultline.config.json' (Run 'faultline doctor --fix')`);
    }
  } else {
    try {
      const f = vfs.readFile('/workspace/faultline.config.json');
      const parsed = JSON.parse(f.content);
      if (typeof parsed.database?.port !== 'number') {
        issues.push('database.port is not a valid number');
        if (shouldFix) {
          parsed.database = parsed.database || {};
          parsed.database.port = 5432;
          vfs.writeFile('/workspace/faultline.config.json', JSON.stringify(parsed, null, 2));
          fixesApplied.push('Fixed database.port to 5432 in configuration');
          lines.push(`  \x1b[32m✔\x1b[0m \x1b[32m[AUTO-FIXED]\x1b[0m Set database.port = 5432 in config`);
        } else {
          lines.push(`  \x1b[31m✖\x1b[0m Invalid field: database.port is not a number`);
        }
      } else {
        lines.push(`  \x1b[32m✔\x1b[0m faultline.config.json parsed cleanly (version: ${parsed.version || '2.4.0'})`);
      }
    } catch (e: any) {
      issues.push(`Config file contains JSON syntax error: ${e.message}`);
      if (shouldFix) {
        vfs.resetToDefaults();
        fixesApplied.push('Replaced corrupt config with pristine template');
        lines.push(`  \x1b[32m✔\x1b[0m \x1b[32m[AUTO-FIXED]\x1b[0m Repaired JSON syntax in config`);
      } else {
        lines.push(`  \x1b[31m✖\x1b[0m JSON parse error in faultline.config.json`);
      }
    }
  }

  // Check 2: Secret permissions (.env.secret)
  lines.push(`\n\x1b[1m2. Secret Vault Permissions:\x1b[0m`);
  try {
    const sec = vfs.readFile('/workspace/.env.secret');
    lines.push(`  \x1b[32m✔\x1b[0m Secret vault '/workspace/.env.secret' is accessible (mode: 0${sec.mode.toString(8)})`);
  } catch (e: any) {
    issues.push(`Secret vault unreadable: ${e.message}`);
    if (shouldFix) {
      vfs.chmod('/workspace/.env.secret', 0o644);
      fixesApplied.push('Adjusted permissions on .env.secret to 0644');
      lines.push(`  \x1b[32m✔\x1b[0m \x1b[32m[AUTO-FIXED]\x1b[0m Granted read access via chmod 0644`);
    } else {
      lines.push(`  \x1b[31m✖\x1b[0m Permission denied on .env.secret (mode: 0400 read-locked)`);
    }
  }

  // Check 3: Migration Syntax
  lines.push(`\n\x1b[1m3. Database Migration Integrity:\x1b[0m`);
  const mig = vfs.readFile('/workspace/migrations/003_broken_syntax.sql');
  if (mig.content.includes('INVALID_SYNTAX_TRIGGER_FAIL')) {
    issues.push('003_broken_syntax.sql contains SQL syntax error');
    if (shouldFix) {
      vfs.writeFile('/workspace/migrations/003_broken_syntax.sql', 'ALTER TABLE orders ADD COLUMN notes TEXT;');
      fixesApplied.push('Repaired invalid SQL in 003_broken_syntax.sql');
      lines.push(`  \x1b[32m✔\x1b[0m \x1b[32m[AUTO-FIXED]\x1b[0m Corrected SQL syntax in migration 003`);
    } else {
      lines.push(`  \x1b[33m!\x1b[0m Migration 003 contains intentional syntax error trigger`);
    }
  } else {
    lines.push(`  \x1b[32m✔\x1b[0m All 3 SQL migrations validated`);
  }

  // Check 4: POSIX System Environment
  lines.push(`\n\x1b[1m4. POSIX Environment & Virtual Storage:\x1b[0m`);
  lines.push(`  \x1b[32m✔\x1b[0m File descriptors: OK (1024 max)`);
  lines.push(`  \x1b[32m✔\x1b[0m Available virtual disk: 42.1 GB free`);
  lines.push(`  \x1b[32m✔\x1b[0m Process signals (SIGINT, SIGTERM, SIGHUP): Handled`);

  lines.push('');
  if (issues.length === 0) {
    lines.push(`\x1b[1;32m✔ All doctor checks passed! Your CLI environment is completely healthy.\x1b[0m`);
    return { stdout: lines, stderr: [], exitCode: 0 };
  } else if (shouldFix) {
    lines.push(`\x1b[1;32m✔ Successfully applied ${fixesApplied.length} automated repair(s)!\x1b[0m`);
    return { stdout: lines, stderr: [], exitCode: 0 };
  } else {
    lines.push(`\x1b[1;33m⚠ Found ${issues.length} potential issue(s). Run \x1b[32mfaultline doctor --fix\x1b[33m to repair automatically.\x1b[0m`);
    return { stdout: lines, stderr: [], exitCode: 1 };
  }
}

function handleConfig(positionals: string[], flags: Record<string, any>) {
  const action = positionals[0] || 'get';
  const configPath = '/workspace/faultline.config.json';

  if (!vfs.exists(configPath)) {
    throw new FaultlineError({
      message: `Config file '${configPath}' not found.`,
      code: 'ERR_CONFIG_NOT_FOUND',
      exitCode: 66, // EX_NOINPUT
      diagnostics: [
        {
          code: 'ENOENT',
          filePath: configPath,
          message: 'ENOENT: no such file or directory',
          hint: `Run 'faultline config init' to create a new config file.`,
          autoFixCommand: 'faultline config init',
        },
      ],
    });
  }

  const f = vfs.readFile(configPath);
  let parsed: any;
  try {
    parsed = JSON.parse(f.content);
  } catch (e: any) {
    throw new FaultlineError({
      message: `Malformed JSON in '${configPath}': ${e.message}`,
      code: 'ERR_CONFIG_SYNTAX_ERROR',
      exitCode: 65,
    });
  }

  if (action === 'get') {
    const key = positionals[1];
    if (!key) {
      return {
        stdout: [JSON.stringify(parsed, null, 2)],
        stderr: [],
        exitCode: 0,
      };
    }
    const val = key.split('.').reduce((acc, part) => acc && acc[part], parsed);
    if (val === undefined) {
      throw new FaultlineError({
        message: `Config key '${key}' not found in '${configPath}'.`,
        code: 'ERR_CONFIG_KEY_NOT_FOUND',
        exitCode: 64,
        suggestion: `faultline config get cluster.region`,
      });
    }
    return {
      stdout: [typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)],
      stderr: [],
      exitCode: 0,
    };
  }

  if (action === 'set') {
    const key = positionals[1];
    const val = positionals[2];
    if (!key || val === undefined) {
      throw new FaultlineError({
        message: `Usage: faultline config set <key> <value>`,
        code: 'ERR_MISSING_ARGUMENT',
        exitCode: 64,
        diagnostics: [
          {
            code: 'ERR_MISSING_ARG',
            message: 'Both key and value arguments are required.',
            hint: 'Example: faultline config set database.port 5432',
          },
        ],
      });
    }

    const parts = key.split('.');
    let curr = parsed;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    const lastPart = parts[parts.length - 1];

    // Try parsing number or boolean
    let parsedVal: any = val;
    if (!isNaN(Number(val)) && val.trim() !== '') {
      parsedVal = Number(val);
    } else if (val === 'true') parsedVal = true;
    else if (val === 'false') parsedVal = false;

    curr[lastPart] = parsedVal;
    vfs.writeFile(configPath, JSON.stringify(parsed, null, 2));

    return {
      stdout: [`\x1b[32m✔\x1b[0m Successfully updated \x1b[1m${key}\x1b[0m = \x1b[36m${val}\x1b[0m in ${configPath}`],
      stderr: [],
      exitCode: 0,
    };
  }

  if (action === 'init') {
    vfs.resetToDefaults();
    return {
      stdout: [`\x1b[32m✔\x1b[0m Initialized default faultline.config.json and sample files.`],
      stderr: [],
      exitCode: 0,
    };
  }

  if (action === 'validate') {
    return {
      stdout: [`\x1b[32m✔\x1b[0m Configuration schema in ${configPath} is valid.`],
      stderr: [],
      exitCode: 0,
    };
  }

  throw new FaultlineError({
    message: `Unknown config action '${action}'.`,
    code: 'ERR_INVALID_ACTION',
    exitCode: 64,
    suggestion: 'Supported actions: get, set, init, validate',
  });
}

function handleFileSystem(positionals: string[], flags: Record<string, any>) {
  const action = positionals[0] || 'ls';

  if (action === 'ls') {
    const files = vfs.listFiles();
    const lines = [
      `\x1b[1mVirtual Filesystem: /workspace\x1b[0m (\x1b[36m${files.length} files\x1b[0m)`,
      `\x1b[90mMODE      OWNER      UPDATED              NAME\x1b[0m`,
      `\x1b[90m────────  ─────────  ───────────────────  ────────────────────\x1b[0m`,
    ];

    for (const f of files) {
      const modeStr = (f.mode & 0o400 ? 'r' : '-') + (f.mode & 0o200 ? 'w' : '-') + (f.mode & 0o100 ? 'x' : '-') +
                      (f.mode & 0o040 ? 'r' : '-') + (f.mode & 0o020 ? 'w' : '-') + (f.mode & 0o010 ? 'x' : '-') +
                      (f.mode & 0o004 ? 'r' : '-') + (f.mode & 0o002 ? 'w' : '-') + (f.mode & 0o001 ? 'x' : '-');
      const timeStr = f.updatedAt.slice(0, 19).replace('T', ' ');
      lines.push(`${modeStr}  ${f.owner.padEnd(9, ' ')}  ${timeStr}  \x1b[36m${f.path.replace('/workspace/', '')}\x1b[0m`);
    }

    return { stdout: lines, stderr: [], exitCode: 0 };
  }

  if (action === 'cat') {
    const targetPath = positionals[1];
    if (!targetPath) {
      throw new FaultlineError({
        message: 'Usage: faultline fs cat <file-path>',
        code: 'ERR_MISSING_ARGUMENT',
        exitCode: 64,
      });
    }
    const file = vfs.readFile(targetPath);
    return { stdout: [file.content], stderr: [], exitCode: 0 };
  }

  if (action === 'chmod') {
    const modeRaw = positionals[1];
    const targetPath = positionals[2];
    if (!modeRaw || !targetPath) {
      throw new FaultlineError({
        message: 'Usage: faultline fs chmod <octal-mode> <file-path>',
        code: 'ERR_MISSING_ARGUMENT',
        exitCode: 64,
        diagnostics: [{ code: 'ERR_USAGE', message: 'Example: faultline fs chmod 644 /workspace/.env.secret' }],
      });
    }
    const mode = parseInt(modeRaw, 8);
    vfs.chmod(targetPath, mode);
    return {
      stdout: [`\x1b[32m✔\x1b[0m Changed mode of '${targetPath}' to 0${mode.toString(8)}`],
      stderr: [],
      exitCode: 0,
    };
  }

  if (action === 'write') {
    const targetPath = positionals[1];
    const content = positionals.slice(2).join(' ');
    if (!targetPath) {
      throw new FaultlineError({
        message: 'Usage: faultline fs write <file-path> <content>',
        code: 'ERR_MISSING_ARGUMENT',
        exitCode: 64,
      });
    }
    vfs.writeFile(targetPath, content);
    return {
      stdout: [`\x1b[32m✔\x1b[0m Successfully wrote ${content.length} bytes to '${targetPath}'`],
      stderr: [],
      exitCode: 0,
    };
  }

  if (action === 'reset') {
    vfs.resetToDefaults();
    return {
      stdout: [`\x1b[32m✔\x1b[0m Reset virtual filesystem to initial factory state.`],
      stderr: [],
      exitCode: 0,
    };
  }

  throw new FaultlineError({
    message: `Unknown filesystem action '${action}'.`,
    code: 'ERR_INVALID_FS_ACTION',
    exitCode: 64,
    suggestion: 'Supported actions: ls, cat, chmod, write, reset',
  });
}

function handleRollback() {
  const ok = vfs.rollbackToLastSnapshot();
  if (ok) {
    return {
      stdout: [
        `\x1b[32m✔\x1b[0m Rolled back filesystem state to previous snapshot successfully.`,
        `  Remaining snapshots in history: \x1b[36m${vfs.getSnapshotCount()}\x1b[0m`,
      ],
      stderr: [],
      exitCode: 0,
    };
  } else {
    return {
      stdout: [`\x1b[33m!\x1b[0m No earlier snapshots found in rollback stack. State is already at root.`],
      stderr: [],
      exitCode: 0,
    };
  }
}

function handleInspect(positionals: string[], ctx: CommandContext, flags: Record<string, any>) {
  if (!ctx.lastError) {
    return {
      stdout: [
        `\x1b[90mNo active error recorded in current session buffer.\x1b[0m`,
        `\x1b[90mTrigger an error using 'faultline chaos <scenario>' or an invalid command.\x1b[0m`,
      ],
      stderr: [],
      exitCode: 0,
    };
  }

  ctx.onInspectError(ctx.lastError);

  if (flags['json']) {
    return {
      stdout: [JSON.stringify(ctx.lastError.machineJson, null, 2)],
      stderr: [],
      exitCode: 0,
    };
  }

  const err = ctx.lastError;
  const lines = [
    `\x1b[1;36m── ERROR ANATOMY INSPECTOR ────────────────────────\x1b[0m`,
    `  \x1b[1mError Code:\x1b[0m       \x1b[31m${err.code}\x1b[0m`,
    `  \x1b[1mPOSIX Exit:\x1b[0m       \x1b[33m${err.exitCode}\x1b[0m`,
    `  \x1b[1mSeverity:\x1b[0m         \x1b[35m${err.severity}\x1b[0m`,
    `  \x1b[1mTrace ID:\x1b[0m         \x1b[90m${err.traceId}\x1b[0m`,
    `  \x1b[1mCommand Executed:\x1b[0m \x1b[32m${err.commandRan}\x1b[0m`,
    `  \x1b[1mTimestamp:\x1b[0m        \x1b[90m${err.timestamp}\x1b[0m`,
    `  \x1b[1mSummary:\x1b[0m          ${err.message}`,
    `\x1b[1;36m───────────────────────────────────────────────────\x1b[0m`,
    `\x1b[90m[Opened deep inspection panel in right drawer]\x1b[0m`,
  ];

  return { stdout: lines, stderr: [], exitCode: 0 };
}

async function handleDiagnose(ctx: CommandContext, flags: Record<string, any>) {
  if (!ctx.lastError) {
    return {
      stdout: [
        `\x1b[33m!\x1b[0m No recent CLI error found to diagnose. Run a command that fails first.`,
      ],
      stderr: [],
      exitCode: 0,
    };
  }

  const err = ctx.lastError;
  const lines = [
    `\x1b[1;36m🤖 Contacting AI Diagnostics Engine...\x1b[0m`,
    `Analyzing error \x1b[31m${err.code}\x1b[0m (Exit ${err.exitCode}) from \x1b[32m${err.commandRan}\x1b[0m...`,
  ];

  try {
    const resp = await fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: err.commandRan,
        errorCode: err.code,
        exitCode: err.exitCode,
        message: err.message,
        snippet: err.diagnostics?.[0]?.snippet,
        stack: err.stack,
        context: err.flags,
      }),
    });

    const data = await resp.json();
    lines.push('');
    lines.push(`\x1b[1;32m✔ AI Root Cause Diagnosis:\x1b[0m`);
    lines.push(`  ${data.rootCause || data.summary || 'Operational parameter mismatch'}`);
    lines.push('');
    lines.push(`\x1b[1;36m💡 Recommended Solutions:\x1b[0m`);
    if (Array.isArray(data.suggestedFixes)) {
      for (const fix of data.suggestedFixes) {
        lines.push(`  • \x1b[1m${fix}\x1b[0m`);
      }
    }
    if (data.posixStandardRef) {
      lines.push('');
      lines.push(`\x1b[90mPOSIX Standard Note:\x1b[0m \x1b[90m${data.posixStandardRef}\x1b[0m`);
    }

    return { stdout: lines, stderr: [], exitCode: 0 };
  } catch (apiErr: any) {
    lines.push(`\x1b[31m✖ AI Service query error: ${apiErr.message}\x1b[0m`);
    return { stdout: lines, stderr: [], exitCode: 1 };
  }
}

async function handleChaos(
  positionals: string[],
  flags: Record<string, any>,
  ctx: CommandContext
) {
  const scenario = positionals[0];

  if (!scenario || scenario === 'list') {
    return {
      stdout: [
        `\x1b[1;35mFAULTLINE CHAOS SCENARIO SUITE\x1b[0m`,
        `Inject realistic production faults to observe how Faultline behaves when things go wrong:\n`,
        `  \x1b[32mfaultline chaos typo\x1b[0m              - Typo in command & flags (Levenshtein suggestion)`,
        `  \x1b[32mfaultline chaos missing-config\x1b[0m    - Missing config file (ENOENT / exit 66)`,
        `  \x1b[32mfaultline chaos corrupt-json\x1b[0m      - Broken JSON syntax with exact line pointer (exit 65)`,
        `  \x1b[32mfaultline chaos permission-denied\x1b[0m - EACCES permission denied on secret key (exit 77)`,
        `  \x1b[32mfaultline chaos rate-limit\x1b[0m        - 429 HTTP rate limiting & exponential backoff (exit 75)`,
        `  \x1b[32mfaultline chaos rollback\x1b[0m          - Broken SQL migration with atomic state rollback`,
        `  \x1b[32mfaultline chaos schema-error\x1b[0m      - Port number type mismatch in config (exit 65)`,
        `  \x1b[32mfaultline chaos sigint\x1b[0m            - SIGINT Ctrl+C signal interruption (exit 130)`,
        `  \x1b[32mfaultline chaos doctor-fix\x1b[0m        - Auto-healing all system faults in 1 command`,
      ],
      stderr: [],
      exitCode: 0,
    };
  }

  switch (scenario) {
    case 'typo':
      return await executeCommand('faultline deply --enviroment=prod', ctx);

    case 'missing-config': {
      vfs.removeFile('/workspace/faultline.config.json');
      return await executeCommand('faultline deploy', ctx);
    }

    case 'corrupt-json': {
      vfs.writeFile('/workspace/faultline.config.json', '{\n  "name": "production-api",\n  "database": {\n    "port": 5432,\n  }\n}');
      return await executeCommand('faultline deploy', ctx);
    }

    case 'permission-denied': {
      vfs.chmod('/workspace/.env.secret', 0o000);
      return await executeCommand('faultline deploy', ctx);
    }

    case 'rate-limit': {
      const cfg = JSON.parse(vfs.readFile('/workspace/faultline.config.json').content);
      cfg.environment = 'chaos-rate-limit';
      vfs.writeFile('/workspace/faultline.config.json', JSON.stringify(cfg, null, 2));
      return await executeCommand('faultline deploy', ctx);
    }

    case 'rollback': {
      return await executeCommand('faultline migrate', ctx);
    }

    case 'schema-error': {
      const cfg = JSON.parse(vfs.readFile('/workspace/faultline.config.json').content);
      cfg.database.port = 'invalid_port_string';
      vfs.writeFile('/workspace/faultline.config.json', JSON.stringify(cfg, null, 2));
      return await executeCommand('faultline deploy', ctx);
    }

    case 'sigint': {
      throw new FaultlineError({
        message: 'Command aborted by user signal SIGINT (Control-C).',
        code: 'ERR_SIGNAL_SIGINT',
        exitCode: 130, // 128 + 2
        rollbackLog: ['Released temporary lockfiles', 'Flushed pending write buffers', 'Gracefully terminated background workers'],
        diagnostics: [
          {
            code: 'SIGINT',
            message: 'Process received interrupt signal 2',
            hint: 'All modified resources were safely released before exit.',
          },
        ],
      });
    }

    case 'doctor-fix': {
      return await executeCommand('faultline doctor --fix', ctx);
    }

    default:
      throw new FaultlineError({
        message: `Unknown chaos scenario '${scenario}'.`,
        code: 'ERR_UNKNOWN_CHAOS_SCENARIO',
        exitCode: 64,
        suggestion: 'faultline chaos list',
      });
  }
}
