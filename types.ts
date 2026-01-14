
export interface FileNode {
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemHandle;
  // Added optional path property to fix "Property 'path' does not exist on type 'FileNode'" errors
  path?: string;
  children?: FileNode[];
  content?: string;
  isOpen?: boolean;
}

export interface FileChange {
  path: string;
  content: string;
  action: 'create' | 'update' | 'delete';
}

export interface AIResponse {
  thinking: string;
  message: string;
  changes: FileChange[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  changes?: FileChange[];
}
