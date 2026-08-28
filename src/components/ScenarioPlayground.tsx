/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sliders, Play, Tag, ShieldCheck, AlertCircle, ArrowRight, Search } from 'lucide-react';
import { CHAOS_SCENARIOS } from '../cli/scenarios';
import { ChaosScenario } from '../types';

interface ScenarioPlaygroundProps {
  onRunCommand: (cmd: string) => void;
  onSelectTab: (tab: 'terminal' | 'inspector') => void;
}

export const ScenarioPlayground: React.FC<ScenarioPlaygroundProps> = ({
  onRunCommand,
  onSelectTab,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Configuration', 'Permissions', 'Network', 'Transactions', 'CLI Syntax', 'Concurrency', 'Filesystem'];

  const filteredScenarios = CHAOS_SCENARIOS.filter((s) => {
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleTrigger = (scenario: ChaosScenario) => {
    onSelectTab('terminal');
    onRunCommand(scenario.command);
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#0A0A0B] text-slate-300 space-y-6 select-text">
      {/* Header Banner */}
      <div className="border border-slate-800 bg-[#0F0F11] rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">CLI Chaos & Fault Injection Suite</h2>
            <p className="text-xs text-slate-400">
              Trigger real-world failures to verify how Faultline's error engine handles corrupt configs, missing inputs, network rate limits, and broken database migrations.
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search chaos scenarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-md focus:outline-none focus:border-slate-700 text-slate-200 w-56 font-mono"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Scenario Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="border border-slate-800 hover:border-slate-700 bg-[#0F0F11] rounded-xl p-4 flex flex-col justify-between space-y-4 transition-all hover:bg-slate-900/40 group shadow-sm"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {scenario.category}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0A0A0B] text-slate-400 border border-slate-800">
                  Exit: {scenario.exitCode}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors">
                {scenario.title}
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                {scenario.description}
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="text-[11px] text-blue-400 flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
                <span className="leading-snug">{scenario.resilienceFeature}</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {scenario.tags.map((tag, tIdx) => (
                    <span key={tIdx} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0A0A0B] text-slate-500 border border-slate-800/60">
                      #{tag}
                    </span>
                  ))}
                </div>

                <button
                  id={`btn-trigger-${scenario.id}`}
                  onClick={() => handleTrigger(scenario)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold font-mono bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md transition-colors shrink-0 shadow-sm"
                >
                  <Play className="w-3 h-3 text-emerald-400" />
                  <span>Trigger</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
