import { LiveConsole } from "@/components/live/LiveConsole";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Console" };

export default function Page() {
  return <LiveConsole />;
}
