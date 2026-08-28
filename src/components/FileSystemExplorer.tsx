/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FolderTree, FileCode, Lock, Unlock, Edit3, Save, RotateCcw, Plus, Trash2, Check } from 'lucide-react';
import { vfs } from '../cli/filesystem';
import { VirtualFile } from '../types';

interface FileSystemExplorerProps {
  onRefreshFs: () => void;
  onRunCommand: (cmd: string) => void;
}

export const FileSystemExplorer: React.FC<FileSystemExplorerProps> = ({
  onRefreshFs,
  onRunCommand,
}) => {
  const [files, setFiles] = useState<VirtualFile[]>(vfs.listFiles());
  const [selectedFile, setSelectedFile] = useState<VirtualFile | null>(
    files.find((f) => f.name === 'faultline.config.json') || files[0] || null
  );
  const [editContent, setEditContent] = useState<string>(selectedFile?.content || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refreshList = () => {
    const updated = vfs.listFiles();
    setFiles(updated);
    if (selectedFile) {
      const match = updated.find((f) => f.path === selectedFile.path);
      setSelectedFile(match || updated[0] || null);
      setEditContent(match ? match.content : (updated[0]?.content || ''));
    }
    onRefreshFs();
  };

  const handleSelectFile = (file: VirtualFile) => {
    setSelectedFile(file);
    setSaveError(null);
    try {
      const live = vfs.readFile(file.path);
      setEditContent(live.content);
    } catch {
      setEditContent(`// [PERMISSION DENIED - File mode 0${file.mode.toString(8)} is read-locked]`);
    }
  };

  const handleSave = () => {
    if (!selectedFile) return;
    try {
      vfs.writeFile(selectedFile.path, editContent);
      setSaveError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      refreshList();
    } catch (e: any) {
      setSaveError(e.message || 'Permission denied or invalid write operation.');
      setTimeout(() => setSaveError(null), 4000);
    }
  };

  const handleToggleMode = (file: VirtualFile) => {
    const newMode = (file.mode & 0o444) === 0 ? 0o644 : 0o000;
    vfs.chmod(file.path, newMode);
    refreshList();
  };

  const handleReset = () => {
    vfs.resetToDefaults();
    refreshList();
  };

  return (
    <div className="h-full flex flex-col lg:flex-row bg-[#0A0A0B] text-slate-300 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 select-text">
      {/* Left Sidebar: File Tree */}
      <div className="w-full lg:w-80 p-4 flex flex-col justify-between space-y-4 shrink-0 bg-[#0F0F11]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Virtual Workspace
              </h3>
            </div>
            <button
              onClick={handleReset}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Reset all files to default factory state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {files.map((file) => {
              const isSelected = selectedFile?.path === file.path;
              const isReadLocked = (file.mode & 0o444) === 0;

              return (
                <div
                  key={file.path}
                  onClick={() => handleSelectFile(file)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-slate-800 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-3.5 h-3.5 ${isReadLocked ? 'text-red-400' : 'text-blue-400'}`} />
                    <span className="truncate">{file.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-500 font-mono">
                      0{file.mode.toString(8)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMode(file);
                      }}
                      className="p-1 hover:text-white rounded hover:bg-slate-700 transition-colors"
                      title={isReadLocked ? 'Locked (0000) - Click to make 0644' : 'Readable (0644) - Click to lock 0000'}
                    >
                      {isReadLocked ? (
                        <Lock className="w-3 h-3 text-red-400" />
                      ) : (
                        <Unlock className="w-3 h-3 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tip Box */}
        <div className="border border-slate-800 bg-[#0A0A0B] p-3.5 rounded-lg text-xs text-slate-400 space-y-1.5">
          <div className="font-semibold text-slate-300">Live Workspace Testing</div>
          <p className="text-[11px] leading-relaxed">
            Modify any configuration, SQL script, or permission lock to test how <code className="text-blue-400">faultline</code> reports errors.
          </p>
        </div>
      </div>

      {/* Right Area: File Editor / Viewer */}
      <div className="flex-1 flex flex-col h-full bg-[#0A0A0B] p-4 space-y-3">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <FileCode className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-mono font-bold text-white">{selectedFile.path}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Mode: 0{selectedFile.mode.toString(8)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Owner: {selectedFile.owner}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {saveError && (
                  <span className="text-[11px] font-mono text-red-400 bg-red-950/60 border border-red-800/80 px-2.5 py-1 rounded">
                    {saveError}
                  </span>
                )}
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-md transition-colors shadow-sm"
                >
                  {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{saveSuccess ? 'Saved' : 'Save Changes'}</span>
                </button>
              </div>
            </div>

            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full bg-[#0F0F11] text-slate-200 font-mono text-xs p-4 rounded-xl border border-slate-800 focus:outline-none focus:border-slate-700 resize-none leading-relaxed"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
            Select a file from the left sidebar to inspect and edit.
          </div>
        )}
      </div>
    </div>
  );
};
