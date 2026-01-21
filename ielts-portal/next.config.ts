import type { NextConfig } from "next";

// Use environment variable or default to localhost
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {
  // Don't redirect API calls - let them pass through as-is
  skipTrailingSlashRedirect: true,

  async rewrites() {
    return [
      // Proxy media files to Django
      {
        source: '/media/:path*',
        destination: `${API_URL}/media/:path*`,
      },
      // Forward all /api/ielts/* requests to Django (including auth)
      {
        source: '/api/ielts/:path*/',
        destination: `${API_URL}/api/ielts/:path*/`,
      },
      {
        source: '/api/ielts/:path*',
        destination: `${API_URL}/api/ielts/:path*/`,
      },
      // Django auth endpoints (login, logout, me, refresh) - must be explicit since /api/auth/* is reserved for NextAuth
      {
        source: '/api/auth/login/',
        destination: `${API_URL}/api/auth/login/`,
      },
      {
        source: '/api/auth/logout/',
        destination: `${API_URL}/api/auth/logout/`,
      },
      {
        source: '/api/auth/me/',
        destination: `${API_URL}/api/auth/me/`,
      },
      {
        source: '/api/auth/refresh/',
        destination: `${API_URL}/api/auth/refresh/`,
      },
      // Forward other /api/* requests to Django (except NextAuth /api/auth/*)
      {
        source: '/api/:path((?!auth).*)',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
