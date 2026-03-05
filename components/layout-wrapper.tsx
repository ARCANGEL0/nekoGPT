"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { useChatStore } from "@/hooks/use-chat-store"
import { Animator, FrameLines, FrameHeader } from "@arwes/react"
import { ArwesActionButton } from "@/components/arwes-action-button"
import { ImagePlus, PenLine, Waves, WavesLadder } from "lucide-react"
import { useArwesUi } from "@/components/arwes-ui-provider"
import { ArwesTypedText } from "@/components/ui/arwes-typed-text"

interface LayoutWrapperProps {
  children: React.ReactNode
}

export type ChatMode = "chat" | "image"

interface ChatSessCtx {
  curChatId?: string
  setCurChatId: (chatId: string) => void
  chatMode: ChatMode
  setChatMode: (mode: ChatMode) => void
}

const chatCookieKey = "current_chat_id"
const chatCookieAge = 60 * 60 * 24 * 365

const SessCtx = createContext<ChatSessCtx | null>(null)

export function useChatSess() {
  const context = useContext(SessCtx)
  if (!context) {
    throw new Error("useChatSess must be used within LayoutWrapper.")
  }
  return context
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const { getOrNew } = useChatStore()
  const { animOn, toggleAnim } = useArwesUi()
  const [curChatId, setCurChatId] = useState<string | undefined>()
  const [chatMode, setChatMode] = useState<ChatMode>("chat")

  const newChat = useCallback(() => {
    const newChat = getOrNew()
    setCurChatId(newChat.id)
  }, [getOrNew])

  const readCookie = useCallback((name: string): string | null => {
    if (typeof document === "undefined") return null
    const target = `${name}=`
    const cookies = document.cookie.split(";")
    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim()
      if (cookie.startsWith(target)) {
        return decodeURIComponent(cookie.substring(target.length))
      }
    }
    return null
  }, [])

  useEffect(() => {
    const storedChatId =
      localStorage.getItem("currentChatId") ??
      localStorage.getItem("curChatId") ??
      readCookie(chatCookieKey)

    if (storedChatId) {
      setCurChatId(storedChatId)
      localStorage.setItem("currentChatId", storedChatId)
      localStorage.setItem("curChatId", storedChatId)
      return
    }

    const newChat = getOrNew()
    setCurChatId(newChat.id)
  }, [getOrNew, readCookie])

  useEffect(() => {
    if (!curChatId) return

    localStorage.setItem("currentChatId", curChatId)
    localStorage.setItem("curChatId", curChatId)
    document.cookie = `${chatCookieKey}=${encodeURIComponent(curChatId)}; path=/; max-age=${chatCookieAge}; samesite=lax`
  }, [curChatId])

  useEffect(() => {
    const onNewChatEvt = () => {
      newChat()
    }

    window.addEventListener("newChat", onNewChatEvt)
    return () => window.removeEventListener("newChat", onNewChatEvt)
  }, [newChat])

  const pickChat = (chatId: string) => {
    setCurChatId(chatId)
  }

  const sessVal = useMemo(
    () => ({
      curChatId,
      setCurChatId: pickChat,
      chatMode,
      setChatMode,
    }),
    [chatMode, curChatId]
  )

  return (
    <SidebarProvider>
      <SessCtx.Provider value={sessVal}>
        <Animator duration={{ enter: 0.28, exit: 0.12 }}>
          <div className="flex h-dvh w-full overflow-hidden">
            <AppSidebar
              curChatId={curChatId}
              onChatSelect={pickChat}
              onNewChat={newChat}
            />

            <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
              <header className="relative z-10 h-14 shrink-0 border-b border-cyan-500/20 bg-transparent">
                <Animator active duration={{ enter: 0.3, exit: 0.2, stagger: 0.02 }}>
                  <div className="relative flex h-full w-full items-center px-3 sm:px-4">
                    <FrameHeader
                      className="pointer-events-none absolute inset-0 z-0 text-cyan-300/30"
                      padding={1}
                      contentLength={460}
                      decoWidth={5}
                    />
                    <div className="relative z-10 flex min-w-0 flex-1 items-center">
                      <div className="flex flex-1 items-center gap-3 ">
                      <SidebarTrigger className="text-cyan-400 hover:text-cyan-300 mr-0" />
                        <ArwesActionButton
                          id="arwes-animation-toggle"
                          frame="octagon"
                          aria-label={animOn ? "Disable animations" : "Enable animations"}
                          title={animOn ? "Disable animations" : "Enable animations"}
                          onClick={toggleAnim}
                          className={`arwes-octagon-button ml-2 h-8 w-8 min-h-0 p-0 sm:ml-6 ${
                            animOn
                              ? "arwes-chat-action-octagon-send"
                              : "arwes-chat-action-octagon-stop"
                          }`}
                        >
                          {animOn ? (
                            <Waves className="h-4 w-4" />
                          ) : (
                            <WavesLadder className="h-4 w-4" />
                          )}
                        </ArwesActionButton>
                      <ArwesTypedText
                        as="h1"
                        className="ml-3 truncate text-base font-semibold uppercase tracking-[0.2em] text-cyan-200 sm:ml-4 sm:text-lg"
                        text="N e k o G P T"
                        trigger="layout-title"
                      />
                      <div className="ml-auto flex items-center gap-1 sm:ml-4 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => setChatMode("chat")}
                          aria-label="Chat mode"
                          title="Chat mode"
                          className={`arwes-mode-toggle relative flex h-8 w-8 shrink-0 items-center justify-center px-0 sm:h-9 sm:w-10 ${
                            chatMode === "chat" ? "arwes-mode-toggle-active" : "arwes-mode-toggle-inactive"
                          }`}
                        >
                          <FrameLines
                            className="arwes-mode-toggle-frame pointer-events-none absolute inset-0"
                            padding={1}
                          />
                          <PenLine className="relative z-10 h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setChatMode("image")}
                          aria-label="Image mode"
                          title="Image mode"
                          className={`arwes-mode-toggle relative flex h-8 w-8 shrink-0 items-center justify-center px-0 transition-colors sm:h-9 sm:w-10 ${
                            chatMode === "image" ? "arwes-mode-toggle-active" : "arwes-mode-toggle-inactive"
                          }`}
                        >
                          <FrameLines
                            className="arwes-mode-toggle-frame pointer-events-none absolute inset-0"
                            padding={1}
                          />
                          <ImagePlus className="relative z-10 h-4 w-4" />
                        </button>
                      </div>
                     
                    </div>
                  </div>
                          </div>
                </Animator>
              </header>
              <section className="relative z-[2] flex-1 min-h-0 overflow-hidden">{children}</section>
            </main>
          </div>
        </Animator>
      </SessCtx.Provider>
    </SidebarProvider>
  )
}
