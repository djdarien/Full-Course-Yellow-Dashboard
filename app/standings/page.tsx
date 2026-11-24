import { StandingsPage } from "@/components/StandingsPage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Standings" };

export default function Page() {
  return <StandingsPage />;
}
