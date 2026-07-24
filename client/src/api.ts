import { ChatResult, Conversation } from './types';

export class ReauthError extends Error {}

async function request<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.code === 'REAUTH_REQUIRED') {
    throw new ReauthError(data.error ?? 'Please sign in again.');
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data as T;
}

export async function fetchMe(): Promise<{ email: string } | null> {
  const res = await fetch('/api/me', { credentials: 'same-origin' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to load session.');
  return res.json();
}

export function fetchConversations(): Promise<{
  conversations: Conversation[];
  activeConversationId?: string;
}> {
  return request('/api/conversations', 'GET');
}

export function ingest(link: string, summarize: boolean): Promise<{ conversation: Conversation }> {
  return request('/api/ingest', 'POST', { link, summarize });
}

export function selectConversation(id: string): Promise<{ conversation: Conversation }> {
  return request('/api/conversations/select', 'POST', { id });
}

export function reloadConversation(id: string): Promise<{ conversation: Conversation }> {
  return request('/api/conversations/reload', 'POST', { id });
}

export function loadFile(fileId: string): Promise<{ conversation: Conversation }> {
  return request('/api/conversations/load-file', 'POST', { fileId });
}

export function renameConversation(id: string, title: string): Promise<{ conversation: Conversation }> {
  return request('/api/conversations/rename', 'POST', { id, title });
}

export function deleteConversation(
  id: string,
): Promise<{ conversations: Conversation[]; activeConversationId?: string }> {
  return request('/api/conversations/delete', 'POST', { id });
}

export function getSuggestions(): Promise<{ suggestions: string[] }> {
  return request('/api/conversations/suggestions', 'POST', {});
}

export function loadAll(): Promise<{ conversation: Conversation }> {
  return request('/api/conversations/load-all', 'POST', {});
}

export function pinConversation(id: string, pinned: boolean): Promise<{ conversation: Conversation }> {
  return request('/api/conversations/pin', 'POST', { id, pinned });
}

export function chat(question: string): Promise<ChatResult> {
  return request('/api/chat', 'POST', { question });
}

export async function logout(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
}
