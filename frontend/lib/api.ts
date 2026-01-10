type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface APIError extends Error {
  status?: number;
  body?: any;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));
  return cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
}

function buildUrl(path: string): string {
  // If path is a full URL, return it unchanged
  if (/^https?:\/\//i.test(path)) return path;

  // Get base URL with fallback to production API
  const base = (process.env.NEXT_PUBLIC_API_URL || "https://api.cybriksolutions.com").replace(/\s/g, "");

  let finalUrl = "";
  // Ensure path always begins with a slash
  if (base && base.endsWith("/") && path.startsWith("/")) {
    finalUrl = base.slice(0, -1) + (path.endsWith("/") ? path : path + "/");
  } else if (base) {
    finalUrl = base + (path.startsWith("/") ? path : `/${path}`) + (path.endsWith("/") ? "" : "/");
  } else {
    const [pathname, search] = path.startsWith("/") ? path.split('?') : `/${path}`.split('?');
    const cleanPath = pathname.endsWith("/") ? pathname : pathname + "/";
    finalUrl = cleanPath + (search ? `?${search}` : "");
  }

  return finalUrl;
}

async function parseResponse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    // Not JSON
    return text;
  }
}

/**
 * Generic API fetch wrapper
 * - path: string (relative or absolute)
 * - options: Fetch API options (method, headers, body, etc.)
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = buildUrl(path);

  // default headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers ? (options.headers as Record<string, string>) : {}),
  };

  // If non-GET, try to set X-CSRFToken from csrftoken cookie (if present)
  const method = (options.method || "GET").toUpperCase() as HTTPMethod;
  if (method !== "GET") {
    const csrftoken = getCookie("csrftoken");
    if (csrftoken && !("X-CSRFToken" in headers) && !("x-csrftoken" in headers)) {
      headers["X-CSRFToken"] = csrftoken;
    }
  }

  const fetchOptions: RequestInit = {
    credentials: "include", // important: send cookies
    mode: "cors",
    ...options,
    headers,
  };

  const res = await fetch(url, fetchOptions);

  // Handle 401 Unauthorized or 403 Forbidden (Token Expiry/Missing)
  if (res.status === 401 || res.status === 403) {
    // Prevent infinite loops if the refresh endpoint itself returns error
    if (!path.includes('/auth/refresh') && !path.includes('/auth/login')) {
      try {
        console.log("[API] Authentication error, attempting token refresh...");
        // Attempt to refresh the token
        const refreshRes = await fetch(buildUrl('/api/auth/refresh/'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Send refresh cookie
        });

        if (refreshRes.ok) {
          console.log("[API] Token refresh successful, retrying original request...");
          // Retry the original request
          const retryRes = await fetch(url, fetchOptions);
          return await parseResponse(retryRes);
        } else {
          console.warn("[API] Token refresh failed. Redirecting to login...");
          // Redirect to login page (login is at /crm/login/)
          // Don't redirect from public pages: landing page (/), login pages, lead-capture
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const publicPages = ['/', '/login', '/crm/login', '/lead-capture'];
          const isPublicPage = publicPages.some(page =>
            currentPath === page || currentPath.startsWith('/lead-capture/') || currentPath.includes('/login')
          );

          if (typeof window !== 'undefined' && !isPublicPage) {
            window.location.href = '/crm/login';
          }
        }
      } catch (refreshErr) {
        console.error("[API] Error during token refresh:", refreshErr);
      }
    }
  }

  const parsed = await parseResponse(res);

  if (!res.ok) {
    const err = new Error(
      (parsed && (parsed.detail || parsed.error || JSON.stringify(parsed))) ||
      res.statusText ||
      `Request failed with status ${res.status}`
    ) as APIError;
    err.status = res.status;
    err.body = parsed;
    throw err;
  }

  return parsed;
}

// Convenience helpers
// Convenience helpers
export async function get(path: string, options: RequestInit = {}) {
  return apiFetch(path, { ...options, method: "GET" });
}
export async function post(path: string, body: any, options: RequestInit = {}) {
  const bodyPayload =
    body && typeof body === "object" && !(body instanceof FormData)
      ? JSON.stringify(body)
      : body;
  // allow FormData posting by passing FormData as body
  const headers: any = body instanceof FormData ? { "Content-Type": undefined } : {};
  return apiFetch(path, { ...options, method: "POST", body: bodyPayload, headers });
}
export async function put(path: string, body: any, options: RequestInit = {}) {
  const bodyPayload =
    body && typeof body === "object" && !(body instanceof FormData)
      ? JSON.stringify(body)
      : body;
  const headers: any = body instanceof FormData ? { "Content-Type": undefined } : {};
  return apiFetch(path, { ...options, method: "PUT", body: bodyPayload, headers });
}
export async function del(path: string, options: RequestInit = {}) {
  return apiFetch(path, { ...options, method: "DELETE" });
}

export default apiFetch;
