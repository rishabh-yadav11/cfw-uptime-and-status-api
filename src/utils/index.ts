export * from './response';
export * from './ssrfGuard';

export const readBodySafely = async (response: Response, maxSize = 2 * 1024 * 1024): Promise<string> => {
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new Error('Response body too large');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return await response.text();
  }

  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      break;
    }

    if (value) {
      chunks.push(value);
      receivedLength += value.length;

      if (receivedLength > maxSize) {
        throw new Error('Response body too large');
      }
    }
  }

  // Concatenate chunks
  const chunksAll = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }

  return new TextDecoder('utf-8').decode(chunksAll);
};
