export const validateUrl = (urlString: string) => {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    if (urlString.length > 2048) {
      return false;
    }

    const hostname = url.hostname;
    // Block localhost, link-local, private IPs
    if (
      hostname === 'localhost' ||
      hostname.match(/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/) ||
      hostname.match(/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/) ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/) ||
      hostname.match(/^192\.168\.\d{1,3}\.\d{1,3}$/) ||
      hostname.match(/^169\.254\.\d{1,3}\.\d{1,3}$/) ||
      hostname.endsWith('.local') ||
      hostname.includes('::1') ||
      hostname.match(/^\[?[fF][cCdD]/) // IPv6 unique local
    ) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

export const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number = 8000) => {
  let currentUrl = url;
  let redirects = 0;
  
  while (redirects < 5) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      // Manual redirect handling for SSRF guard
      const response = await fetch(currentUrl, { ...options, signal: controller.signal, redirect: 'manual' });
      clearTimeout(id);
      
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) return response; // No location header, return as is
        
        const nextUrl = new URL(location, currentUrl).toString();
        if (!validateUrl(nextUrl)) {
           throw new Error('Redirected to an invalid or blocked URL');
        }
        currentUrl = nextUrl;
        redirects++;
        continue;
      }
      return response;
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }
  throw new Error('Too many redirects');
};
