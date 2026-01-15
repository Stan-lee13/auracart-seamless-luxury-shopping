import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';
const logger = pino({ level, base: { service: 'auracart-webhook' }, timestamp: pino.stdTimeFunctions.isoTime });

export default logger;
