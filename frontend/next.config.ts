const nextConfig = {
  trailingSlash: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/auth/login/',
          destination: 'http://127.0.0.1:8000/api/auth/login/',
        },
        {
          source: '/api/auth/login',
          destination: 'http://127.0.0.1:8000/api/auth/login/',
        },
        {
          source: '/api/auth/refresh/',
          destination: 'http://127.0.0.1:8000/api/auth/refresh/',
        },
        {
          source: '/api/auth/logout/',
          destination: 'http://127.0.0.1:8000/api/auth/logout/',
        },
        {
          source: '/api/auth/me/',
          destination: 'http://127.0.0.1:8000/api/auth/me/',
        },
        {
          source: '/api/auth/me',
          destination: 'http://127.0.0.1:8000/api/auth/me/',
        },
        {
          source: '/api/dashboard/overview/',
          destination: 'http://127.0.0.1:8000/api/dashboard/overview/',
        },
        {
          source: '/api/dashboard/overview',
          destination: 'http://127.0.0.1:8000/api/dashboard/overview/',
        },
        {
          source: '/api/dashboard/summary/',
          destination: 'http://127.0.0.1:8000/api/dashboard/summary/',
        },
        {
          source: '/api/dashboard/config/',
          destination: 'http://127.0.0.1:8000/api/dashboard/config/',
        },
        {
          source: '/api/dashboard/config/save/',
          destination: 'http://127.0.0.1:8000/api/dashboard/config/save/',
        },
        {
          source: '/api/dashboard/config/save-role/',
          destination: 'http://127.0.0.1:8000/api/dashboard/config/save-role/',
        },
        {
          source: '/api/dashboard/config/get-role/',
          destination: 'http://127.0.0.1:8000/api/dashboard/config/get-role/',
        },
        {
          source: '/api/analytics/time-series/',
          destination: 'http://127.0.0.1:8000/api/analytics/time-series/',
        },
        {
          source: '/api/analytics/funnel/',
          destination: 'http://127.0.0.1:8000/api/analytics/funnel/',
        },
        {
          source: '/api/analytics/applications-status/',
          destination: 'http://127.0.0.1:8000/api/analytics/applications-status/',
        },
        {
          source: '/api/analytics/cost-time-series/',
          destination: 'http://127.0.0.1:8000/api/analytics/cost-time-series/',
        },
        {
          source: '/api/analytics/llm-usage/',
          destination: 'http://127.0.0.1:8000/api/analytics/llm-usage/',
        },
        {
          source: '/api/leads/',
          destination: 'http://127.0.0.1:8000/api/leads/',
        },
        {
          source: '/api/leads/create/',
          destination: 'http://127.0.0.1:8000/api/leads/create/',
        },
        {
          source: '/api/leads/:id/',
          destination: 'http://127.0.0.1:8000/api/leads/:id/',
        },
        {
          source: '/api/applicants/',
          destination: 'http://127.0.0.1:8000/api/applicants/',
        },
        {
          source: '/api/applicants/:id/',
          destination: 'http://127.0.0.1:8000/api/applicants/:id/',
        },
        {
          source: '/api/applicants/:id/:action/',
          destination: 'http://127.0.0.1:8000/api/applicants/:id/:action/',
        },
        {
          source: '/api/applications/',
          destination: 'http://127.0.0.1:8000/api/applications/',
        },
        {
          source: '/api/applications/:id/',
          destination: 'http://127.0.0.1:8000/api/applications/:id/',
        },
        {
          source: '/api/calls/',
          destination: 'http://127.0.0.1:8000/api/calls/',
        },
        {
          source: '/api/calls/:id/',
          destination: 'http://127.0.0.1:8000/api/calls/:id/',
        },
        {
          source: '/api/calls/:id/fetch_data/',
          destination: 'http://127.0.0.1:8000/api/calls/:id/fetch_data/',
        },
        {
          source: '/api/calls/:id/:action/',
          destination: 'http://127.0.0.1:8000/api/calls/:id/:action/',
        },
        {
          source: '/api/tasks/',
          destination: 'http://127.0.0.1:8000/api/tasks/',
        },
        {
          source: '/api/tasks/:id/',
          destination: 'http://127.0.0.1:8000/api/tasks/:id/',
        },
        {
          source: '/api/tasks/:id/trigger_call/',
          destination: 'http://127.0.0.1:8000/api/tasks/:id/trigger_call/',
        },
        {
          source: '/api/tasks/:id/smart_update/',
          destination: 'http://127.0.0.1:8000/api/tasks/:id/smart_update/',
        },
        {
          source: '/api/ai-calls/schedule/',
          destination: 'http://127.0.0.1:8000/api/ai-calls/schedule/',
        },
        {
          source: '/api/ai-calls/trigger/',
          destination: 'http://127.0.0.1:8000/api/ai-calls/trigger/',
        },
        {
          source: '/api/ai-calls/process-due/',
          destination: 'http://127.0.0.1:8000/api/ai-calls/process-due/',
        },
        {
          source: '/api/staff/',
          destination: 'http://127.0.0.1:8000/api/staff/',
        },
        {
          source: '/api/staff/:id/',
          destination: 'http://127.0.0.1:8000/api/staff/:id/',
        },
        {
          source: '/api/transcripts/',
          destination: 'http://127.0.0.1:8000/api/transcripts/',
        },
        {
          source: '/api/transcripts/:id/',
          destination: 'http://127.0.0.1:8000/api/transcripts/:id/',
        },
        {
          source: '/api/academic-records/',
          destination: 'http://127.0.0.1:8000/api/academic-records/',
        },
        {
          source: '/api/academic-records/:id/',
          destination: 'http://127.0.0.1:8000/api/academic-records/:id/',
        },
        {
          source: '/api/airesults/',
          destination: 'http://127.0.0.1:8000/api/airesults/',
        },
        {
          source: '/api/airesults/:id/',
          destination: 'http://127.0.0.1:8000/api/airesults/:id/',
        },
        {
          source: '/api/reports/summary/',
          destination: 'http://127.0.0.1:8000/api/reports/summary/',
        },
        {
          source: '/api/elevenlabs/callback/',
          destination: 'http://127.0.0.1:8000/api/elevenlabs/callback/',
        },
        {
          source: '/api/elevenlabs/postcall/',
          destination: 'http://127.0.0.1:8000/api/elevenlabs/postcall/',
        },
        {
          source: '/api/elevenlabs/audio/:slug*',
          destination: 'http://127.0.0.1:8000/api/elevenlabs/audio/:slug*',
        },
        {
          source: '/api/asr/callback/',
          destination: 'http://127.0.0.1:8000/api/asr/callback/',
        },
        {
          source: '/api/webhooks/:slug*',
          destination: 'http://127.0.0.1:8000/api/webhooks/:slug*',
        },
        {
          source: '/api/search/',
          destination: 'http://127.0.0.1:8000/api/search/',
        },
        {
          source: '/api/notifications/',
          destination: 'http://127.0.0.1:8000/api/notifications/',
        },
        {
          source: '/api/notifications/mark_all_read/',
          destination: 'http://127.0.0.1:8000/api/notifications/mark_all_read/',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

module.exports = nextConfig;
