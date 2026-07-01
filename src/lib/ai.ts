import { supabase } from "@/integrations/supabase/client";

export async function callAI(kind: "recommendations" | "project_detail" | "admin_insights", payload: any) {
  const { data, error } = await supabase.functions.invoke("ai", { body: { kind, payload } });
  if (error) throw error;
  return data as { result: any; aiUsed: boolean; model: string; generatedAt: string };
}
