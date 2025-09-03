/**
 * Contextual logging system with focus modes and quiet mode support
 * Inspired by vibestack logging strategy
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = 
  | 'websocket'     // WebSocket connections, messages, state
  | 'auth'          // Authentication flows, sessions
  | 'ai'            // AI operations, streaming, responses
  | 'ui'            // UI components, interactions, rendering
  | 'data'          // Database operations, API calls
  | 'voice'         // Voice AI, transcription, audio processing
  | 'artifacts'     // Artifact creation, persistence
  | 'performance'   // Performance monitoring
  | 'system'        // System operations, workers
  | 'debug';        // General debugging

export type LogFocusMode = 'none' | 'quiet' | LogContext | LogContext[];

interface LoggerConfig {
  level: LogLevel;
  focusMode: LogFocusMode;
  patterns: string[];
  disabledPatterns: string[];
  filterHeartbeats: boolean;
}

class ContextualLogger {
  private config: LoggerConfig;
  private isClient: boolean;

  constructor() {
    this.isClient = typeof window !== 'undefined';
    this.config = this.loadConfig();
    
    // Expose control in browser console
    if (this.isClient && typeof window !== 'undefined') {
      (window as any).logControl = {
        focus: (mode: LogFocusMode) => this.setFocusMode(mode),
        only: (...contexts: LogContext[]) => this.setFocusMode(contexts),
        quiet: () => this.setFocusMode('quiet'),
        none: () => this.setFocusMode('none'),
        all: () => this.setFocusMode('debug'),
        status: () => this.getStatus(),
        config: () => this.config
      };
    }
  }

  private loadConfig(): LoggerConfig {
    const env = this.isClient ? import.meta.env : process.env;
    
    return {
      level: (env.VITE_LOG_LEVEL || env.LOG_LEVEL || 'info') as LogLevel,
      focusMode: this.parseFocusMode(env.VITE_LOG_FOCUS_MODE || env.LOG_FOCUS_MODE || 'quiet'),
      patterns: this.parsePatterns(env.VITE_LOG_PATTERNS || env.LOG_PATTERNS || ''),
      disabledPatterns: this.parsePatterns(env.VITE_LOG_DISABLED_PATTERNS || env.LOG_DISABLED_PATTERNS || ''),
      filterHeartbeats: (env.VITE_LOG_FILTER_HEARTBEATS || env.LOG_FILTER_HEARTBEATS || 'true') === 'true'
    };
  }

  private parseFocusMode(value: string): LogFocusMode {
    if (value === 'none' || value === 'quiet') return value;
    if (value.includes(',')) {
      return value.split(',').map(s => s.trim()) as LogContext[];
    }
    return value as LogContext;
  }

  private parsePatterns(value: string): string[] {
    return value ? value.split(',').map(s => s.trim()) : [];
  }

  private shouldLog(context: LogContext, level: LogLevel, filePath?: string): boolean {
    // Always log errors unless explicitly set to 'none'
    if (level === 'error' && this.config.focusMode !== 'none') return true;

    // Handle quiet mode - only errors
    if (this.config.focusMode === 'quiet') return level === 'error';
    
    // Handle none mode - no logging
    if (this.config.focusMode === 'none') return false;

    // Check log level
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    if (messageLevelIndex < currentLevelIndex) return false;

    // Check disabled patterns first
    if (filePath && this.matchesPatterns(filePath, this.config.disabledPatterns)) {
      return false;
    }

    // Check focus mode
    if (Array.isArray(this.config.focusMode)) {
      if (!this.config.focusMode.includes(context)) return false;
    } else if (this.config.focusMode !== 'debug' && this.config.focusMode !== context) {
      return false;
    }

    // Check enabled patterns (if specified)
    if (this.config.patterns.length > 0 && filePath) {
      return this.matchesPatterns(filePath, this.config.patterns);
    }

    return true;
  }

  private matchesPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    });
  }

  private formatMessage(context: LogContext, level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toLocaleTimeString();
    const contextEmoji = this.getContextEmoji(context);
    const levelEmoji = this.getLevelEmoji(level);
    
    let formatted = `${levelEmoji} ${contextEmoji} [${context.toUpperCase()}] ${message}`;
    
    if (data !== undefined) {
      formatted += ` ${JSON.stringify(data)}`;
    }
    
    return formatted;
  }

  private getContextEmoji(context: LogContext): string {
    const emojis: Record<LogContext, string> = {
      websocket: '🔌',
      auth: '🔐',
      ai: '🤖',
      ui: '🎨',
      data: '💾',
      voice: '🎤',
      artifacts: '📦',
      performance: '⚡',
      system: '⚙️',
      debug: '🐛'
    };
    return emojis[context] || '📝';
  }

  private getLevelEmoji(level: LogLevel): string {
    const emojis: Record<LogLevel, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    };
    return emojis[level];
  }

  public log(context: LogContext, level: LogLevel, message: string, data?: any, filePath?: string): void {
    if (!this.shouldLog(context, level, filePath)) return;

    const formatted = this.formatMessage(context, level, message, data);
    
    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  public setFocusMode(mode: LogFocusMode): void {
    this.config.focusMode = mode;
    console.info(`🎯 Log focus set to: ${Array.isArray(mode) ? mode.join(', ') : mode}`);
  }

  public getStatus(): void {
    console.info('📊 Logger Status:', {
      level: this.config.level,
      focusMode: this.config.focusMode,
      patterns: this.config.patterns,
      disabledPatterns: this.config.disabledPatterns,
      filterHeartbeats: this.config.filterHeartbeats
    });
  }
}

// Global logger instance
const logger = new ContextualLogger();

/**
 * Create a contextual logger for a specific file/component
 */
export function createLogger(filePath: string, context: LogContext) {
  return {
    debug: (message: string, data?: any) => logger.log(context, 'debug', message, data, filePath),
    info: (message: string, data?: any) => logger.log(context, 'info', message, data, filePath),
    warn: (message: string, data?: any) => logger.log(context, 'warn', message, data, filePath),
    error: (message: string, data?: any) => logger.log(context, 'error', message, data, filePath)
  };
}

/**
 * Specialized logger for WebSocket messages with heartbeat filtering
 */
export function createWebSocketLogger(filePath: string) {
  const wsLogger = createLogger(filePath, 'websocket');
  
  return {
    ...wsLogger,
    messageReceived: (messageType: string, size?: number) => {
      if (logger.config.filterHeartbeats && messageType.includes('heartbeat')) return;
      wsLogger.debug(`📥 Received: ${messageType}${size ? ` (${size} bytes)` : ''}`);
    },
    messageSent: (messageType: string, size?: number) => {
      if (logger.config.filterHeartbeats && messageType.includes('heartbeat')) return;
      wsLogger.debug(`📤 Sent: ${messageType}${size ? ` (${size} bytes)` : ''}`);
    },
    connectionState: (state: string, details?: any) => {
      wsLogger.info(`🔗 Connection ${state}`, details);
    },
    error: (message: string, error?: any) => {
      wsLogger.error(message, error);
    }
  };
}

/**
 * Factory functions for different contexts
 */
export const webSocketLog = (filePath: string) => createWebSocketLogger(filePath);
export const authLog = (filePath: string) => createLogger(filePath, 'auth');
export const aiLog = (filePath: string) => createLogger(filePath, 'ai');
export const uiLog = (filePath: string) => createLogger(filePath, 'ui');
export const dataLog = (filePath: string) => createLogger(filePath, 'data');
export const voiceLog = (filePath: string) => createLogger(filePath, 'voice');
export const artifactLog = (filePath: string) => createLogger(filePath, 'artifacts');
export const performanceLog = (filePath: string) => createLogger(filePath, 'performance');
export const systemLog = (filePath: string) => createLogger(filePath, 'system');
export const debugLog = (filePath: string) => createLogger(filePath, 'debug');

// Export main logger instance
export default logger;