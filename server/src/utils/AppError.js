// Operational error with a stable machine-readable code. Anything else is treated as a 500.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}
export const badRequest = (code, msg, details) => new AppError(400, code, msg, details);
export const unauthorized = (code, msg) => new AppError(401, code, msg);
export const forbidden = (code, msg) => new AppError(403, code, msg);
export const notFound = (code, msg) => new AppError(404, code, msg);
export const conflict = (code, msg, details) => new AppError(409, code, msg, details);
