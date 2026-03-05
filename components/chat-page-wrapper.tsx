"use client"

import { ChatInterface } from "@/components/chat-interface"
import { useChatSess } from "@/components/layout-wrapper"

export function ChatPageWrapper() {
  const { curChatId, chatMode } = useChatSess()

  return (
      <div className="relative h-full w-full min-h-0 overflow-hidden">
        
          <div className="relative z-[2] h-full w-full">
            <ChatInterface chatId={curChatId} chatMode={chatMode} />
          </div>
      </div>
  )
}
