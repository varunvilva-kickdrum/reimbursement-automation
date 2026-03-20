export class IacError extends Error {
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    public readonly cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class IacConfigError extends IacError {
  constructor(message: string, filePath?: string, cause?: unknown) {
    super(message, cause, filePath ? { filePath } : undefined);
  }
}

export class IacValidationError extends IacError {
  constructor(message: string, field?: string, cause?: unknown) {
    super(message, cause, field ? { field } : undefined);
  }
}

export class IacEnvironmentError extends IacError {
  constructor(message: string, environment?: string, cause?: unknown) {
    super(message, cause, environment ? { environment } : undefined);
  }
}

export class IacLambdaError extends IacError {
  constructor(message: string, operation?: string, cause?: unknown) {
    super(message, cause, operation ? { operation } : undefined);
  }
}

export const IacErrors = {
  config: (message: string, filePath?: string, cause?: unknown): IacConfigError =>
    new IacConfigError(message, filePath, cause),
  validation: (message: string, field?: string, cause?: unknown): IacValidationError =>
    new IacValidationError(message, field, cause),
  environment: (message: string, environment?: string, cause?: unknown): IacEnvironmentError =>
    new IacEnvironmentError(message, environment, cause),
  lambda: (message: string, operation?: string, cause?: unknown): IacLambdaError =>
    new IacLambdaError(message, operation, cause),
  /** Non-specific IAC failure (wraps unknown errors from CDK / IO / parsing). */
  create: (message: string, cause?: unknown, context?: Record<string, unknown>): IacError =>
    new IacError(message, cause, context),
};
