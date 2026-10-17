import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatApp } from "@/components/chat/chat-app";

export const metadata: Metadata = { title: "Chat" };

function ChatFallback() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true" aria-label="Loading chat">
      <div className="h-14 border-b border-border/60" />
      <div className="flex flex-1">
        <div className="hidden w-72 border-r border-border/60 bg-sidebar md:block" />
        <div className="flex-1" />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatApp />
    </Suspense>
  );
}
