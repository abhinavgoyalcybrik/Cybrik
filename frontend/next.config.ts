// Use environment variable for backend URL, fallback to localhost for development
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

const nextConfig = {
  trailingSlash: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/auth/login/',
          destination: `${BACKEND_URL}/api/auth/login/`,
        },
        {
          source: '/api/auth/login',
          destination: `${BACKEND_URL}/api/auth/login/`,
        },
        {
          source: '/api/auth/refresh/',
          destination: `${BACKEND_URL}/api/auth/refresh/`,
        },
        {
          source: '/api/auth/logout/',
          destination: `${BACKEND_URL}/api/auth/logout/`,
        },
        {
          source: '/api/auth/me/',
          destination: `${BACKEND_URL}/api/auth/me/`,
        },
        {
          source: '/api/auth/me',
          destination: `${BACKEND_URL}/api/auth/me/`,
        },
        {
          source: '/api/dashboard/overview/',
          destination: `${BACKEND_URL}/api/dashboard/overview/`,
        },
        {
          source: '/api/dashboard/overview',
          destination: `${BACKEND_URL}/api/dashboard/overview/`,
        },
        {
          source: '/api/dashboard/summary/',
          destination: `${BACKEND_URL}/api/dashboard/summary/`,
        },
        {
          source: '/api/dashboard/config/',
          destination: `${BACKEND_URL}/api/dashboard/config/`,
        },
        {
          source: '/api/dashboard/config/save/',
          destination: `${BACKEND_URL}/api/dashboard/config/save/`,
        },
        {
          source: '/api/dashboard/config/save-role/',
          destination: `${BACKEND_URL}/api/dashboard/config/save-role/`,
        },
        {
          source: '/api/dashboard/config/get-role/',
          destination: `${BACKEND_URL}/api/dashboard/config/get-role/`,
        },
        {
          source: '/api/analytics/time-series/',
          destination: `${BACKEND_URL}/api/analytics/time-series/`,
        },
        {
          source: '/api/analytics/funnel/',
          destination: `${BACKEND_URL}/api/analytics/funnel/`,
        },
        {
          source: '/api/analytics/applications-status/',
          destination: `${BACKEND_URL}/api/analytics/applications-status/`,
        },
        {
          source: '/api/analytics/cost-time-series/',
          destination: `${BACKEND_URL}/api/analytics/cost-time-series/`,
        },
        {
          source: '/api/analytics/llm-usage/',
          destination: `${BACKEND_URL}/api/analytics/llm-usage/`,
        },
        {
          source: '/api/leads/',
          destination: `${BACKEND_URL}/api/leads/`,
        },
        {
          source: '/api/web-leads/',
          destination: `${BACKEND_URL}/api/web-leads/`,
        },
        {
          source: '/api/leads/create/',
          destination: `${BACKEND_URL}/api/leads/create/`,
        },
        {
          source: '/api/leads/:id/',
          destination: `${BACKEND_URL}/api/leads/:id/`,
        },
        {
          source: '/api/leads/',
          destination: `${BACKEND_URL}/api/leads/`,
        },
        {
          source: '/api/leads/:id/:action/',
          destination: `${BACKEND_URL}/api/leads/:id/:action/`,
        },
        {
          source: '/api/applications/',
          destination: `${BACKEND_URL}/api/applications/`,
        },
        {
          source: '/api/applications/:id/',
          destination: `${BACKEND_URL}/api/applications/:id/`,
        },
        {
          source: '/api/calls/',
          destination: `${BACKEND_URL}/api/calls/`,
        },
        {
          source: '/api/calls/:id/',
          destination: `${BACKEND_URL}/api/calls/:id/`,
        },
        {
          source: '/api/calls/:id/fetch_data/',
          destination: `${BACKEND_URL}/api/calls/:id/fetch_data/`,
        },
        {
          source: '/api/calls/:id/:action/',
          destination: `${BACKEND_URL}/api/calls/:id/:action/`,
        },
        {
          source: '/api/tasks/',
          destination: `${BACKEND_URL}/api/tasks/`,
        },
        {
          source: '/api/tasks/:id/',
          destination: `${BACKEND_URL}/api/tasks/:id/`,
        },
        {
          source: '/api/tasks/:id/trigger_call/',
          destination: `${BACKEND_URL}/api/tasks/:id/trigger_call/`,
        },
        {
          source: '/api/tasks/:id/smart_update/',
          destination: `${BACKEND_URL}/api/tasks/:id/smart_update/`,
        },
        {
          source: '/api/ai-calls/schedule/',
          destination: `${BACKEND_URL}/api/ai-calls/schedule/`,
        },
        {
          source: '/api/ai-calls/trigger/',
          destination: `${BACKEND_URL}/api/ai-calls/trigger/`,
        },
        {
          source: '/api/ai-calls/process-due/',
          destination: `${BACKEND_URL}/api/ai-calls/process-due/`,
        },
        {
          source: '/api/staff/',
          destination: `${BACKEND_URL}/api/staff/`,
        },
        {
          source: '/api/staff/:id/',
          destination: `${BACKEND_URL}/api/staff/:id/`,
        },
        {
          source: '/api/transcripts/',
          destination: `${BACKEND_URL}/api/transcripts/`,
        },
        {
          source: '/api/transcripts/:id/',
          destination: `${BACKEND_URL}/api/transcripts/:id/`,
        },
        {
          source: '/api/academic-records/',
          destination: `${BACKEND_URL}/api/academic-records/`,
        },
        {
          source: '/api/academic-records/:id/',
          destination: `${BACKEND_URL}/api/academic-records/:id/`,
        },
        {
          source: '/api/airesults/',
          destination: `${BACKEND_URL}/api/airesults/`,
        },
        {
          source: '/api/airesults/:id/',
          destination: `${BACKEND_URL}/api/airesults/:id/`,
        },
        {
          source: '/api/reports/summary/',
          destination: `${BACKEND_URL}/api/reports/summary/`,
        },
        {
          source: '/api/elevenlabs/callback/',
          destination: `${BACKEND_URL}/api/elevenlabs/callback/`,
        },
        {
          source: '/api/elevenlabs/postcall/',
          destination: `${BACKEND_URL}/api/elevenlabs/postcall/`,
        },
        {
          source: '/api/elevenlabs/audio/:slug*',
          destination: `${BACKEND_URL}/api/elevenlabs/audio/:slug*`,
        },
        {
          source: '/api/asr/callback/',
          destination: `${BACKEND_URL}/api/asr/callback/`,
        },
        {
          source: '/api/webhooks/:slug*',
          destination: `${BACKEND_URL}/api/webhooks/:slug*`,
        },
        {
          source: '/api/search/',
          destination: `${BACKEND_URL}/api/search/`,
        },
        {
          source: '/api/notifications/',
          destination: `${BACKEND_URL}/api/notifications/`,
        },
        {
          source: '/api/notifications/mark_all_read/',
          destination: `${BACKEND_URL}/api/notifications/mark_all_read/`,
        },
        {
          source: '/api/public/upload/',
          destination: `${BACKEND_URL}/api/public/upload/`,
        },
        {
          source: '/api/public/upload',
          destination: `${BACKEND_URL}/api/public/upload/`,
        },
        {
          source: '/api/generate-upload-link/',
          destination: `${BACKEND_URL}/api/generate-upload-link/`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

module.exports = nextConfig;
