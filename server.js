const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const util = require('util');

// --- Configuración de almacenamiento de Logs ---
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const appLogStream = fs.createWriteStream(path.join(logsDir, 'app.log'), { flags: 'a' });
const errorLogStream = fs.createWriteStream(path.join(logsDir, 'error.log'), { flags: 'a' });

function formatLog(level, args) {
  const timestamp = new Date().toISOString();
  const message = util.format(...args);
  return `[${timestamp}] [${level}] ${message}\n`;
}

// Redirigir console.log / console.info a logs/app.log
const origLog = console.log;
console.log = function (...args) {
  appLogStream.write(formatLog('INFO', args));
  origLog.apply(console, args);
};

const origInfo = console.info;
console.info = function (...args) {
  appLogStream.write(formatLog('INFO', args));
  origInfo.apply(console, args);
};

// Redirigir console.warn / console.error a logs/app.log y logs/error.log
const origWarn = console.warn;
console.warn = function (...args) {
  const line = formatLog('WARN', args);
  appLogStream.write(line);
  errorLogStream.write(line);
  origWarn.apply(console, args);
};

const origError = console.error;
console.error = function (...args) {
  const line = formatLog('ERROR', args);
  appLogStream.write(line);
  errorLogStream.write(line);
  origError.apply(console, args);
};

// Capturar errores fatales globales no controlados
process.on('uncaughtException', (err) => {
  const line = formatLog('FATAL_EXCEPTION', [err && err.stack ? err.stack : err]);
  errorLogStream.write(line);
  appLogStream.write(line);
  origError('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  const line = formatLog('UNHANDLED_REJECTION', [reason instanceof Error ? reason.stack : reason]);
  errorLogStream.write(line);
  appLogStream.write(line);
  origError('Unhandled Rejection:', reason);
});

// En servidor por defecto debe ser producción a menos que se especifique development
const dev = process.env.NODE_ENV === 'development';
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on port ${port} (mode: ${dev ? 'development' : 'production'})`);
  });
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});

