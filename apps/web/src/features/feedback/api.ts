import { env } from "../../env";
export class FeedbackApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export async function feedbackRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.VITE_API_URL}/api${path}`, { credentials: "include", ...init });
  } catch {
    throw new FeedbackApiError(
      0,
      "The form service couldn’t be reached. Check your connection and try again.",
    );
  }
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new FeedbackApiError(
      response.ok ? 502 : response.status,
      "The form service is unavailable. Please try again later.",
    );
  }
  const error = data as { error?: unknown; fields?: Record<string, string> };
  if (!response.ok)
    throw new FeedbackApiError(
      response.status,
      typeof error.error === "string" ? error.error : "Please try again.",
      error.fields,
    );
  return data as T;
}
export const jsonPost = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
