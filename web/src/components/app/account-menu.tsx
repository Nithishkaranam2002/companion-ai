"use client";

import { LogOut, MessageCircle, Shield, SmilePlus, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMe } from "@/hooks/use-me";
import { createClient } from "@/lib/supabase/client";

export function AccountMenu() {
  const { me } = useMe();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const label = me?.is_anonymous ? "Demo session" : (me?.email ?? "Your account");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserRound className="size-4" aria-hidden="true" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/chat"><MessageCircle className="size-4" /> Chat</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/mood"><SmilePlus className="size-4" /> Mood tracker</Link>
        </DropdownMenuItem>
        {me?.is_admin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin"><Shield className="size-4" /> Admin</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {me?.is_anonymous ? (
          <DropdownMenuItem asChild>
            <Link href="/login"><UserRound className="size-4" /> Create a free account</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="size-4" /> {me?.is_anonymous ? "End demo" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
