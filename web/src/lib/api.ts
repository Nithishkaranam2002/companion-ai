import { createClient } from "@/lib/supabase/client";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason?: string,
  ) {
    super(message);
  }
}

async function accessToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

async function headers(auth: boolean): Promise<HeadersInit> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await accessToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }
  return h;
}

async function toError(res: Response): Promise<ApiError> {
  let message = res.status >= 500 ? "The service is having trouble. Please try again shortly." : "Request failed.";
  let reason: string | undefined;
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === "string") message = detail;
    else if (detail?.message) {
      message = detail.message;
      reason = detail.reason;
    } else if (Array.isArray(detail)) message = "Please check the form and try again.";
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(message, res.status, reason);
}

export async function apiFetch<T = unknown>(
  path: string,
  { auth = true, ...init }: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...(await headers(auth)), ...init.headers } });
  } catch {
    throw new ApiError("Can't reach CompanionAI right now. Check your connection and try again.", 0);
  }
  if (!res.ok) throw await toError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export type Source = { title: string; url: string; snippet?: string };

export type StreamEvent =
  | { event: "meta"; data: { route: "answer" | "refuse" | "escalate"; label: string; conversation_id: string | null } }
  | { event: "token"; data: { text: string } }
  | { event: "sources"; data: { sources: Source[] } }
  | { event: "replace"; data: { text: string } }
  | { event: "done"; data: { message_id?: string; escalated: boolean; remaining: number } }
  | { event: "error"; data: { message: string } };

/** POST a chat message and yield server-sent events as they arrive. */
export async function* streamChat(
  body: { message: string; conversation_id?: string | null },
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: await headers(true),
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    throw new ApiError("Can't reach CompanionAI right now. Check your connection and try again.", 0);
  }
  if (!res.ok || !res.body) throw await toError(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let split: number;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (event && data) yield { event, data: JSON.parse(data) } as StreamEvent;
    }
  }
}
