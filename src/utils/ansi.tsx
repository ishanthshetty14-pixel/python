/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * ANSI Color map to Tailwind / CSS styles
 */
const ANSI_COLOR_MAP: Record<string, string> = {
  '30': 'text-neutral-900 dark:text-neutral-100',
  '31': 'text-rose-500 font-semibold',
  '32': 'text-emerald-400 font-medium',
  '33': 'text-amber-400 font-medium',
  '34': 'text-sky-400',
  '35': 'text-purple-400',
  '36': 'text-cyan-400',
  '37': 'text-neutral-200',
  '90': 'text-neutral-400',
  '91': 'text-rose-400',
  '92': 'text-emerald-300',
  '93': 'text-amber-300',
  '94': 'text-sky-300',
  '95': 'text-fuchsia-400',
  '96': 'text-cyan-300',
  '97': 'text-white font-medium',
  // Styles
  '1': 'font-bold text-white',
  '4': 'underline decoration-sky-400 underline-offset-2',
};

export function parseAnsiToReact(rawText: string, keyPrefix = 'ansi'): React.ReactNode[] {
  if (!rawText) return [];

  // Regex to match ANSI escape sequences: \x1b[...m
  const parts = rawText.split(/(\x1b\[[0-9;]*m)/g);
  const elements: React.ReactNode[] = [];
  let currentClasses: Set<string> = new Set();

  parts.forEach((part, index) => {
    if (part.startsWith('\x1b[')) {
      const codes = part
        .replace('\x1b[', '')
        .replace('m', '')
        .split(';')
        .filter(Boolean);

      if (codes.length === 0 || codes.includes('0')) {
        currentClasses.clear();
      }

      for (const code of codes) {
        if (code === '0') {
          currentClasses.clear();
        } else if (ANSI_COLOR_MAP[code]) {
          currentClasses.add(ANSI_COLOR_MAP[code]);
        }
      }
    } else if (part.length > 0) {
      const classStr = Array.from(currentClasses).join(' ');
      elements.push(
        <span key={`${keyPrefix}-${index}`} className={classStr || 'text-neutral-200'}>
          {part}
        </span>
      );
    }
  });

  return elements;
}
