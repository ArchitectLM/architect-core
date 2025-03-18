/**
 * Simple logger utility with different log levels
 */
export const logger = {
  level: 'info' as 'debug' | 'info' | 'warn' | 'error',
  
  debug(message: string, data?: any) {
    if (['debug'].includes(this.level)) {
      console.log(`[DEBUG] ${message}`, data ? data : '');
    }
  },
  
  info(message: string, data?: any) {
    if (['debug', 'info'].includes(this.level)) {
      console.log(`[INFO] ${message}`, data ? data : '');
    }
  },
  
  warn(message: string, data?: any) {
    if (['debug', 'info', 'warn'].includes(this.level)) {
      console.warn(`[WARN] ${message}`, data ? data : '');
    }
  },
  
  error(message: string, error?: any) {
    console.error(`[ERROR] ${message}`, error ? error : '');
  }
}; 