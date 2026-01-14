
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FolderOpen, 
  FileCode, 
  Send, 
  Terminal as TerminalIcon, 
  Activity, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Save,
  Rocket,
  Wand2,
  Trash2,
  X,
  Server,
  ExternalLink,
  ShieldAlert,
  Code
} from 'lucide-react';
import { fsService } from './services/fileSystemService';
import { geminiService } from './services/geminiService';
import { FileNode, ChatMessage, FileChange } from './types';

export default function App() {
  const [connectionMode, setConnectionMode] = useState<'none' | 'server' | 'browser'>('none');
  const [mountedName, setMountedName] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<{ path: string; content: string; handle?: any } | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>(['ForgeAI Initialized. Checking local bridge...']);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
  }, []);

  const refreshFileTree = useCallback(async () => {
    if (connectionMode !== 'none') {
      const tree = await fsService.scanDirectory();
      setFileTree(tree);
      addLog("File tree refreshed.");
    }
  }, [connectionMode, addLog]);

  useEffect(() => {
    const initConnection = async () => {
      const isConnected = await fsService.checkConnection();
      if (isConnected) {
        setConnectionMode('server');
        setMountedName('Local Machine');
        addLog("Connected to Python Local Bridge.");
        refreshFileTree();
      }
    };
    initConnection();
  }, []);

  const handleMount = async () => {
    try {
      const result = await fsService.requestDirectory();
      setConnectionMode(result.mode);
      setMountedName(result.name);
      addLog(`Mounted: ${result.name} via ${result.mode}`);
      refreshFileTree();
      setShowSecurityWarning(false);
    } catch (err: any) {
      if (err.message === 'SANDBOX_RESTRICTION') {
        setShowSecurityWarning(true);
        addLog("SECURITY: Browser sandbox blocked File System Access.");
      } else {
        addLog(`Error: ${err.message}`);
      }
    }
  };

  const handleFileClick = async (node: FileNode, path: string) => {
    if (node.kind === 'file') {
      const content = await fsService.readFile(node.path || node.name, node.handle);
      setActiveFile({ path: node.path || node.name, content, handle: node.handle });
      addLog(`Opened: ${node.name}`);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || connectionMode === 'none' || isAiLoading) return;

    const userMessage = inputValue;
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);
    setInputValue('');
    setIsAiLoading(true);
    addLog("Architect is generating solution...");

    try {
      const context = `Mode: ${connectionMode}\nFiles:\n${JSON.stringify(fileTree.map(f => f.name))}`;
      const aiResponse = await geminiService.generateCode(userMessage, context);
      
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: aiResponse.message, 
        timestamp: Date.now(),
        changes: aiResponse.changes
      }]);
    } catch (err: any) {
      addLog(`AI Error: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const applyChanges = async (changes: FileChange[]) => {
    setIsApplyingChanges(true);
    addLog(`Applying ${changes.length} changes...`);
    try {
      await fsService.applyChanges(changes);
      await refreshFileTree();
      addLog("Changes successfully written to disk.");
    } catch (err: any) {
      addLog(`Write Error: ${err.message}`);
    } finally {
      setIsApplyingChanges(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-['Inter']">
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-800 flex flex-col bg-slate-900 shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h2 className="font-bold text-sm tracking-tight">EXPLORER</h2>
          </div>
          <div className="flex gap-1">
            <button 
              onClick={handleMount}
              className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white"
              title="Mount Local Workspace"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <button 
              onClick={refreshFileTree}
              className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white"
              title="Refresh Files"
            >
              <Rocket className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Directory Info */}
        <div className="px-4 py-2 bg-slate-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`w-2 h-2 rounded-full ${connectionMode === 'none' ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
            <span className="text-[10px] font-bold uppercase text-slate-400 truncate">
              {connectionMode === 'none' ? 'Disconnected' : `${connectionMode}: ${mountedName}`}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {fileTree.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <FolderOpen className="w-10 h-10 text-slate-700" />
              <p className="text-xs text-slate-500">No workspace mounted. Use the folder icon above to start.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {fileTree.map(node => (
                <FileTreeNode 
                  key={node.path || node.name} 
                  node={node} 
                  path={node.path || node.name} 
                  onFileClick={handleFileClick} 
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-slate-950">
        {/* Security Alert if Iframe Restricted */}
        {showSecurityWarning && (
          <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
              <div className="flex items-center gap-4 text-amber-500">
                <ShieldAlert className="w-12 h-12" />
                <h3 className="text-xl font-bold text-white">Sandbox Restriction</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your browser blocked file access because this app is running in a secure iframe. To build local apps, you have two options:
              </p>
              <div className="space-y-3">
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Window
                </button>
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-600"><span className="bg-slate-900 px-2 italic">Recommended for Python Developers</span></div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <p className="text-xs font-mono text-emerald-400"># Run local bridge</p>
                  <p className="text-xs font-mono text-slate-300">python server.py</p>
                  <button 
                    onClick={() => setShowSecurityWarning(false)}
                    className="mt-2 text-[10px] text-slate-500 hover:text-white underline decoration-slate-700"
                  >
                    I have the bridge running, dismiss.
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Editor Tabs/Header */}
        <div className="h-12 border-b border-slate-800 flex items-center bg-slate-900/50 px-4">
          {activeFile ? (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-t-lg border-x border-t border-slate-700">
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-medium text-slate-200">{activeFile.path.split('/').pop()}</span>
                <X 
                  className="w-3 h-3 ml-2 cursor-pointer text-slate-500 hover:text-white" 
                  onClick={() => setActiveFile(null)}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <Activity className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Workspace Dashboard</span>
            </div>
          )}
        </div>

        {/* Editor Body */}
        <div className="flex-1 overflow-hidden">
          {activeFile ? (
            <textarea
              className="w-full h-full p-8 bg-transparent outline-none code-font text-[14px] leading-relaxed resize-none text-slate-300 selection:bg-emerald-500/30"
              value={activeFile.content}
              readOnly
              spellCheck={false}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-700">
              <div className="relative mb-8">
                <Wand2 className="w-24 h-24 opacity-5 animate-pulse" />
                <Code className="w-8 h-8 absolute bottom-0 right-0 opacity-10" />
              </div>
              <h3 className="text-xl font-medium text-slate-800">ForgeAI Architect</h3>
              <p className="text-sm text-slate-800 mt-2 max-w-xs text-center leading-relaxed">
                Connect your workspace to begin building local apps and websites with AI.
              </p>
            </div>
          )}
        </div>

        {/* Console / Terminal */}
        <div className="h-56 border-t border-slate-800 flex flex-col bg-slate-900 shadow-2xl">
          <div className="h-10 flex items-center px-4 border-b border-slate-800 justify-between">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-black tracking-widest uppercase text-slate-500">Output Log</span>
            </div>
            <div className="flex gap-4">
               {connectionMode === 'server' && (
                 <div className="flex items-center gap-1.5">
                   <Server className="w-3 h-3 text-emerald-500" />
                   <span className="text-[10px] text-emerald-500 font-bold uppercase">Bridge Active</span>
                 </div>
               )}
            </div>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-400 space-y-1 bg-black/20">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-700">❯</span>
                <span>{log}</span>
              </div>
            ))}
            <div className="pt-2 text-slate-600 italic">...system idle</div>
          </div>
        </div>
      </main>

      {/* Right Sidebar: AI Agent */}
      <aside className="w-[400px] border-l border-slate-800 flex flex-col bg-slate-900 shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Wand2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="font-bold text-sm tracking-tight text-white uppercase">Architect AI</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[9px] font-bold text-slate-500">GEMINI PRO 2.5 CLOUD</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          {chatHistory.length === 0 && (
            <div className="text-center py-10 px-4 space-y-6">
              <Rocket className="w-12 h-12 mx-auto text-slate-800" />
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Quick Start</p>
                <div className="grid gap-2">
                  <button onClick={() => setInputValue("Create a Python script that scrapes headlines from a news site")} className="text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-[11px] text-slate-300 hover:border-emerald-500 transition-all">"Create a Python news scraper"</button>
                  <button onClick={() => setInputValue("Build a responsive React landing page with Tailwind for a SaaS app")} className="text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-[11px] text-slate-300 hover:border-emerald-500 transition-all">"Build a SaaS landing page"</button>
                  <button onClick={() => setInputValue("Setup a FastAPI server structure with users and items endpoints")} className="text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-[11px] text-slate-300 hover:border-emerald-500 transition-all">"Setup a FastAPI structure"</button>
                </div>
              </div>
            </div>
          )}

          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start animate-in fade-in slide-in-from-left-2'}`}>
              <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-tr-none shadow-lg shadow-emerald-900/20' 
                : 'bg-slate-850 text-slate-200 rounded-tl-none border border-slate-800 shadow-xl'
              }`}>
                {msg.content}
              </div>
              
              {msg.changes && msg.changes.length > 0 && (
                <div className="mt-4 w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                  <div className="bg-slate-800/50 px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-between border-b border-slate-800 text-slate-400">
                    <span>Proposed Local Updates</span>
                    <span className="text-emerald-500">{msg.changes.length} Files</span>
                  </div>
                  <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                    {msg.changes.map((change, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-400 group">
                        <FileCode className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                        <span className="truncate flex-1 font-mono">{change.path}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                           <Save className="w-3 h-3 cursor-pointer" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    disabled={isApplyingChanges || connectionMode === 'none'}
                    onClick={() => applyChanges(msg.changes!)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2 group"
                  >
                    {isApplyingChanges ? (
                      <Activity className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Commit to Disk
                        <Rocket className="w-3.5 h-3.5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}

          {isAiLoading && (
            <div className="flex gap-3 items-center text-slate-500 text-xs p-4 bg-slate-800/30 rounded-2xl border border-slate-800/50">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-200"></div>
              </div>
              <span>Processing requirements...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/50">
          <div className="relative">
            <textarea
              rows={3}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={connectionMode !== 'none' ? "Describe the app you want to build..." : "Mount workspace to start..."}
              disabled={connectionMode === 'none' || isAiLoading}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none pr-14 disabled:opacity-50 text-slate-200 placeholder:text-slate-700"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || connectionMode === 'none' || isAiLoading}
              className="absolute right-4 bottom-4 p-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white transition-all disabled:opacity-20 shadow-lg shadow-emerald-900/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// Sub-component for File Tree Nodes
interface FileTreeNodeProps {
  node: FileNode;
  path: string;
  onFileClick: (node: FileNode, path: string) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, path, onFileClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (node.kind === 'directory') {
    return (
      <div className="select-none">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-all group"
        >
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-600" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
          <FolderOpen className={`w-4 h-4 ${isOpen ? 'text-amber-500' : 'text-slate-500 group-hover:text-amber-400'}`} />
          <span className={`text-[13px] font-medium transition-colors ${isOpen ? 'text-slate-200' : 'text-slate-400 group-hover:text-slate-200'}`}>{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div className="ml-5 border-l border-slate-800/50 pl-2 mt-1 space-y-0.5">
            {node.children.map(child => (
              <FileTreeNode 
                key={child.path || child.name} 
                node={child} 
                path={child.path || `${path}/${child.name}`} 
                onFileClick={onFileClick} 
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      onClick={() => onFileClick(node, path)}
      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-all group"
    >
      <div className="w-3.5" /> {/* Align with folder chevrons */}
      <FileCode className="w-4 h-4 text-blue-500/70 group-hover:text-blue-400" />
      <span className="text-[13px] text-slate-400 group-hover:text-slate-200 transition-colors">{node.name}</span>
    </div>
  );
};
