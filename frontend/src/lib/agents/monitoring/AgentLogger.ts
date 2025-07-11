import { EventEmitter } from 'eventemitter3';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  agentId?: string;
  category: string;
  message: string;
  data?: any;
  error?: Error;
  correlationId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  maxEntries: number;
  persistLogs: boolean;
  logToConsole: boolean;
  structuredLogging: boolean;
}

export class AgentLogger extends EventEmitter {
  private static instance: AgentLogger;
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private logStreams: Map<string, (entry: LogEntry) => void> = new Map();

  private constructor(config?: Partial<LoggerConfig>) {
    super();
    this.config = {
      level: LogLevel.INFO,
      maxEntries: 10000,
      persistLogs: true,
      logToConsole: true,
      structuredLogging: true,
      ...config,
    };
  }

  static getInstance(config?: Partial<LoggerConfig>): AgentLogger {
    if (!AgentLogger.instance) {
      AgentLogger.instance = new AgentLogger(config);
    }
    return AgentLogger.instance;
  }

  // Logging methods
  debug(agentId: string | undefined, category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, agentId, category, message, data);
  }

  info(agentId: string | undefined, category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, agentId, category, message, data);
  }

  warn(agentId: string | undefined, category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, agentId, category, message, data);
  }

  error(agentId: string | undefined, category: string, message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, agentId, category, message, data, error);
  }

  fatal(agentId: string | undefined, category: string, message: string, error?: Error, data?: any): void {
    this.log(LogLevel.FATAL, agentId, category, message, data, error);
  }

  // Core logging method
  private log(
    level: LogLevel,
    agentId: string | undefined,
    category: string,
    message: string,
    data?: any,
    error?: Error
  ): void {
    if (level < this.config.level) {
      return; // Skip logs below configured level
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      agentId,
      category,
      message,
      data,
      error,
      correlationId: this.getCorrelationId(),
    };

    // Add to log buffer
    this.addLogEntry(entry);

    // Log to console if enabled
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }

    // Emit log event
    this.emit('log', entry);

    // Stream to subscribers
    this.streamLog(entry);

    // Persist if enabled
    if (this.config.persistLogs) {
      this.persistLog(entry);
    }
  }

  private addLogEntry(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Maintain max entries limit
    if (this.logs.length > this.config.maxEntries) {
      this.logs.shift();
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const agentInfo = entry.agentId ? `[${entry.agentId}]` : '';
    
    if (this.config.structuredLogging) {
      // Structured logging format
      const logObject = {
        timestamp,
        level: levelName,
        agentId: entry.agentId,
        category: entry.category,
        message: entry.message,
        data: entry.data,
        error: entry.error ? {
          message: entry.error.message,
          stack: entry.error.stack,
        } : undefined,
        correlationId: entry.correlationId,
      };
      
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(JSON.stringify(logObject));
          break;
        case LogLevel.INFO:
          console.info(JSON.stringify(logObject));
          break;
        case LogLevel.WARN:
          console.warn(JSON.stringify(logObject));
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(JSON.stringify(logObject));
          break;
      }
    } else {
      // Human-readable format
      const message = `${timestamp} [${levelName}] ${agentInfo} ${entry.category}: ${entry.message}`;
      
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(message, entry.data);
          break;
        case LogLevel.INFO:
          console.info(message, entry.data);
          break;
        case LogLevel.WARN:
          console.warn(message, entry.data);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(message, entry.error || entry.data);
          break;
      }
    }
  }

  private streamLog(entry: LogEntry): void {
    // Stream to all subscribers
    for (const stream of this.logStreams.values()) {
      try {
        stream(entry);
      } catch (error) {
        console.error('Error streaming log:', error);
      }
    }
  }

  private persistLog(entry: LogEntry): void {
    // In a real implementation, this would save to a database or file
    if (typeof window !== 'undefined') {
      // Browser environment - use IndexedDB or localStorage
      try {
        const logs = JSON.parse(localStorage.getItem('agent_logs') || '[]');
        logs.push(entry);
        
        // Keep only recent logs
        if (logs.length > this.config.maxEntries) {
          logs.splice(0, logs.length - this.config.maxEntries);
        }
        
        localStorage.setItem('agent_logs', JSON.stringify(logs));
      } catch (error) {
        console.error('Failed to persist log:', error);
      }
    }
  }

  private getCorrelationId(): string | undefined {
    // In a real implementation, this would get the correlation ID from context
    // For now, return undefined
    return undefined;
  }

  // Query methods
  getLogs(filter?: {
    agentId?: string;
    category?: string;
    level?: LogLevel;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];
    
    if (filter) {
      if (filter.agentId !== undefined) {
        filtered = filtered.filter(log => log.agentId === filter.agentId);
      }
      if (filter.category !== undefined) {
        filtered = filtered.filter(log => log.category === filter.category);
      }
      if (filter.level !== undefined) {
        filtered = filtered.filter(log => log.level >= filter.level!);
      }
      if (filter.startTime !== undefined) {
        filtered = filtered.filter(log => log.timestamp >= filter.startTime!);
      }
      if (filter.endTime !== undefined) {
        filtered = filtered.filter(log => log.timestamp <= filter.endTime!);
      }
      if (filter.limit !== undefined) {
        filtered = filtered.slice(-filter.limit);
      }
    }
    
    return filtered;
  }

  searchLogs(query: string): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.logs.filter(log => 
      log.message.toLowerCase().includes(lowerQuery) ||
      log.category.toLowerCase().includes(lowerQuery) ||
      (log.agentId && log.agentId.toLowerCase().includes(lowerQuery)) ||
      (log.data && JSON.stringify(log.data).toLowerCase().includes(lowerQuery))
    );
  }

  getLogStats(): {
    total: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    byAgent: Record<string, number>;
    errorRate: number;
  } {
    const stats = {
      total: this.logs.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byAgent: {} as Record<string, number>,
      errorRate: 0,
    };
    
    for (const log of this.logs) {
      // By level
      const levelName = LogLevel[log.level];
      stats.byLevel[levelName] = (stats.byLevel[levelName] || 0) + 1;
      
      // By category
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      
      // By agent
      if (log.agentId) {
        stats.byAgent[log.agentId] = (stats.byAgent[log.agentId] || 0) + 1;
      }
    }
    
    // Calculate error rate
    const errorCount = (stats.byLevel['ERROR'] || 0) + (stats.byLevel['FATAL'] || 0);
    stats.errorRate = stats.total > 0 ? errorCount / stats.total : 0;
    
    return stats;
  }

  // Stream management
  subscribe(streamId: string, handler: (entry: LogEntry) => void): void {
    this.logStreams.set(streamId, handler);
  }

  unsubscribe(streamId: string): void {
    this.logStreams.delete(streamId);
  }

  // Configuration
  setLogLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLogLevel(): LogLevel {
    return this.config.level;
  }

  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  // Utility methods
  clear(): void {
    this.logs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('agent_logs');
    }
  }

  export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    } else {
      // CSV format
      const headers = ['timestamp', 'level', 'agentId', 'category', 'message', 'data', 'error'];
      const rows = this.logs.map(log => [
        new Date(log.timestamp).toISOString(),
        LogLevel[log.level],
        log.agentId || '',
        log.category,
        log.message,
        log.data ? JSON.stringify(log.data) : '',
        log.error ? log.error.message : '',
      ]);
      
      return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    }
  }

  // Helper method for creating child loggers
  createAgentLogger(agentId: string) {
    return {
      debug: (category: string, message: string, data?: any) => 
        this.debug(agentId, category, message, data),
      info: (category: string, message: string, data?: any) => 
        this.info(agentId, category, message, data),
      warn: (category: string, message: string, data?: any) => 
        this.warn(agentId, category, message, data),
      error: (category: string, message: string, error?: Error, data?: any) => 
        this.error(agentId, category, message, error, data),
      fatal: (category: string, message: string, error?: Error, data?: any) => 
        this.fatal(agentId, category, message, error, data),
    };
  }
}