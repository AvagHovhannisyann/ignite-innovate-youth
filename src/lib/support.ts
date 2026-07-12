import { supabase } from "@/integrations/supabase/client";

export type SupportThread = {
  id: string;
  user_id: string;
  subject: string;
  status: "open" | "answered" | "closed";
  last_message_at: string;
  created_at: string;
  user?: { full_name: string | null; email: string | null } | null;
  unread?: boolean;
};

export type SupportMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: "user" | "admin";
  content: string;
  created_at: string;
};

export async function isAdmin(userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) return false;
  return !!data;
}

export async function fetchMyThreads(): Promise<SupportThread[]> {
  const { data, error } = await supabase
    .from("support_threads")
    .select("*")
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  return (data || []) as SupportThread[];
}

export async function fetchAllThreads(): Promise<SupportThread[]> {
  const { data, error } = await supabase
    .from("support_threads")
    .select("*")
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  const rows = (data || []) as SupportThread[];
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  if (!ids.length) return rows;
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  const m = new Map((profs || []).map((profile) => [profile.id, profile]));
  return rows.map((r) => ({ ...r, user: m.get(r.user_id) || null }));
}

export async function createThread(userId: string, subject: string, firstMessage: string) {
  if (!userId) throw new Error("Մուտք գործիր՝ հարցում ուղարկելու համար։");
  const { data: thread, error } = await supabase.rpc("create_support_thread", {
    _subject: subject.trim() || "Աջակցության հարցում",
    _first_message: firstMessage.trim(),
  });
  if (error) throw error;
  return thread as SupportThread;
}

export async function fetchMessages(threadId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as SupportMessage[];
}

export async function sendMessage(threadId: string, content: string) {
  const { error } = await supabase.rpc("send_support_message", {
    _thread_id: threadId,
    _content: content.trim(),
  });
  if (error) throw error;
}

export async function setThreadStatus(threadId: string, status: SupportThread["status"]) {
  const { error } = await supabase.rpc("set_support_thread_status", {
    _thread_id: threadId,
    _status: status,
  });
  if (error) throw error;
}
