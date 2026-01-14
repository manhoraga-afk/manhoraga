
import { FileNode, FileChange } from '../types';

export class FileSystemService {
  private serverUrl = 'http://localhost:8000';
  private mode: 'server' | 'browser' | 'none' = 'none';
  private rootHandle: any = null;

  async checkConnection(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.serverUrl}/status`);
      if (resp.ok) {
        this.mode = 'server';
        return true;
      }
    } catch (e) {
      // Server not running
    }
    return false;
  }

  async requestDirectory(): Promise<{ mode: 'server' | 'browser', name: string }> {
    if (await this.checkConnection()) {
      return { mode: 'server', name: 'Local Machine' };
    }

    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      this.rootHandle = handle;
      this.mode = 'browser';
      return { mode: 'browser', name: handle.name };
    } catch (err: any) {
      if (err.name === 'SecurityError' || err.message.includes('Cross origin')) {
        throw new Error('SANDBOX_RESTRICTION');
      }
      throw err;
    }
  }

  async scanDirectory(path: string = '.'): Promise<FileNode[]> {
    if (this.mode === 'server') {
      const resp = await fetch(`${this.serverUrl}/ls?path=${encodeURIComponent(path)}`);
      const items = await resp.json();
      const nodes: FileNode[] = [];
      
      for (const item of items) {
        nodes.push({
          name: item.name,
          kind: item.kind,
          handle: {} as any, // Server mode doesn't use handles
          path: item.path,
          children: item.kind === 'directory' ? [] : undefined
        });
      }
      return nodes;
    } else if (this.mode === 'browser' && this.rootHandle) {
      // Browser logic remains similar to previous version
      return this.scanBrowserDirectory(this.rootHandle);
    }
    return [];
  }

  private async scanBrowserDirectory(handle: any): Promise<FileNode[]> {
    const nodes: FileNode[] = [];
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        nodes.push({
          name: entry.name,
          kind: 'directory',
          handle: entry,
          children: await this.scanBrowserDirectory(entry),
          isOpen: false
        });
      } else {
        nodes.push({
          name: entry.name,
          kind: 'file',
          handle: entry
        });
      }
    }
    return nodes.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1));
  }

  async readFile(path: string, handle?: any): Promise<string> {
    if (this.mode === 'server') {
      const resp = await fetch(`${this.serverUrl}/read?path=${encodeURIComponent(path)}`);
      const data = await resp.json();
      return data.content;
    } else if (handle) {
      const file = await handle.getFile();
      return await file.text();
    }
    return '';
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (this.mode === 'server') {
      await fetch(`${this.serverUrl}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
      });
    } else if (this.mode === 'browser' && this.rootHandle) {
      const parts = path.split('/').filter(p => p !== '');
      let currentDir = this.rootHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
      }
      const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1], { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    }
  }

  async applyChanges(changes: FileChange[]): Promise<void> {
    for (const change of changes) {
      if (change.action !== 'delete') {
        await this.writeFile(change.path, change.content);
      }
    }
  }
}

export const fsService = new FileSystemService();
