// Tiny error class + asyncHandler. Lets route handlers throw HttpError(403, '...')
// and have it surface as a proper JSON response without try/catch noise.

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
