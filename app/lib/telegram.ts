export async function sendTelegramNotification(payload: {
  text?: string;
  title?: string;
  phone?: string;
  items?: { name: string; qty: number; price: number }[];
  total?: number;
}): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error ?? "Ошибка отправки" };
  }
  return { success: true };
}
