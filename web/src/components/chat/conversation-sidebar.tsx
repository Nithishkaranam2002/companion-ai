"use client";

import { MessageSquare, MessageSquarePlus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type Conversation = { id: string; title: string; updated_at: string };

function relative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ConversationSidebar({
  conversations,
  loading,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: Conversation[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button onClick={onNew} className="w-full justify-start" variant="outline">
          <MessageSquarePlus className="size-4" /> New chat
        </Button>
      </div>
      <p className="px-4 pb-2 text-xs font-medium text-muted-foreground">Recent conversations</p>
      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <nav aria-label="Conversations" className="space-y-0.5 px-2 pb-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mx-1 my-1.5 h-11 rounded-lg" />)
          ) : conversations.length === 0 ? (
            <div className="mx-2 mt-2 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 size-5 opacity-60" aria-hidden="true" />
              Your conversations will appear here.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center rounded-lg transition-colors hover:bg-muted",
                  activeId === c.id && "bg-muted",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-current={activeId === c.id ? "true" : undefined}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left"
                >
                  <span className="block truncate text-sm">{c.title || "New conversation"}</span>
                  <span className="block text-xs text-muted-foreground">{relative(c.updated_at)}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-1 size-8 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  aria-label={`Delete conversation: ${c.title}`}
                  onClick={() => setPendingDelete(c)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </nav>
      </ScrollArea>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.title}&rdquo; and all its messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (pendingDelete) await onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
