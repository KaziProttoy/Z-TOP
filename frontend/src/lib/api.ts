import type { OriginalFile } from './types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function api<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.detail ?? "The request could not be completed.");
  return body as T;
}

export async function apiFile(path: string, token: string): Promise<OriginalFile> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "The original file could not be opened.");
  }
  return {
    url: URL.createObjectURL(await response.blob()),
    contentType: response.headers.get("Content-Type") ?? "",
  };
}

