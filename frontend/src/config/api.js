const DEPLOYED_BACKEND_URL = 'https://smartplate-ngo-lalit.onrender.com';
const configuredBackendUrl = process.env.REACT_APP_BACKEND_URL?.trim();

const isLoopbackUrl = (value) => {
  if (!value) return false;

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
};

// A localhost URL in a production bundle points at each visitor's own device.
// Keep local development local, while falling back to the deployed API in production.
const backendUrl = isLoopbackUrl(configuredBackendUrl)
  ? process.env.NODE_ENV === 'production'
    ? DEPLOYED_BACKEND_URL
    : 'http://localhost:8000'
  : configuredBackendUrl || (
    process.env.NODE_ENV === 'production'
      ? DEPLOYED_BACKEND_URL
      : 'http://localhost:8000'
  );

export const API_BASE_URL = `${backendUrl.replace(/\/+$/, '')}/api`;
