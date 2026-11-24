import { getHub } from "@/lib/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hub = getHub();
  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe = () => {};
  let ping: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
          unsubscribe();
          if (ping) clearInterval(ping);
        }
      };

      send("bootstrap", hub.getBootstrap());
      unsubscribe = hub.subscribe((event) => {
        if (event.type === "snapshot") send("snapshot", { t: event.t, snapshot: event.snapshot });
        else if (event.type === "rc") send("rc", event.message);
        else send("radio", event.radio);
      });
      ping = setInterval(() => send("ping", {}), 15000);
    },
    cancel() {
      closed = true;
      unsubscribe();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
