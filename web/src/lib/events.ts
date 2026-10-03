import type { ServerEvent } from "../types.ts";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface EventStreamOptions {
  onEvent: (event: ServerEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

/**
 * Connects to the backend Server-Sent Events (SSE) stream for a session.
 * Streams real-time lifecycle transitions using the discriminated-union ServerEvent protocol.
 * Returns an unsubscribe/disconnect function.
 */
export function connectToEventStream(
  sessionId: string,
  options: EventStreamOptions
): () => void {
  const url = `${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/events`;
  const eventSource = new EventSource(url);

  eventSource.onopen = () => {
    options.onOpen?.();
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as ServerEvent;
      options.onEvent(data);
    } catch (err) {
      console.warn("Received malformed SSE event payload:", event.data, err);
    }
  };

  eventSource.onerror = (err) => {
    options.onError?.(err);
  };

  return () => {
    eventSource.close();
  };
}

export const subscribeToSessionEvents = connectToEventStream;
