export const successResponse = (data: any, meta: any, requestId: string) => ({
  ok: true,
  data,
  meta,
  request_id: requestId,
});

export const errorResponse = (code: string, message: string, requestId: string) => ({
  ok: false,
  error: { code, message },
  request_id: requestId,
});
