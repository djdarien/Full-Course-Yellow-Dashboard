import { ArchivePage } from "@/components/ArchivePage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Archive" };

export default function Page() {
  return <ArchivePage />;
}
