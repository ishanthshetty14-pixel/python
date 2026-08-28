/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Terminal, ShieldAlert, FolderTree, BookOpen, Stethoscope, RotateCcw, Sliders, Activity, Cpu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { TerminalTheme } from '../types';

interface HeaderProps {
  activeTab: 'terminal' | 'inspector' | 'chaos' | 'filesystem' | 'posix' | 'telemetry';
  setActiveTab: (tab: 'terminal' | 'inspector' | 'chaos' | 'filesystem' | 'posix' | 'telemetry') => void;
  onRunQuickCommand: (cmd: string) => void;
  onResetFs: () => void;
  hasLastError: boolean;
  theme: TerminalTheme;
  setTheme: (t: TerminalTheme) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onRunQuickCommand,
  onResetFs,
  hasLastError,
  theme,
  setTheme,
  sidebarOpen,
  setSidebarOpen,
}) => {
  return (
    <header className="h-14 border-b border-slate-800 bg-[#0F0F11] text-slate-300 px-4 sm:px-6 flex items-center justify-between gap-4 select-none shrink-0 z-20">
      {/* Brand & Traffic Lights */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80 hover:opacity-100 transition-opacity"></div>
          <div className="w-3 h-3 rounded-full bg-amber-500/80 hover:opacity-100 transition-opacity"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:opacity-100 transition-opacity"></div>
        </div>

        <button
          id="btn-toggle-sidebar"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors hidden sm:flex items-center"
          title={sidebarOpen ? "Hide Workspace Dock" : "Show Workspace Dock"}
        >
          {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-slate-100 font-mono flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">➜</span> FAULTLINE CLI
            <span className="text-slate-500 font-normal text-xs">v2.4.0</span>
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800/90 text-xs overflow-x-auto scrollbar-none">
        <button
          id="nav-tab-terminal"
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'terminal'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Terminal</span>
        </button>

        <button
          id="nav-tab-telemetry"
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'telemetry'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span>Telemetry</span>
        </button>

        <button
          id="nav-tab-inspector"
          onClick={() => setActiveTab('inspector')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'inspector'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldAlert className={`w-3.5 h-3.5 ${hasLastError ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
          <span>Error Anatomy</span>
          {hasLastError && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"></span>
          )}
        </button>

        <button
          id="nav-tab-chaos"
          onClick={() => setActiveTab('chaos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'chaos'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>Chaos Suite</span>
        </button>

        <button
          id="nav-tab-filesystem"
          onClick={() => setActiveTab('filesystem')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'filesystem'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5 text-blue-400" />
          <span>Filesystem</span>
        </button>

        <button
          id="nav-tab-posix"
          onClick={() => setActiveTab('posix')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'posix'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden md:inline">POSIX</span> Codes
        </button>
      </nav>

      {/* Telemetry & Quick Action Controls */}
      <div className="flex items-center gap-3 sm:gap-4 text-[11px]">
        {/* Live Cluster Telemetry */}
        <div className="hidden lg:flex items-center gap-4 text-[10px] uppercase tracking-widest text-slate-500 font-medium border-r border-slate-800 pr-4">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
            CONNECTED: US-EAST-1
          </div>
          <div className="text-slate-400 font-mono">CPU: 14%</div>
          <div className="text-slate-400 font-mono">MEM: 1.2GB</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-quick-doctor"
            onClick={() => {
              setActiveTab('terminal');
              onRunQuickCommand('faultline doctor --fix');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md transition-colors shadow-sm"
            title="Run system doctor to diagnose and auto-repair all issues"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Auto-Heal</span>
          </button>

          <button
            id="btn-quick-reset"
            onClick={onResetFs}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md transition-colors"
            title="Reset virtual workspace files to clean factory state"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden xl:inline">Reset</span>
          </button>

          {/* Theme select */}
          <select
            id="select-theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as TerminalTheme)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-2 py-1.5 rounded-md focus:outline-none focus:border-slate-700 cursor-pointer hidden sm:block font-mono"
          >
            <option value="classic-dark">Dark Charcoal</option>
            <option value="tokyo-night">Tokyo Night</option>
            <option value="monokai">Monokai</option>
            <option value="dracula">Dracula</option>
            <option value="nord">Nord</option>
            <option value="clean-light">Monochrome</option>
          </select>
        </div>
      </div>
    </header>
  );
};
