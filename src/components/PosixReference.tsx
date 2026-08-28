/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, ShieldCheck, Terminal, HelpCircle } from 'lucide-react';
import { POSIX_EXIT_CODES } from '../cli/posix';

export const PosixReference: React.FC = () => {
  const codesList = Object.values(POSIX_EXIT_CODES).sort((a, b) => a.code - b.code);

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#0A0A0B] text-slate-300 space-y-6 select-text">
      {/* Header Banner */}
      <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">POSIX & BSD Sysexits Standard Specification</h2>
            <p className="text-xs text-slate-400">
              Deterministic exit codes allow CI/CD pipelines, Bash automation scripts, and container orchestrators to decide whether to retry, alert on-call engineers, or abort gracefully.
            </p>
          </div>
        </div>
      </div>

      {/* Exit Codes Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0F0F11] shadow-sm">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <th className="py-3 px-4 w-20">Code</th>
              <th className="py-3 px-4 w-48">Symbolic Name</th>
              <th className="py-3 px-4 w-44">Category</th>
              <th className="py-3 px-4">Standard Meaning & CI/CD Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-300">
            {codesList.map((item) => (
              <tr key={item.code} className="hover:bg-slate-900/40 transition-colors">
                <td className="py-3 px-4">
                  <span
                    className={`font-bold ${
                      item.code === 0
                        ? 'text-emerald-400'
                        : item.code === 75
                        ? 'text-amber-400'
                        : item.code === 130
                        ? 'text-purple-400'
                        : 'text-red-400'
                    }`}
                  >
                    {item.code}
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-blue-300">{item.name}</td>
                <td className="py-3 px-4 text-slate-400">{item.category}</td>
                <td className="py-3 px-4 text-slate-300 font-sans">{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Engineering Philosophy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="border border-slate-800 bg-[#0F0F11] p-4 rounded-xl space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Never Use Exit 1 For Everything</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Generic exit code 1 prevents callers from knowing if failure was caused by invalid arguments (64), a missing file (66), temporary network throttling (75), or permission issues (77).
          </p>
        </div>

        <div className="border border-slate-800 bg-[#0F0F11] p-4 rounded-xl space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
            <Terminal className="w-4 h-4" />
            <span>Actionable Remediations</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every error diagnostic must supply a concrete suggestion, typo correction, or automated fix command rather than just dumping raw stack traces.
          </p>
        </div>

        <div className="border border-slate-800 bg-[#0F0F11] p-4 rounded-xl space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
            <HelpCircle className="w-4 h-4" />
            <span>Atomic State Rollback</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Multi-stage operations like database migrations or bulk asset transformations must record an undo journal and restore state upon partial failure.
          </p>
        </div>
      </div>
    </div>
  );
};
