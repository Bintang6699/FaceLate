const API_BASE_URL = "http://localhost:8000/api";

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

export async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { requireAuth = true, headers: customHeaders, ...restOptions } = options;
  
  const headers = new Headers(customHeaders);
  
  // Default to application/json if not provided and it's not a FormData request
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Handle Authentication
  if (requireAuth) {
    // Note: Next.js server components can't access localStorage directly, 
    // but this api function is designed mostly for client components.
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...restOptions,
      headers,
    });

    // Handle 204 No Content (e.g. successful DELETE)
    if (response.status === 204) {
      return null as T;
    }

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      // Throw formatted error
      const message = typeof data === "object" ? (data?.detail || data?.message) : data;
      throw new Error(message || "An error occurred");
    }

    return data as T;
  } catch (error: unknown) {
    console.error(`[API Error] ${endpoint}:`, error);
    throw error;
  }
}
