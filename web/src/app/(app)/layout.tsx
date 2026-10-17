import { MeProvider } from "@/hooks/use-me";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <MeProvider>{children}</MeProvider>;
}
