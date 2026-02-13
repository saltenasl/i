export type Ok<T> = {
  ok: true;
  data: T;
};

export type Err<C extends string, M = unknown> = {
  ok: false;
  error: {
    code: C;
    message: string;
    meta?: M;
  };
};

export type Result<T, C extends string = string, M = unknown> = Ok<T> | Err<C, M>;

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });

export const err = <C extends string, M = unknown>(
  code: C,
  message: string,
  meta?: M,
): Err<C, M> => {
  const error: Err<C, M>['error'] = {
    code,
    message,
  };

  if (meta !== undefined) {
    error.meta = meta;
  }

  return {
    ok: false,
    error,
  };
};
