import { AppError } from '../utils/AppError.js';

// validate({ body, query, params }) with zod schemas; replaces the raw input with parsed values.
export const validate = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) fields[issue.path.join('.') || '_'] ??= issue.message;
      return next(new AppError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { fields }));
    }
    if (part === 'query') {
      // Express 4 allows reassigning req.query; keep parsed values separate for clarity.
      req.validQuery = result.data;
    } else {
      req[part] = result.data;
    }
  }
  next();
};
