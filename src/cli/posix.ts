/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PosixExitCodeInfo } from '../types';

export const POSIX_EXIT_CODES: Record<number, PosixExitCodeInfo> = {
  0: {
    code: 0,
    name: 'EX_OK',
    category: 'Success',
    description: 'Command completed successfully without errors.',
  },
  1: {
    code: 1,
    name: 'EX_GENERAL',
    category: 'General Error',
    description: 'Catch-all for general operational failure or unhandled exception.',
  },
  2: {
    code: 2,
    name: 'EX_BUILTIN_MISUSE',
    category: 'Syntax / Invocation',
    description: 'Misuse of shell builtins or CLI flag parser failure (missing argument, unknown flag).',
  },
  64: {
    code: 64,
    name: 'EX_USAGE',
    category: 'Sysexits Standard',
    description: 'Command line usage error; incorrect number of arguments, bad flags, or syntax.',
  },
  65: {
    code: 65,
    name: 'EX_DATAERR',
    category: 'Sysexits Standard',
    description: 'Input data was incorrect in format or contents (e.g. invalid JSON, malformed schema).',
  },
  66: {
    code: 66,
    name: 'EX_NOINPUT',
    category: 'Sysexits Standard',
    description: 'An input file (not a system file) did not exist or was unreadable (ENOENT).',
  },
  69: {
    code: 69,
    name: 'EX_UNAVAILABLE',
    category: 'Sysexits Standard',
    description: 'A required service, port, or upstream dependency is unavailable (503 / EADDRINUSE).',
  },
  70: {
    code: 70,
    name: 'EX_SOFTWARE',
    category: 'Sysexits Standard',
    description: 'Internal software crash, assertion failure, or unhandled panic.',
  },
  71: {
    code: 71,
    name: 'EX_OSERR',
    category: 'Sysexits Standard',
    description: 'Operating system error (cannot fork, out of file descriptors).',
  },
  73: {
    code: 73,
    name: 'EX_CANTCREAT',
    category: 'Sysexits Standard',
    description: 'A specified output file could not be created (e.g. read-only directory or path conflict).',
  },
  74: {
    code: 74,
    name: 'EX_IOERR',
    category: 'Sysexits Standard',
    description: 'An error occurred while doing I/O on some file or disk operation (ENOSPC / EIO).',
  },
  75: {
    code: 75,
    name: 'EX_TEMPFAIL',
    category: 'Sysexits Standard',
    description: 'Temporary failure; user or CI/CD script is invited to retry later (e.g. 429 rate limit / network timeout).',
  },
  77: {
    code: 77,
    name: 'EX_NOPERM',
    category: 'Sysexits Standard',
    description: 'Insufficient permissions to perform the requested operation (EACCES / 401 Unauthorized).',
  },
  78: {
    code: 78,
    name: 'EX_CONFIG',
    category: 'Sysexits Standard',
    description: 'Configuration file missing required keys or invalid configuration environment.',
  },
  126: {
    code: 126,
    name: 'EX_NOT_EXECUTABLE',
    category: 'POSIX Shell',
    description: 'Command found but is not executable (permission problem).',
  },
  127: {
    code: 127,
    name: 'EX_COMMAND_NOT_FOUND',
    category: 'POSIX Shell',
    description: 'Command not found in $PATH or misspelled.',
  },
  130: {
    code: 130,
    name: 'EX_SIGINT',
    category: 'Signal Termination',
    description: 'Command terminated by Control-C (SIGINT signal 2: 128 + 2).',
  },
  143: {
    code: 143,
    name: 'EX_SIGTERM',
    category: 'Signal Termination',
    description: 'Command terminated by kill signal (SIGTERM signal 15: 128 + 15).',
  },
};

export function getExitCodeInfo(code: number): PosixExitCodeInfo {
  return (
    POSIX_EXIT_CODES[code] || {
      code,
      name: `EX_CODE_${code}`,
      category: 'Non-standard Exit Code',
      description: `Process terminated with status code ${code}.`,
    }
  );
}
