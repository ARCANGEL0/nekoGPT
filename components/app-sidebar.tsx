"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { MessageSquare, Pencil, Trash2 } from "lucide-react"
import { useChatStore } from "@/hooks/use-chat-store"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Animator, FrameNefrex } from "@arwes/react"
import { ArwesActionButton } from "@/components/arwes-action-button"
import { ArwesTypedText } from "@/components/ui/arwes-typed-text"
import {
  arwesCard1,
  arwesPanel1,
} from "@/components/ui/arwes-frame-settings"

interface AppSidebarProps {
  curChatId?: string
  onChatSelect?: (chatId: string) => void
  onNewChat?: () => void
}

export function AppSidebar({ curChatId, onChatSelect, onNewChat }: AppSidebarProps) {
  const { chats, deleteChat, updateChat } = useChatStore()
  const { isMobile, setOpenMobile } = useSidebar()
  const [editId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditingTitle] = useState("")
  const [unseenChatIds, setUnseenChatIds] = useState<string[]>([])
  const [replyToast, setReplyToast] = useState<string | null>(null)
  const [isReplyToastExiting, setIsReplyToastExiting] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)
  const lastAidByChatRef = useRef<Map<string, string>>(new Map())
  const hasAidBaselineRef = useRef(false)
  const replyToastTimerRef = useRef<number | null>(null)
  const replyToastOutRef = useRef<number | null>(null)

  useEffect(() => {
    if (editId) {
      editRef.current?.focus()
      editRef.current?.select()
    }
  }, [editId])

  useEffect(() => {
    return () => {
      if (replyToastTimerRef.current) {
        window.clearTimeout(replyToastTimerRef.current)
      }
      if (replyToastOutRef.current) {
        window.clearTimeout(replyToastOutRef.current)
      }
    }
  }, [])

  const showReplyToast = useCallback((message: string) => {
    setIsReplyToastExiting(false)
    setReplyToast(message)

    if (replyToastTimerRef.current) {
      window.clearTimeout(replyToastTimerRef.current)
    }
    if (replyToastOutRef.current) {
      window.clearTimeout(replyToastOutRef.current)
    }

    replyToastTimerRef.current = window.setTimeout(() => {
      setIsReplyToastExiting(true)
      replyToastOutRef.current = window.setTimeout(() => {
        setReplyToast(null)
        setIsReplyToastExiting(false)
      }, 220)
    }, 2200)
  }, [])

  useEffect(() => {
    const nextAidByChat = new Map<string, string>()
    chats.forEach((chat) => {
      const lastAssistantMessage = [...chat.messages]
        .reverse()
        .find((message) => message.role === "assistant")
      if (lastAssistantMessage) {
        nextAidByChat.set(chat.id, lastAssistantMessage.id)
      }
    })

    if (!hasAidBaselineRef.current) {
      hasAidBaselineRef.current = true
      lastAidByChatRef.current = nextAidByChat
      return
    }

    const prevAidByChat = lastAidByChatRef.current
    const nextUnread = new Set(unseenChatIds)

    chats.forEach((chat) => {
      const prevLastAidId = prevAidByChat.get(chat.id)
      const nextLastAidId = nextAidByChat.get(chat.id)
      if (!prevLastAidId || !nextLastAidId) return
      if (prevLastAidId === nextLastAidId) return
      if (chat.id === curChatId) return
      nextUnread.add(chat.id)
      showReplyToast(`${chat.title} | New Messages!`)
    })

    const validChatIds = new Set(chats.map((chat) => chat.id))
    const filteredUnread = Array.from(nextUnread).filter((chatId) => validChatIds.has(chatId))
    if (filteredUnread.length !== unseenChatIds.length ||
      filteredUnread.some((chatId, index) => unseenChatIds[index] !== chatId)
    ) {
      setUnseenChatIds(filteredUnread)
    }

    lastAidByChatRef.current = nextAidByChat
  }, [chats, curChatId, showReplyToast, unseenChatIds])

  useEffect(() => {
    if (!curChatId) return
    setUnseenChatIds((prev) => prev.filter((chatId) => chatId !== curChatId))
  }, [curChatId])

  const closeSideM = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const pickChat = (chatId: string) => {
    setUnseenChatIds((prev) => prev.filter((id) => id !== chatId))
    onChatSelect?.(chatId)
    closeSideM()
  }

  const makeChat = () => {
    onNewChat?.()
    closeSideM()
  }

  const delChat = (event: React.MouseEvent, chatId: string) => {
    event.stopPropagation()
    deleteChat(chatId)

    if (curChatId === chatId) {
      onNewChat?.()
    }
  }

  const renameStart = (event: React.MouseEvent, chatId: string, currentTitle: string) => {
    event.stopPropagation()
    setEditingChatId(chatId)
    setEditingTitle(currentTitle)
  }

  const renameCancel = () => {
    setEditingChatId(null)
    setEditingTitle("")
  }

  const renameSave = (chatId: string, currentTitle: string) => {
    const newTitle = editTitle.trim()

    if (!newTitle || newTitle === currentTitle) {
      renameCancel()
      return
    }

    updateChat(chatId, { title: newTitle })
    renameCancel()
  }

  return (
    <Sidebar className="border-r border-cyan-500/20">
      <SidebarContent className="relative flex h-full flex-col gap-0 overflow-hidden bg-black/5 backdrop-blur-sm">
        <FrameNefrex
          {...arwesPanel1}
          className="pointer-events-none absolute inset-1 z-[1] opacity-55"
        />
        <Image
          src="/cat.gif"
          alt="NekoGPT"
          width={96}
          height={96}
          unoptimized
          className="relative z-10 mx-auto h-24 w-24 bg-transparent object-contain"
        />

        <div className="relative z-10 flex h-full flex-col content-center justify-center gap-0 justify-items-center">
          <SidebarSeparator />

          <ArwesActionButton
            onClick={makeChat}
            frame="underline"
            className="arwes-action-button-cyan-glow arwes-new-chat-button mx-3 mt-2 w-auto justify-center"
          >
            <ArwesTypedText as="span" className="font-medium tracking-[0.16em]" text="[+] NEW CHAT" trigger="new-chat" />
          </ArwesActionButton>

          <SidebarGroup className="flex min-h-0 flex-1 flex-col">
            <SidebarGroupContent className="mt-2 flex min-h-0 flex-1">
              <ScrollArea className="h-full w-full px-2 m-6">
                <Animator active duration={{ enter: 0.18, exit: 0.1, stagger: 0.015 }}>
                  <SidebarMenu className=" mb-24 flex flex-1 mt-0 mx-12 flex-col gap-1">
                  {chats.map((chat) => {
                    const isEditing = editId === chat.id
                    const hideForNew = chat.title.trim().toLowerCase() === "new chat"
                    const isActive = curChatId === chat.id
                    const hasUnseenReply = !isActive && unseenChatIds.includes(chat.id)

                    return (
                      <SidebarMenuItem key={chat.id} className="mx-6 min-w-0 sideitem">
                        <div
                          className={`group relative grid min-w-0 grid-cols-[minmax(0,3fr)_auto] items-center gap-3 ${
                            hasUnseenReply ? "arwes-session-unseen-glitch" : ""
                          }`}
                        >
                          {hasUnseenReply && <span className="arwes-session-unseen-dot" aria-hidden />}
                          <FrameNefrex
                            {...arwesCard1}
                            className={`pointer-events-none absolute inset-0 z-0 transition-opacity ${
                              hasUnseenReply
                                ? "arwes-session-unseen-frame opacity-85"
                                : isActive
                                  ? "opacity-80"
                                  : "opacity-45 group-hover:opacity-70"
                            }`}
                          />
                          <SidebarMenuButton
                            onClick={() => {
                              if (!isEditing) {
                                pickChat(chat.id)
                              }
                            }}
                            isActive={isActive}
                            className="arwes-session-item-shape relative z-10 min-w-0 w-full bg-transparent text-cyan-200/90 data-[active=true]:text-cyan-100"
                          >
                            <MessageSquare className="h-4 w-4 mt-6 ml-4" />
                            {isEditing ? (
                              <Input
                                ref={editRef}
                                value={editTitle}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                onClick={(event) => event.stopPropagation()}
                                onBlur={() => renameSave(chat.id, chat.title)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault()
                                    renameSave(chat.id, chat.title)
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault()
                                    renameCancel()
                                  }
                                }}
                                className="h-7 mt-10 border-cyan-400/70 text-xs text-cyan-100 shadow-[0_0_0_1px_rgba(0,255,255,0.35),0_0_10px_rgba(0,255,255,0.25)] focus-visible:ring-cyan-300"
                              />
                            ) : (
                              <ArwesTypedText
                                as="span"
                                className="block min-w-0 flex-1 truncate pr-1"
                                text={chat.title}
                                trigger={chat.id}
                              />
                            )}
                          </SidebarMenuButton>

                          {!hideForNew && !isEditing && (
                            <div className="relative sidebuttons flex items-center gap-1 sm:gap-2">
                              <ArwesActionButton
                                type="button"
                                frame="octagon"
                                className="arwes-octagon-button arwes-sidebar-action-octagon h-6 w-6 min-h-0 shrink-0 p-0 sm:h-8 sm:w-8"
                                onClick={(event) => renameStart(event, chat.id, chat.title)}
                                aria-label="Rename session"
                              >
                                <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </ArwesActionButton>
                              <ArwesActionButton
                                type="button"
                                frame="octagon"
                                className="arwes-octagon-button arwes-sidebar-action-octagon arwes-sidebar-action-octagon-delete h-6 w-6 min-h-0 shrink-0 p-0 sm:h-8 sm:w-8"
                                onClick={(event) => delChat(event, chat.id)}
                                aria-label="Delete session"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </ArwesActionButton>
                            </div>
                          )}
                        </div>                                                                              
                      </SidebarMenuItem>
                    )
                  })}
                  </SidebarMenu>                          
                </Animator>
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="relative z-10  mt-auto px-4 pb-4 mt-12 text-center">
            <a
              href="https://github.com/ARCANGEL0/NekoCLI"
              target="_blank"
              rel="noreferrer"
              className="block nekocli font-semibold uppercase tracking-[0.2em] text-cyan-200/80 transition-colors "
            >
              Terminal version available! Click here!
            </a>
            <a
              href="https://github.com/ARCANGEL0"
              target="_blank"
              rel="noreferrer"
              className="mt-1 block arcangelo text-[2px] leading-none tracking-[0.14em] text-cyan-900/70 transition-colors hover:text-cyan-800/70"
              style={{ fontFamily: "\"Orbitron\", \"Rajdhani\", \"Exo 2\", var(--default-mono-font-family)" }}
            >
              <span className="text-[2px] text-cyan-900/65">Made by: </span>
              <span className="text-cyan-800/85">λrcangelo</span>
            </a>
          </div>
        </div>
      </SidebarContent>
      {replyToast && (
        <div className="pointer-events-none fixed left-1/2 top-5 z-[10020] w-max max-w-[86vw] -translate-x-1/2">
          <div
            className={`cyberpunk-toast_notif cyberpunk-tooltip-content relative px-3 py-1.5 ${
              isReplyToastExiting ? "cyberpunk-toast-out" : "cyberpunk-toast-in"
            }`}
          >
            <span className="sidebar-reply-toast-text">{replyToast}</span>
          </div>
        </div>
      )}
    </Sidebar>
  )
}
