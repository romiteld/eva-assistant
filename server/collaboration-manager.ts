// Live Collaboration Manager
import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';

interface Collaborator {
  userId: string;
  socketId: string;
  name: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    elementId?: string;
  };
  selection?: {
    start: number;
    end: number;
    elementId: string;
  };
  status: 'active' | 'idle' | 'away';
  lastActivity: number;
}

interface Document {
  id: string;
  content: any;
  version: number;
  lastModified: number;
  locks: Map<string, DocumentLock>;
}

interface DocumentLock {
  userId: string;
  elementId: string;
  timestamp: number;
  type: 'read' | 'write';
}

interface DocumentOperation {
  id: string;
  userId: string;
  type: 'insert' | 'delete' | 'update' | 'move';
  path: string[];
  value?: any;
  oldValue?: any;
  timestamp: number;
  version: number;
}

export class CollaborationManager {
  private io: Server;
  private supabase: SupabaseClient;
  private workspaces: Map<string, Map<string, Collaborator>>;
  private documents: Map<string, Document>;
  private operationHistory: Map<string, DocumentOperation[]>;
  private presenceTimers: Map<string, NodeJS.Timeout>;

  constructor(io: Server, supabase: SupabaseClient) {
    this.io = io;
    this.supabase = supabase;
    this.workspaces = new Map();
    this.documents = new Map();
    this.operationHistory = new Map();
    this.presenceTimers = new Map();
  }

  handleConnection(socket: Socket) {
    const userId = socket.data.userId;

    // Join workspace
    socket.on('collab:join-workspace', async (data: {
      workspaceId: string;
      documentId: string;
      userInfo: {
        name: string;
        avatar?: string;
      };
    }) => {
      const { workspaceId, documentId, userInfo } = data;
      
      // Join socket room
      socket.join(`workspace:${workspaceId}`);
      socket.join(`document:${documentId}`);

      // Initialize workspace if needed
      if (!this.workspaces.has(workspaceId)) {
        this.workspaces.set(workspaceId, new Map());
      }

      // Create collaborator
      const collaborator: Collaborator = {
        userId,
        socketId: socket.id,
        name: userInfo.name,
        color: this.generateUserColor(userId),
        status: 'active',
        lastActivity: Date.now()
      };

      this.workspaces.get(workspaceId)!.set(userId, collaborator);

      // Load or initialize document
      if (!this.documents.has(documentId)) {
        await this.loadDocument(documentId);
      }

      // Send current state to new user
      socket.emit('collab:workspace-state', {
        collaborators: Array.from(this.workspaces.get(workspaceId)!.values()),
        document: {
          id: documentId,
          content: this.documents.get(documentId)?.content,
          version: this.documents.get(documentId)?.version
        }
      });

      // Notify others
      socket.to(`workspace:${workspaceId}`).emit('collab:user-joined', {
        collaborator
      });

      // Start presence tracking
      this.startPresenceTracking(socket, userId, workspaceId);
    });

    // Handle cursor movement
    socket.on('collab:cursor-move', (data: {
      workspaceId: string;
      x: number;
      y: number;
      elementId?: string;
    }) => {
      const collaborator = this.getCollaborator(data.workspaceId, userId);
      if (collaborator) {
        collaborator.cursor = {
          x: data.x,
          y: data.y,
          elementId: data.elementId
        };
        collaborator.lastActivity = Date.now();

        // Broadcast to others
        socket.to(`workspace:${data.workspaceId}`).emit('collab:cursor-update', {
          userId,
          cursor: collaborator.cursor
        });
      }
    });

    // Handle selection changes
    socket.on('collab:selection-change', (data: {
      workspaceId: string;
      selection: {
        start: number;
        end: number;
        elementId: string;
      } | null;
    }) => {
      const collaborator = this.getCollaborator(data.workspaceId, userId);
      if (collaborator) {
        collaborator.selection = data.selection || undefined;
        collaborator.lastActivity = Date.now();

        // Broadcast to others
        socket.to(`workspace:${data.workspaceId}`).emit('collab:selection-update', {
          userId,
          selection: collaborator.selection
        });
      }
    });

    // Handle document operations
    socket.on('collab:operation', async (data: {
      documentId: string;
      operation: Omit<DocumentOperation, 'id' | 'userId' | 'timestamp'>;
    }) => {
      await this.handleDocumentOperation(socket, userId, data);
    });

    // Handle lock requests
    socket.on('collab:request-lock', async (data: {
      documentId: string;
      elementId: string;
      lockType: 'read' | 'write';
    }) => {
      await this.handleLockRequest(socket, userId, data);
    });

    // Handle lock release
    socket.on('collab:release-lock', (data: {
      documentId: string;
      elementId: string;
    }) => {
      this.releaseLock(socket, userId, data.documentId, data.elementId);
    });

    // Handle undo/redo
    socket.on('collab:undo', async (documentId: string) => {
      await this.handleUndo(socket, userId, documentId);
    });

    socket.on('collab:redo', async (documentId: string) => {
      await this.handleRedo(socket, userId, documentId);
    });

    // Handle presence status
    socket.on('collab:status-change', (data: {
      workspaceId: string;
      status: 'active' | 'idle' | 'away';
    }) => {
      const collaborator = this.getCollaborator(data.workspaceId, userId);
      if (collaborator) {
        collaborator.status = data.status;
        socket.to(`workspace:${data.workspaceId}`).emit('collab:user-status-change', {
          userId,
          status: data.status
        });
      }
    });

    // Handle comments/annotations
    socket.on('collab:add-comment', async (data: {
      documentId: string;
      elementId: string;
      comment: {
        text: string;
        position?: { x: number; y: number };
      };
    }) => {
      await this.addComment(socket, userId, data);
    });

    // Leave workspace
    socket.on('collab:leave-workspace', (workspaceId: string) => {
      this.leaveWorkspace(socket, userId, workspaceId);
    });
  }

  private async loadDocument(documentId: string) {
    try {
      // Load document from database
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) throw error;

      this.documents.set(documentId, {
        id: documentId,
        content: data.content || {},
        version: data.version || 1,
        lastModified: new Date(data.updated_at).getTime(),
        locks: new Map()
      });

      // Load operation history
      const { data: operations } = await this.supabase
        .from('document_operations')
        .select('*')
        .eq('document_id', documentId)
        .order('timestamp', { ascending: true })
        .limit(100);

      if (operations) {
        this.operationHistory.set(documentId, operations);
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      
      // Create new document
      this.documents.set(documentId, {
        id: documentId,
        content: {},
        version: 1,
        lastModified: Date.now(),
        locks: new Map()
      });
      this.operationHistory.set(documentId, []);
    }
  }

  private async handleDocumentOperation(
    socket: Socket,
    userId: string,
    data: {
      documentId: string;
      operation: Omit<DocumentOperation, 'id' | 'userId' | 'timestamp'>;
    }
  ) {
    const document = this.documents.get(data.documentId);
    if (!document) return;

    // Check if user has write lock for the element
    const elementPath = data.operation.path.join('.');
    const lock = document.locks.get(elementPath);
    
    if (lock && lock.type === 'write' && lock.userId !== userId) {
      socket.emit('collab:operation-rejected', {
        reason: 'Element is locked by another user',
        lockedBy: lock.userId
      });
      return;
    }

    // Create operation
    const operation: DocumentOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      timestamp: Date.now(),
      version: document.version + 1,
      ...data.operation
    };

    // Apply operation using OT (Operational Transformation)
    try {
      const newContent = this.applyOperation(document.content, operation);
      
      // Update document
      document.content = newContent;
      document.version = operation.version;
      document.lastModified = Date.now();

      // Store operation in history
      const history = this.operationHistory.get(data.documentId) || [];
      history.push(operation);
      this.operationHistory.set(data.documentId, history);

      // Persist to database
      await this.saveDocument(document);
      await this.saveOperation(data.documentId, operation);

      // Broadcast to all users in the document
      this.io.to(`document:${data.documentId}`).emit('collab:operation-applied', {
        operation,
        document: {
          content: document.content,
          version: document.version
        }
      });

    } catch (error) {
      console.error('Failed to apply operation:', error);
      socket.emit('collab:operation-failed', {
        error: error.message,
        operation
      });
    }
  }

  private applyOperation(content: any, operation: DocumentOperation): any {
    // Deep clone content to avoid mutations
    const newContent = JSON.parse(JSON.stringify(content));
    
    // Navigate to the target element
    let target = newContent;
    const path = [...operation.path];
    const lastKey = path.pop();
    
    for (const key of path) {
      if (!target[key]) {
        target[key] = {};
      }
      target = target[key];
    }

    // Apply operation
    switch (operation.type) {
      case 'insert':
        if (Array.isArray(target[lastKey!])) {
          target[lastKey!].splice(operation.value.index, 0, operation.value.item);
        } else {
          target[lastKey!] = operation.value;
        }
        break;
        
      case 'delete':
        if (Array.isArray(target[lastKey!])) {
          target[lastKey!].splice(operation.value.index, 1);
        } else {
          delete target[lastKey!];
        }
        break;
        
      case 'update':
        target[lastKey!] = operation.value;
        break;
        
      case 'move':
        // Move operation for arrays
        if (Array.isArray(target[lastKey!])) {
          const item = target[lastKey!].splice(operation.value.from, 1)[0];
          target[lastKey!].splice(operation.value.to, 0, item);
        }
        break;
    }

    return newContent;
  }

  private async saveDocument(document: Document) {
    try {
      await this.supabase
        .from('documents')
        .upsert({
          id: document.id,
          content: document.content,
          version: document.version,
          updated_at: new Date(document.lastModified).toISOString()
        });
    } catch (error) {
      console.error('Failed to save document:', error);
    }
  }

  private async saveOperation(documentId: string, operation: DocumentOperation) {
    try {
      await this.supabase
        .from('document_operations')
        .insert({
          document_id: documentId,
          ...operation
        });
    } catch (error) {
      console.error('Failed to save operation:', error);
    }
  }

  private async handleLockRequest(
    socket: Socket,
    userId: string,
    data: {
      documentId: string;
      elementId: string;
      lockType: 'read' | 'write';
    }
  ) {
    const document = this.documents.get(data.documentId);
    if (!document) return;

    const existingLock = document.locks.get(data.elementId);
    
    // Check if element is already locked
    if (existingLock && existingLock.type === 'write' && existingLock.userId !== userId) {
      socket.emit('collab:lock-denied', {
        elementId: data.elementId,
        reason: 'Already locked',
        lockedBy: existingLock.userId
      });
      return;
    }

    // Grant lock
    const lock: DocumentLock = {
      userId,
      elementId: data.elementId,
      type: data.lockType,
      timestamp: Date.now()
    };

    document.locks.set(data.elementId, lock);

    socket.emit('collab:lock-granted', {
      elementId: data.elementId,
      lockType: data.lockType
    });

    // Notify others
    socket.to(`document:${data.documentId}`).emit('collab:element-locked', {
      elementId: data.elementId,
      userId,
      lockType: data.lockType
    });
  }

  private releaseLock(
    socket: Socket,
    userId: string,
    documentId: string,
    elementId: string
  ) {
    const document = this.documents.get(documentId);
    if (!document) return;

    const lock = document.locks.get(elementId);
    if (lock && lock.userId === userId) {
      document.locks.delete(elementId);
      
      // Notify all users
      this.io.to(`document:${documentId}`).emit('collab:element-unlocked', {
        elementId,
        userId
      });
    }
  }

  private async handleUndo(socket: Socket, userId: string, documentId: string) {
    const history = this.operationHistory.get(documentId) || [];
    const document = this.documents.get(documentId);
    if (!document) return;

    // Find last operation by this user
    const userOperations = history.filter(op => op.userId === userId);
    const lastOperation = userOperations[userOperations.length - 1];
    
    if (!lastOperation) {
      socket.emit('collab:undo-failed', { reason: 'No operations to undo' });
      return;
    }

    // Create inverse operation
    const undoOperation: DocumentOperation = {
      id: `undo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type: this.getInverseOperationType(lastOperation.type),
      path: lastOperation.path,
      value: lastOperation.oldValue,
      oldValue: lastOperation.value,
      timestamp: Date.now(),
      version: document.version + 1
    };

    // Apply undo
    await this.handleDocumentOperation(socket, userId, {
      documentId,
      operation: undoOperation
    });
  }

  private async handleRedo(socket: Socket, userId: string, documentId: string) {
    // Similar to undo but in reverse
    // Implementation would track undo history
  }

  private getInverseOperationType(type: DocumentOperation['type']): DocumentOperation['type'] {
    switch (type) {
      case 'insert': return 'delete';
      case 'delete': return 'insert';
      case 'update': return 'update';
      case 'move': return 'move';
    }
  }

  private async addComment(
    socket: Socket,
    userId: string,
    data: {
      documentId: string;
      elementId: string;
      comment: {
        text: string;
        position?: { x: number; y: number };
      };
    }
  ) {
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Save comment to database
    await this.supabase.from('document_comments').insert({
      id: commentId,
      document_id: data.documentId,
      element_id: data.elementId,
      user_id: userId,
      text: data.comment.text,
      position: data.comment.position,
      created_at: new Date().toISOString()
    });

    // Broadcast to all users
    this.io.to(`document:${data.documentId}`).emit('collab:comment-added', {
      commentId,
      userId,
      elementId: data.elementId,
      comment: data.comment,
      timestamp: Date.now()
    });
  }

  private startPresenceTracking(socket: Socket, userId: string, workspaceId: string) {
    // Clear existing timer
    const existingTimer = this.presenceTimers.get(`${userId}:${workspaceId}`);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Check for idle status every 30 seconds
    const timer = setInterval(() => {
      const collaborator = this.getCollaborator(workspaceId, userId);
      if (collaborator) {
        const idleTime = Date.now() - collaborator.lastActivity;
        
        if (idleTime > 300000 && collaborator.status === 'active') { // 5 minutes
          collaborator.status = 'idle';
          socket.to(`workspace:${workspaceId}`).emit('collab:user-status-change', {
            userId,
            status: 'idle'
          });
        } else if (idleTime > 900000 && collaborator.status === 'idle') { // 15 minutes
          collaborator.status = 'away';
          socket.to(`workspace:${workspaceId}`).emit('collab:user-status-change', {
            userId,
            status: 'away'
          });
        }
      }
    }, 30000);

    this.presenceTimers.set(`${userId}:${workspaceId}`, timer);
  }

  private getCollaborator(workspaceId: string, userId: string): Collaborator | undefined {
    return this.workspaces.get(workspaceId)?.get(userId);
  }

  private generateUserColor(userId: string): string {
    // Generate consistent color based on user ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FECA57', '#48DBFB', '#FF9FF3', '#54A0FF'
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  private leaveWorkspace(socket: Socket, userId: string, workspaceId: string) {
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      workspace.delete(userId);
      
      // Clean up empty workspaces
      if (workspace.size === 0) {
        this.workspaces.delete(workspaceId);
      }

      // Clear presence timer
      const timerKey = `${userId}:${workspaceId}`;
      const timer = this.presenceTimers.get(timerKey);
      if (timer) {
        clearInterval(timer);
        this.presenceTimers.delete(timerKey);
      }

      // Release all locks held by user
      for (const [documentId, document] of this.documents) {
        for (const [elementId, lock] of document.locks) {
          if (lock.userId === userId) {
            document.locks.delete(elementId);
            socket.to(`document:${documentId}`).emit('collab:element-unlocked', {
              elementId,
              userId
            });
          }
        }
      }

      // Notify others
      socket.to(`workspace:${workspaceId}`).emit('collab:user-left', { userId });
    }

    // Leave socket rooms
    socket.leave(`workspace:${workspaceId}`);
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data.userId;
    
    // Leave all workspaces
    for (const [workspaceId, workspace] of this.workspaces) {
      if (workspace.has(userId)) {
        this.leaveWorkspace(socket, userId, workspaceId);
      }
    }
  }
}