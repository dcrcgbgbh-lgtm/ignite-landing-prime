const KEY = "ffe_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function greetingKey(date = new Date()): "morning" | "afternoon" | "evening" {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
