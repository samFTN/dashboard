// Notification push à Samuel via Pushover.
export async function pushover(
  message: string,
  opts: { title?: string; url?: string; urlTitle?: string } = {},
): Promise<void> {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;

  if (!token || !user) {
    console.log(`[pushover:dev] ${opts.title ? opts.title + " — " : ""}${message}`);
    return;
  }

  try {
    await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token,
        user,
        message,
        ...(opts.title ? { title: opts.title } : {}),
        ...(opts.url ? { url: opts.url } : {}),
        ...(opts.urlTitle ? { url_title: opts.urlTitle } : {}),
      }),
    });
  } catch (e) {
    console.error("[pushover] échec :", e);
  }
}
