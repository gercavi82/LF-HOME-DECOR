import fs from 'fs';
import path from 'path';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Utilidad de logging para LF Home Decor.
 * Escribe en consola (que server.js redirige automáticamente a logs/app.log y logs/error.log)
 * y en entornos de servidor guarda directamente los registros con marca de tiempo.
 */
class Logger {
  private logDir: string;
  private isServer: boolean;

  constructor() {
    this.isServer = typeof window === 'undefined';
    this.logDir = path.join(process.cwd(), 'logs');
  }

  private writeToFile(filename: string, message: string) {
    if (!this.isServer) return;
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      fs.appendFileSync(path.join(this.logDir, filename), message + '\n', 'utf8');
    } catch {
      // Evitar bloquear la app si hay problemas de permisos en disco
    }
  }

  private format(level: LogLevel, message: string, meta?: unknown) {
    const timestamp = new Date().toISOString();
    const metaStr = meta !== undefined ? (typeof meta === 'object' ? JSON.stringify(meta) : String(meta)) : '';
    return `[${timestamp}] [${level}] ${message} ${metaStr}`.trim();
  }

  info(message: string, meta?: unknown) {
    const logLine = this.format('INFO', message, meta);
    console.info(logLine);
    this.writeToFile('app.log', logLine);
  }

  warn(message: string, meta?: unknown) {
    const logLine = this.format('WARN', message, meta);
    console.warn(logLine);
    this.writeToFile('app.log', logLine);
    this.writeToFile('error.log', logLine);
  }

  error(message: string, error?: unknown) {
    const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    const logLine = this.format('ERROR', message, errorDetails);
    console.error(logLine);
    this.writeToFile('app.log', logLine);
    this.writeToFile('error.log', logLine);
  }

  debug(message: string, meta?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      const logLine = this.format('DEBUG', message, meta);
      console.debug(logLine);
      this.writeToFile('app.log', logLine);
    }
  }
}

export const logger = new Logger();
