"use client"

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, Copy, Download, Paperclip, Pencil, RotateCcw, Send, Square, Trash2, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChatMode } from "@/components/layout-wrapper"
import { useChatStore } from "@/hooks/use-chat-store"
import { Message } from "@/lib/chat-store"
import { ArwesActionButton } from "@/components/arwes-action-button"
import { FrameCorners, FrameLines, FrameNefrex, FrameUnderline, useBleeps } from "@arwes/react"
import { ArwesTypedText } from "@/components/ui/arwes-typed-text"
import { SlowDecipherText } from "@/components/ui/slow-decipher-text"
import { AssistantMarkdown } from "@/components/ui/assistant-markdown"
import {
  arwesUnder1,
  arwesPanel1,
} from "@/components/ui/arwes-frame-settings"
interface ChatInterfaceProps {
  chatId?: string
  chatMode?: ChatMode
}
const API_BASE_URL = "https://api.arcangelo.net"
const LOADING_LABEL = "L o a d i n g . . ."
const API_ENDPOINTS = {
  neko: "/neko",
  imagine: "/imagine",
  multiedit: "/multiEdit",
  vision: "/neko_vision"
} as const
const DEBUG_REQUEST_LOGS = process.env.NODE_ENV !== "production"
const PENDING_IMAGE_TASKS_KEY = "pending_image_tasks_v1"
const IMAGE_TASK_POLL_MS = {
  imagine: 6000,
  multiEdit: 7000,
} as const

const errByKind: Record<"api" | "img" | "vis", string[]> = {
  api: [
    "[❌] ERROR\n> Sorry bud, an error ocurred trying to fetch my API. Try again, will ya?",
    "[❌] ERROR\n> Error tryin' to fetch on my API. Give it one more shot, buddy.",
    "[❌] ERROR\n> Could not reach my API right now. Retry again, bro",
    "[❌] ERROR\n> Request crashed on the API side. Run it again.",
    "[❌] ERROR\n> My backend is unresponsive, m8. Try again.",
    "[❌] ERROR\n> Error from my side, it seems... Tap send again, yeah?",
    "[❌] ERROR\n> Failed to fetch from API this round. Retry please.",
    "[❌] ERROR\n> API timeout. Another try should do it.",
    "[❌] ERROR\n> No clean response from API. Try again, chief.",
  ],
  img: [
    "[❌] ERROR\n> Image request failed on the server. Try again, will ya?",
    "[❌] ERROR\n> Could not finish your image task. Give me another shot.",
    "[❌] ERROR\n> Didn't got any image. Try regenerating again.",
    "[❌] ERROR\n> No valid image result came back. Please retry.",
    "[❌] ERROR\n> Image worker failed. Try again, bro.",
    "[❌] ERROR\n> Render failed this time. Try sending again.",
    "[❌] ERROR\n> Could not fetch image output. Retry please.",
    "[❌] ERROR\n> Image API returned a bad response. Try again.",
    "[❌] ERROR\n> Generation stalled on server side. Please try again.",
    "[❌] ERROR\n> Didn't got anythin' from my backend. Try again, bro.",
  ],
  vis: [
    "[❌] ERROR\n> Vision call failed on server side. Try again.",
    "[❌] ERROR\n> Could not fetch vision output this time. Retry please.",
    "[❌] ERROR\n> Might be blind, but my backend failed to view the image. Give it another go.",
    "[❌] ERROR\n> Image analysis failed right now. Try again, bud.",
    "[❌] ERROR\n> Vision API hit a snag. Retry again.",
    "[❌] ERROR\n> No valid vision response received. Try again.",
    "[❌] ERROR\n> The vision task crashed upstream. Please retry.",
    "[❌] ERROR\n> Vision worker timed out. Another try should work.",
    "[❌] ERROR\n> Could not parse vision result. Try sendin' me again.",
    "[❌] ERROR\n> Vision fetch failed this round. Try again.",
  ],
}

type NekoMsg = {
  role: "user" | "assistant"
  content: string
}

type ImageTaskKind = keyof typeof IMAGE_TASK_POLL_MS

interface PendingImageTask {
  key: string
  kind: ImageTaskKind
  taskId: string
  chatId: string
  loadingMessageId: string
  createdAt: number
}

type ImageTaskInit =
  | { status: "done"; content: string }
  | { status: "pending"; kind: ImageTaskKind; taskId: string }

const IMG_URL_RX = /(https?:\/\/\S+?\.(?:png|jpe?g|gif|webp)(?:\?\S*)?)/gi
const OK_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
])

const aidBubbleStyle = {
  "--arwes-frames-bg-color": "rgba(2, 21, 40, 0.82)",
} as CSSProperties

const errBubbleStyle = {
  "--arwes-frames-bg-color": "rgba(48, 7, 7, 0.86)",
  "--arwes-frames-line-color": "rgba(255, 124, 124, 0.96)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 11px rgba(255, 82, 82, 0.24))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 14px rgba(255, 98, 98, 0.45))",
} as CSSProperties

const aidActionStyle = {
  "--arwes-frames-bg-color": "hsl(180 75% 10% / 0.58)",
  "--arwes-frames-line-color": "hsl(188 80% 40% / 0.84)",
  "--arwes-frames-deco-color": "hsl(184 100% 64% / 0.95)",
} as CSSProperties

const toastFrameStyle = {
  "--arwes-frames-bg-color": "transparent",
  "--arwes-frames-line-color": "rgba(109, 248, 255, 0.95)",
  "--arwes-frames-deco-color": "rgba(190, 255, 255, 0.98)",
  "--arwes-frames-bg-filter": "none",
  "--arwes-frames-line-filter": "drop-shadow(0 0 10px rgba(0, 239, 255, 0.36))",
} as CSSProperties

const usrBubbleStyle = {
  "--arwes-frames-bg-color": "rgba(8, 75, 95, 0.42)",
  "--arwes-frames-line-color": "rgba(133, 251, 255, 0.88)",
  "--arwes-frames-bg-filter": "drop-shadow(0 0 8px rgba(28, 236, 255, 0.15))",
  "--arwes-frames-line-filter": "drop-shadow(0 0 10px rgba(100, 246, 255, 0.26))",
} as CSSProperties

const getImgUrls = (content: string): string[] => {
  const matches = content.match(IMG_URL_RX) ?? []
  return [...new Set(matches.map((url) => url.trim()))]
}

const cleanImgUrls = (content: string): string => {
  return content
    .replace(IMG_URL_RX, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const okImgFile = (file: File): boolean => {
  if (OK_IMAGE_MIME_TYPES.has(file.type)) {
    return true
  }

  return /\.(png|jpe?g|gif|webp)$/i.test(file.name)
}

export function ChatInterface({ chatId, chatMode = "chat" }: ChatInterfaceProps) {
  const { chats, addMessage, getChat, updateChat } = useChatStore()
  const bleeps = useBleeps<"notify" | "assemble" | "content">()
  const [hasInput, setHasInput] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [isRequestInFlight, setIsRequestInFlight] = useState(false)
  const [isLoadingVisible, setIsLoadingVisible] = useState(false)
  const [loadingAnimationTick, setLoadingAnimationTick] = useState(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isToastExiting, setIsToastExiting] = useState(false)
  const [isPromptHighlighted, setIsPromptHighlighted] = useState(false)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const maxFiles = chatMode === "image" ? 4 : 1

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const inputValueRef = useRef("")
  const viewRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const tokenRef = useRef(0)
  const toastTimerRef = useRef<number | null>(null)
  const toastOutRef = useRef<number | null>(null)
  const promptHighlightTimerRef = useRef<number | null>(null)
  const prevAidIdRef = useRef<string | undefined>(undefined)
  const loadAidRef = useRef<{ chatId: string; messageId: string } | null>(null)
  const reqKindRef = useRef<"image" | "other" | null>(null)
  const pendingImageTasksRef = useRef<Map<string, PendingImageTask>>(new Map())
  const pendingTaskPollTimersRef = useRef<Map<string, number>>(new Map())
  const pendingTaskInFlightRef = useRef<Set<string>>(new Set())
  const errLastRef = useRef<Record<"api" | "img" | "vis", number>>({
    api: -1,
    img: -1,
    vis: -1,
  })

  const messages = useMemo(
    () => (chatId ? chats.find((chat) => chat.id === chatId)?.messages ?? [] : []),
    [chatId, chats]
  )
  const lastAidMsg = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  )
  const hasLoadingMessages = useMemo(
    () =>
      messages.some(
        (message) =>
          message.role === "assistant" &&
          (message.responseState === "loading" || message.id.startsWith("assistant-loading-"))
      ),
    [messages]
  )
  const lastAidId = lastAidMsg?.id
  const { galleryImages, imgKeyMap } = useMemo(() => {
    const nextGalleryImages: string[] = []
    const nextImgKeyMap = new Map<string, number>()
    messages.forEach((message) => {
      const inlineImgs = getImgUrls(message.content)
      inlineImgs.forEach((imageUrl, index) => {
        const key = `${message.id}-inline-image-${index}`
        nextImgKeyMap.set(key, nextGalleryImages.length)
        nextGalleryImages.push(imageUrl)
      })
    })
    return { galleryImages: nextGalleryImages, imgKeyMap: nextImgKeyMap }
  }, [messages])
  const curImg = galleryImages[activeGalleryIndex] ?? null

  const addAidMsg = useCallback((
    targetChatId: string,
    content: string,
    responseState: Message["responseState"] = "ok"
  ) => {
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      content,
      role: "assistant",
      timestamp: new Date(),
      responseState,
    }
    addMessage(targetChatId, assistantMessage)
  }, [addMessage])

  const setLoadAid = (chatId: string, messageId: string | null) => {
    loadAidRef.current = messageId ? { chatId, messageId } : null
  }

  const addLoadAidMsg = (targetChatId: string, reqTok: number): string => {
    const loadMsgId = `assistant-loading-${reqTok}-${Date.now()}`
    const loadingMessage: Message = {
      id: loadMsgId,
      content: LOADING_LABEL,
      role: "assistant",
      timestamp: new Date(),
      responseState: "loading",
    }
    addMessage(targetChatId, loadingMessage)
    setLoadAid(targetChatId, loadMsgId)
    return loadMsgId
  }

  const repLoadAidMsg = useCallback((
    targetChatId: string,
    loadMsgId: string,
    content: string,
    responseState: "ok" | "error" = "ok"
  ) => {
    const chat = getChat(targetChatId)
    if (!chat) return

    const loadingIndex = chat.messages.findIndex((message) => message.id === loadMsgId)
    if (loadingIndex < 0) {
      addAidMsg(targetChatId, content, responseState)
      if (responseState === "error") {
        bleeps.content?.play("assistant-content")
      }
      return
    }

    const nextMessages = [...chat.messages]
    nextMessages[loadingIndex] = {
      id: `assistant-${Date.now()}`,
      content,
      role: "assistant",
      timestamp: new Date(),
      responseState,
    }
    updateChat(targetChatId, { messages: nextMessages })
    if (responseState === "error") {
      bleeps.content?.play("assistant-content")
    }
  }, [addAidMsg, bleeps.content, getChat, updateChat])

  const rmLoadAidMsg = useCallback((targetChatId: string, loadMsgId: string) => {
    const chat = getChat(targetChatId)
    if (!chat) return

    const nextMessages = chat.messages.filter((message) => message.id !== loadMsgId)
    if (nextMessages.length === chat.messages.length) return

    updateChat(targetChatId, { messages: nextMessages })
  }, [getChat, updateChat])

  const reqCtx = (
    targetChatId: string
  ): { chatName: string } => {
    const targetChat = getChat(targetChatId)
    return {
      chatName: targetChat?.title || "New Chat",
    }
  }

  const nekoMsgs = (targetChatId: string, fallbackPrompt: string): NekoMsg[] => {
    const targetChat = getChat(targetChatId)
    const messagesPayload = (targetChat?.messages ?? [])
      .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim().length > 0)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }))

    if (messagesPayload.length > 0) {
      return messagesPayload
    }

    return [{ role: "user", content: fallbackPrompt }]
  }

  const chatSnap = (targetChatId?: string) => {
    const indexedChats = chats.map((chat, index) => ({
      index,
      id: chat.id,
      title: chat.title,
      messageCount: chat.messages.length,
    }))
    const currentChatIndex = targetChatId ? indexedChats.findIndex((chat) => chat.id === targetChatId) : -1
    if (currentChatIndex < 0) {
      return {
        currentChatIndex,
        chatsWithCurrentFirst: indexedChats,
      }
    }

    return {
      currentChatIndex,
      chatsWithCurrentFirst: [
        indexedChats[currentChatIndex],
        ...indexedChats.filter((chat) => chat.id !== targetChatId),
      ],
    }
  }

  const logPayload = (body: Record<string, unknown>): Record<string, unknown> => {
    const payloadForLog: Record<string, unknown> = {}

    Object.entries(body).forEach(([key, value]) => {
      if (key === "messages" && Array.isArray(value)) {
        payloadForLog.messages = value.map((message, index) => {
          const typedMessage = message as { role?: unknown; content?: unknown }
          return {
            index,
            role: typeof typedMessage.role === "string" ? typedMessage.role : "unknown",
            content:
              typeof typedMessage.content === "string"
                ? typedMessage.content
                : "",
          }
        })
        return
      }

      if (Array.isArray(value)) {
        payloadForLog[key] = `[array:${value.length}]`
        return
      }

      if (typeof value === "string" && value.length > 280) {
        payloadForLog[key] = `${value.slice(0, 280)}...[trimmed:${value.length - 280}]`
        return
      }

      payloadForLog[key] = value
    })

    return payloadForLog
  }

  const logReq = (
    endpoint: string,
    message: string,
    chatName: string,
    body: Record<string, unknown>,
    targetChatId?: string
  ) => {
    if (!DEBUG_REQUEST_LOGS) return
    const time = new Date().toISOString()
    const { currentChatIndex, chatsWithCurrentFirst } = chatSnap(targetChatId)
    console.log("-----------------------------")
    console.log(`> SENDING REQUEST TO ENDPOINT: ${endpoint}`)
    console.log(`> MESSAGE: ${message}`)
    console.log(`> CHAT NAME: ${chatName}`)
    console.log(`> CURRENT CHAT INDEX: ${currentChatIndex}`)
    console.log("> CHATS (CURRENT FIRST):", chatsWithCurrentFirst)
    console.log("> PAYLOAD:", logPayload(body))
    console.log(`> TIME: ${time}`)
    console.log("-----------------------------")
  }

  const mkUrl = useCallback((endpoint: string) => `${API_BASE_URL}${endpoint}`, [])

  const reqJson = async (
    endpoint: string,
    message: string,
    chatName: string,
    body: Record<string, unknown>,
    signal: AbortSignal,
    targetChatId?: string
  ) => {
    logReq(endpoint, message, chatName, body, targetChatId)
    return fetch(mkUrl(endpoint), {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }

  const stopReq = () => {
    const loadAid = loadAidRef.current
    if (loadAid) {
      rmLoadAidMsg(loadAid.chatId, loadAid.messageId)
      loadAidRef.current = null
    }

    tokenRef.current += 1
    reqKindRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
    setIsRequestInFlight(false)
    setIsLoadingVisible(false)
  }

  const rtjson = useCallback((rawText: string): Record<string, unknown> | null => {
    const trimmed = rawText.trim()
    if (!trimmed) return null

    try {
      return JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      try {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>
      } catch {
        return null
      }
    }
  }, [])

  const pickErr = useCallback((kind: "api" | "img" | "vis" = "api"): string => {
    const arr = errByKind[kind]
    if (arr.length === 0) return "[❌] ERROR\n> Something failed. Try again."
    let i = Math.floor(Math.random() * arr.length)
    if (arr.length > 1 && i === errLastRef.current[kind]) {
      i = (i + 1 + Math.floor(Math.random() * (arr.length - 1))) % arr.length
    }
    errLastRef.current[kind] = i
    return arr[i]
  }, [])

  const normImg = useCallback((responseText: unknown): string => {
    if (typeof responseText !== "string") {
      return pickErr("img")
    }

    const imageUrls = getImgUrls(responseText)
    if (imageUrls.length === 0) {
      return pickErr("img")
    }

    return imageUrls[0]
  }, [pickErr])

  const chekError = useCallback((value: string): boolean => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    return /^\[❌\]\s*error\b/i.test(normalized)
  }, [])

  const toB64 = (file: File, signal: AbortSignal): Promise<string> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"))
        return
      }

      const reader = new FileReader()

      const cleanup = () => {
        signal.removeEventListener("abort", onAbort)
      }

      const onAbort = () => {
        try {
          reader.abort()
        } catch {
        }
        cleanup()
        reject(new DOMException("Aborted", "AbortError"))
      }

      reader.onerror = () => {
        cleanup()
        reject(new Error("Failed to encode image as base64."))
      }

      reader.onabort = () => {
        cleanup()
        reject(new DOMException("Aborted", "AbortError"))
      }

      reader.onload = () => {
        cleanup()
        const result = typeof reader.result === "string" ? reader.result : ""
        const commaIndex = result.indexOf(",")
        const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1).trim() : ""
        if (!base64) {
          reject(new Error("Image is invalid or missing base64 data."))
          return
        }
        resolve(base64)
      }

      signal.addEventListener("abort", onAbort, { once: true })
      reader.readAsDataURL(file)
    })

  const reqImagineInit = async (
    prompt: string,
    chatName: string,
    targetChatId: string,
    signal: AbortSignal
  ): Promise<ImageTaskInit> => {
    const initResponse = await reqJson(
      API_ENDPOINTS.imagine,
      prompt,
      chatName,
      { prompt },
      signal,
      targetChatId
    )

    if (!initResponse.ok) {
      return { status: "done", content: pickErr("img") }
    }

    const initRawText = await initResponse.text()
    const initData = rtjson(initRawText)
    const immediateResponse =
      typeof initData?.response === "string" && initData.response.trim().length > 0
        ? initData.response
        : initRawText

    if (!initData && immediateResponse.trim().length > 0) {
      return { status: "done", content: normImg(immediateResponse) }
    }

    if (typeof initData?.response === "string" && initData.response.trim().length > 0) {
      return { status: "done", content: normImg(initData.response) }
    }

    const taskId = typeof initData?.taskId === "string" ? initData.taskId : ""
    if (!taskId) {
      return { status: "done", content: pickErr("img") }
    }

    return { status: "pending", kind: "imagine", taskId }
  }

  const reqMultiInit = async (
    prompt: string,
    imgB64List: string[],
    chatName: string,
    targetChatId: string,
    signal: AbortSignal
  ): Promise<ImageTaskInit> => {
    const response = await reqJson(
      API_ENDPOINTS.multiedit,
      prompt,
      chatName,
      { prompt, image: imgB64List },
      signal,
      targetChatId
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const initData = (await response.json()) as { taskId?: unknown; response?: unknown }
    if (typeof initData.response === "string" && initData.response.trim().length > 0) {
      return { status: "done", content: initData.response }
    }

    const taskId = typeof initData.taskId === "string" ? initData.taskId : ""
    if (!taskId) {
      throw new Error("multiEdit request did not return a task id.")
    }

    return { status: "pending", kind: "multiEdit", taskId }
  }

  const savePendingImageTasks = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const tasks = Array.from(pendingImageTasksRef.current.values())
      localStorage.setItem(PENDING_IMAGE_TASKS_KEY, JSON.stringify(tasks))
    } catch {
    }
  }, [])

  const rmPendingImageTask = useCallback((taskKey: string) => {
    const timerId = pendingTaskPollTimersRef.current.get(taskKey)
    if (timerId) {
      window.clearInterval(timerId)
      pendingTaskPollTimersRef.current.delete(taskKey)
    }
    pendingTaskInFlightRef.current.delete(taskKey)
    pendingImageTasksRef.current.delete(taskKey)
    savePendingImageTasks()
  }, [savePendingImageTasks])

  const pollPendingImageTask = useCallback(async (taskKey: string) => {
    const task = pendingImageTasksRef.current.get(taskKey)
    if (!task) return
    if (pendingTaskInFlightRef.current.has(taskKey)) return

    const chat = getChat(task.chatId)
    if (!chat) {
      rmPendingImageTask(taskKey)
      return
    }

    const hasLoadingMessage = chat.messages.some(
      (message) => message.id === task.loadingMessageId
    )
    if (!hasLoadingMessage) {
      rmPendingImageTask(taskKey)
      return
    }

    pendingTaskInFlightRef.current.add(taskKey)

    try {
      const response = await fetch(
        mkUrl(task.kind === "imagine" ? API_ENDPOINTS.imagine : API_ENDPOINTS.multiedit),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId: task.taskId }),
        }
      )

      const rawText = await response.text()
      const data = rtjson(rawText)
      if (!data) {
        return
      }

      const status = typeof data.status === "string" ? data.status.toLowerCase() : ""
      const responseText = typeof data.response === "string" ? data.response : ""

      if (status === "completed" || (!status && responseText.trim().length > 0)) {
        const completedContent =
          task.kind === "imagine"
            ? normImg(responseText || rawText)
            : responseText.trim().length > 0
              ? responseText
              : "Image task completed."

        repLoadAidMsg(
          task.chatId,
          task.loadingMessageId,
          completedContent,
          chekError(completedContent) ? "error" : "ok"
        )
        rmPendingImageTask(taskKey)
        return
      }

      if (status === "error") {
        const errorContent =
          task.kind === "multiEdit" &&
          typeof data.message === "string" &&
          data.message.trim().length > 0
            ? data.message
            : pickErr("img")

        repLoadAidMsg(task.chatId, task.loadingMessageId, errorContent, "error")
        rmPendingImageTask(taskKey)
      }
    } catch {
    } finally {
      pendingTaskInFlightRef.current.delete(taskKey)
    }
  }, [chekError, getChat, mkUrl, normImg, pickErr, repLoadAidMsg, rmPendingImageTask, rtjson])

  const startPendingImageTask = useCallback((taskKey: string) => {
    const task = pendingImageTasksRef.current.get(taskKey)
    if (!task) return
    if (pendingTaskPollTimersRef.current.has(taskKey)) return

    const intervalMs = IMAGE_TASK_POLL_MS[task.kind]
    void pollPendingImageTask(taskKey)
    const timerId = window.setInterval(() => {
      void pollPendingImageTask(taskKey)
    }, intervalMs)
    pendingTaskPollTimersRef.current.set(taskKey, timerId)
  }, [pollPendingImageTask])

  const addPendingImageTask = useCallback((task: PendingImageTask) => {
    pendingImageTasksRef.current.set(task.key, task)
    savePendingImageTasks()
    startPendingImageTask(task.key)
  }, [savePendingImageTasks, startPendingImageTask])

  const nekoai = async (
    targetChatId: string,
    prompt: string,
    chatName: string,
    signal: AbortSignal
  ): Promise<string> => {
    const messages = nekoMsgs(targetChatId, prompt)

    // Exact /neko payload contract:
    // { "messages": [ { "role": "...", "content": "..." }, ... ] }
    const response = await reqJson(
      API_ENDPOINTS.neko,
      prompt,
      chatName,
      { messages },
      signal,
      targetChatId
    )

    const rawText = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 220)}`)
    }

    const parsed = rtjson(rawText)
    if (parsed) {
      const candidate =
        parsed.response ??
        parsed.output ??
        parsed.message ??
        (parsed.result as { output?: unknown } | undefined)?.output

      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate
      }
    }

    const trimmed = rawText.trim()
    if (trimmed.length > 0) {
      return trimmed
    }

    return pickErr("api")
  }

  const req_vision = async (
    targetChatId: string,
    prompt: string,
    imgB64: string,
    chatName: string,
    signal: AbortSignal
  ): Promise<string> => {
    const response = await reqJson(
      API_ENDPOINTS.vision,
      prompt,
      chatName,
      { prompt, image: imgB64 },
      signal,
      targetChatId
    )

    const rawText = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 220)}`)
    }

    const parsed = rtjson(rawText)
    if (parsed) {
      const vis_output =
        (parsed as { image?: { output?: unknown } })?.image?.output ??
        (parsed as { output?: unknown }).output ??
        (parsed as { response?: unknown }).response ??
        (parsed as { result?: { output?: unknown } }).result?.output

      if (typeof vis_output === "string" && vis_output.trim().length > 0) {
        return vis_output
      }
    }

    const trimmed = rawText.trim()
    if (trimmed.length > 0) {
      return trimmed
    }

    return pickErr("vis")
  }

  const askAi = async (
    targetChatId: string,
    prompt: string,
    filesIn: File[] = []
  ) => {
    const reqTok = tokenRef.current + 1
    tokenRef.current = reqTok
    const { chatName } = reqCtx(targetChatId)

    const ctrl = new AbortController()
    reqKindRef.current = chatMode === "image" ? "image" : "other"
    abortRef.current = ctrl
    setIsRequestInFlight(true)
    setIsLoadingVisible(true)
    setLoadingAnimationTick((value) => value + 1)
    const loadMsgId = addLoadAidMsg(targetChatId, reqTok)

    try {
      if (chatMode === "image") {
        const imgs = filesIn.slice(0, 4)
        let initResult: ImageTaskInit = { status: "done", content: pickErr("img") }
        if (imgs.length === 0) {
          try {
            initResult = await reqImagineInit(
              prompt,
              chatName,
              targetChatId,
              ctrl.signal
            )
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              throw error
            }
            initResult = { status: "done", content: pickErr("img") }
          }
        } else {
          initResult = await (async () => {
            const imgB64List: string[] = []
            for (const file of imgs) {
              const imgB64 = await toB64(file, ctrl.signal)
              imgB64List.push(imgB64)
            }
            return reqMultiInit(
              prompt,
              imgB64List,
              chatName,
              targetChatId,
              ctrl.signal
            )
          })()
        }

        if (tokenRef.current !== reqTok) return
        if (initResult.status === "done") {
          repLoadAidMsg(
            targetChatId,
            loadMsgId,
            initResult.content,
            chekError(initResult.content) ? "error" : "ok"
          )
          return
        }

        const pendingTask: PendingImageTask = {
          key: `${initResult.kind}:${initResult.taskId}:${targetChatId}:${loadMsgId}`,
          kind: initResult.kind,
          taskId: initResult.taskId,
          chatId: targetChatId,
          loadingMessageId: loadMsgId,
          createdAt: Date.now(),
        }
        addPendingImageTask(pendingTask)
        return
      }

      const imgFile = filesIn[0]
      const isVis = Boolean(imgFile)

      if (!isVis) {
        const responseText = await nekoai(
          targetChatId,
          prompt,
          chatName,
          ctrl.signal
        )

        if (tokenRef.current !== reqTok) return
        repLoadAidMsg(
          targetChatId,
          loadMsgId,
          responseText,
          chekError(responseText) ? "error" : "ok"
        )
        return
      }

      const imgB64 = await toB64(imgFile, ctrl.signal)
      const responseText = await req_vision(
        targetChatId,
        prompt,
        imgB64,
        chatName,
        ctrl.signal
      )

      if (tokenRef.current !== reqTok) return
      repLoadAidMsg(
        targetChatId,
        loadMsgId,
        responseText,
        chekError(responseText) ? "error" : "ok"
      )
      if (isVis) {
        if (tokenRef.current !== reqTok) return
        setIsLoadingVisible(false)
      }
    } catch (error) {
      if (tokenRef.current !== reqTok) return
      if (error instanceof DOMException && error.name === "AbortError") {
        rmLoadAidMsg(targetChatId, loadMsgId)
        return
      }

      repLoadAidMsg(
        targetChatId,
        loadMsgId,
        pickErr(chatMode === "image" ? "img" : "api"),
        "error"
      )
    } finally {
      if (tokenRef.current === reqTok) {
        abortRef.current = null
        reqKindRef.current = null
        loadAidRef.current = null
        setIsRequestInFlight(false)
        setIsLoadingVisible(false)
      }
    }
  }

  useEffect(() => {
    const viewport = viewRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
  }, [messages.length, isRequestInFlight, chatId])

  useEffect(() => {
    const pendingPollTimers = pendingTaskPollTimersRef.current
    const pendingInFlightTasks = pendingTaskInFlightRef.current

    return () => {
      abortRef.current?.abort()
      pendingPollTimers.forEach((timerId) => {
        window.clearInterval(timerId)
      })
      pendingPollTimers.clear()
      pendingInFlightTasks.clear()
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
      if (toastOutRef.current) {
        window.clearTimeout(toastOutRef.current)
      }
      if (promptHighlightTimerRef.current) {
        window.clearTimeout(promptHighlightTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const saved = localStorage.getItem(PENDING_IMAGE_TASKS_KEY)
      if (!saved) return

      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return

      const loadedTasks: PendingImageTask[] = []
      parsed.forEach((item) => {
        if (!item || typeof item !== "object") return
        const typed = item as Partial<PendingImageTask>
        if (
          typeof typed.key !== "string" ||
          (typed.kind !== "imagine" && typed.kind !== "multiEdit") ||
          typeof typed.taskId !== "string" ||
          typeof typed.chatId !== "string" ||
          typeof typed.loadingMessageId !== "string"
        ) {
          return
        }
        loadedTasks.push({
          key: typed.key,
          kind: typed.kind,
          taskId: typed.taskId,
          chatId: typed.chatId,
          loadingMessageId: typed.loadingMessageId,
          createdAt: typeof typed.createdAt === "number" ? typed.createdAt : Date.now(),
        })
      })

      if (loadedTasks.length === 0) {
        localStorage.removeItem(PENDING_IMAGE_TASKS_KEY)
        return
      }

      loadedTasks.forEach((task) => {
        pendingImageTasksRef.current.set(task.key, task)
        startPendingImageTask(task.key)
      })
      savePendingImageTasks()
    } catch {
    }
  }, [savePendingImageTasks, startPendingImageTask])

  useEffect(() => {
    if (abortRef.current && reqKindRef.current !== "image") {
      const loadAid = loadAidRef.current
      if (loadAid) {
        const loadChat = getChat(loadAid.chatId)
        if (loadChat) {
          const leftMsgs = loadChat.messages.filter(
            (message) => message.id !== loadAid.messageId
          )
          if (leftMsgs.length !== loadChat.messages.length) {
            updateChat(loadAid.chatId, { messages: leftMsgs })
          }
        }
        loadAidRef.current = null
      }

      tokenRef.current += 1
      reqKindRef.current = null
      abortRef.current.abort()
      abortRef.current = null
      setIsRequestInFlight(false)
      setIsLoadingVisible(false)
    }
  }, [chatId, chatMode, getChat, updateChat])

  useEffect(() => {
    if (!hasLoadingMessages) return

    const intervalId = window.setInterval(() => {
      setLoadingAnimationTick((value) => value + 1)
    }, 2600)

    return () => window.clearInterval(intervalId)
  }, [hasLoadingMessages])

  useEffect(() => {
    setAttachments((prev) => {
      if (prev.length <= maxFiles) return prev
      return prev.slice(0, maxFiles)
    })
  }, [maxFiles])

  useEffect(() => {
    if (galleryImages.length === 0) {
      setIsGalleryOpen(false)
      setActiveGalleryIndex(0)
      return
    }

    setActiveGalleryIndex((prev) => Math.min(prev, galleryImages.length - 1))
  }, [galleryImages.length])

  useEffect(() => {
    if (!toastMessage || isToastExiting) return
    bleeps.notify?.play("toast-notify")
  }, [bleeps, isToastExiting, toastMessage])

  useEffect(() => {
    if (!lastAidId) return
    const previousId = prevAidIdRef.current
    prevAidIdRef.current = lastAidId
    if (!previousId || previousId === lastAidId) return
    if (lastAidMsg?.responseState === "error") {
      return
    }
    bleeps.assemble?.play("assistant-reply")
  }, [bleeps, lastAidMsg?.responseState, lastAidId])

  const handleSend = async () => {
    if (!chatId || isRequestInFlight) return
    const prompt = inputValueRef.current
    if (!prompt.trim()) return
    const filesIn = attachments.slice(0, maxFiles)

    if (filesIn.some((file) => !okImgFile(file))) {
      showToast("Only image files are supported")
      setAttachments([])
      return
    }

    const timestamp = Date.now()
    const newMessage: Message = {
      id: `user-${timestamp}`,
      content: prompt,
      role: "user",
      timestamp: new Date(),
      attachments: filesIn.length > 0 ? filesIn : undefined,
    }

    addMessage(chatId, newMessage)
    inputValueRef.current = ""
    setHasInput(false)
    if (textAreaRef.current) {
      textAreaRef.current.value = ""
    }
    setAttachments([])

    await askAi(chatId, newMessage.content, filesIn)
  }

  const regenMsg = async () => {
    if (!chatId || isRequestInFlight) return

    const chat = getChat(chatId)
    if (!chat || chat.messages.length === 0) return

    const lastUserIndex = [...chat.messages]
      .map((message) => message.role)
      .lastIndexOf("user")

    if (lastUserIndex < 0) return

    const lastUserMessage = chat.messages[lastUserIndex]
    const lastFiles = lastUserMessage.attachments ?? []

    if (chatMode !== "image") {
      const keepMsgs = chat.messages.slice(0, lastUserIndex + 1)
      if (keepMsgs.length !== chat.messages.length) {
        updateChat(chatId, { messages: keepMsgs })
      }
    }

    await askAi(chatId, lastUserMessage.content, lastFiles)
  }

  const showToast = useCallback((message: string) => {
    setIsToastExiting(false)
    setToastMessage(message)

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    if (toastOutRef.current) {
      window.clearTimeout(toastOutRef.current)
    }

    toastTimerRef.current = window.setTimeout(() => {
      setIsToastExiting(true)
      toastOutRef.current = window.setTimeout(() => {
        setToastMessage(null)
        setIsToastExiting(false)
      }, 260)
    }, 1850)
  }, [])

  const copyTxt = useCallback(async (content: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(content)
        return true
      }
    } catch {
    }

    try {
      const textArea = document.createElement("textarea")
      textArea.value = content
      textArea.setAttribute("readonly", "true")
      textArea.style.position = "fixed"
      textArea.style.top = "-9999px"
      textArea.style.left = "-9999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      textArea.setSelectionRange(0, textArea.value.length)

      const didCopy = document.execCommand("copy")
      document.body.removeChild(textArea)
      return didCopy
    } catch {
      return false
    }
  }, [])

  const handleCopy = useCallback(async (content: string) => {
    const copied = await copyTxt(content)
    if (copied) {
      showToast("Text copied to clipboard")
      return
    }

    window.prompt("Copy text manually:", content)
    showToast("Copy unavailable, manual copy shown")
  }, [copyTxt, showToast])

  const imgName = useCallback((imageUrl: string): string => {
    try {
      const pathname = new URL(imageUrl).pathname
      const candidate = pathname.split("/").pop() ?? ""
      if (candidate.trim().length > 0) {
        return candidate
      }
    } catch {
    }

    return `image-${Date.now()}.png`
  }, [])

  const dlImg = useCallback(async (imageUrl: string) => {
    try {
      const obj1 = await fetch(imageUrl)
      if (!obj1.ok) {
        throw new Error(`Download request failed with status ${obj1.status}`)
      }

      const obj2 = await obj1.blob()
      const obj3 = URL.createObjectURL(obj2)
      const obj4 = document.createElement("a")
      obj4.href = obj3
      obj4.download = imgName(imageUrl)
      obj4.rel = "noopener noreferrer"
      obj4.style.display = "none"
      document.body.appendChild(obj4)
      obj4.click()
      document.body.removeChild(obj4)
      URL.revokeObjectURL(obj3)
      showToast("Download started")
    } catch {
      showToast("Download failed")
    }
  }, [imgName, showToast])

  const focusPromptForEdit = useCallback(() => {
    const textarea = textAreaRef.current
    if (!textarea) return

    textarea.focus()
    textarea.select()
    setIsPromptHighlighted(true)

    if (promptHighlightTimerRef.current) {
      window.clearTimeout(promptHighlightTimerRef.current)
    }
    promptHighlightTimerRef.current = window.setTimeout(() => {
      setIsPromptHighlighted(false)
    }, 1300)
  }, [])

  const editImg = useCallback(async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Edit image fetch failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const file = new File(
        [blob],
        imgName(imageUrl),
        { type: blob.type && blob.type.startsWith("image/") ? blob.type : "image/png" }
      )

      const mergedFiles =
        chatMode === "image" ? [...attachments, file] : [file]

      if (mergedFiles.length > maxFiles) {
        showToast(
          chatMode === "image" ? "Maximum four images allowed" : "Only one image can be uploaded"
        )
      } else {
        showToast("Image attached. Add an edit prompt.")
      }

      setAttachments(mergedFiles.slice(0, maxFiles))
      focusPromptForEdit()
    } catch {
      showToast("Could not attach image for editing")
    }
  }, [attachments, chatMode, focusPromptForEdit, imgName, maxFiles, showToast])

  const openGal = useCallback((imageKey: string) => {
    const index = imgKeyMap.get(imageKey)
    if (index === undefined) return
    setActiveGalleryIndex(index)
    setIsGalleryOpen(true)
  }, [imgKeyMap])

  const closeGallery = useCallback(() => {
    setIsGalleryOpen(false)
  }, [])

  const prevGal = useCallback(() => {
    if (galleryImages.length === 0) return
    setActiveGalleryIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))
  }, [galleryImages.length])

  const nextGal = useCallback(() => {
    if (galleryImages.length === 0) return
    setActiveGalleryIndex((prev) => (prev + 1) % galleryImages.length)
  }, [galleryImages.length])

  useEffect(() => {
    if (!isGalleryOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeGallery()
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setActiveGalleryIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        setActiveGalleryIndex((prev) => (prev + 1) % galleryImages.length)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [isGalleryOpen, galleryImages.length, closeGallery])

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const files = Array.from(e.target.files)
    const imgs = files.filter((file) => okImgFile(file))

    if (imgs.length === 0) {
      setAttachments([])
      showToast("Only image files are supported")
      e.target.value = ""
      return
    }

    if (imgs.length < files.length) {
      showToast("Only image files are supported")
    }

    const mergedFiles =
      chatMode === "image" ? [...attachments, ...imgs] : imgs.slice(0, 1)

    if (mergedFiles.length > maxFiles) {
      showToast(
        chatMode === "image" ? "Maximum four images allowed" : "Only one image can be uploaded"
      )
    }

    setAttachments(mergedFiles.slice(0, maxFiles))
    e.target.value = ""
  }

  const clearAttach = () => {
    setAttachments([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const onInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value
    inputValueRef.current = nextValue
    const nextHasInput = nextValue.trim().length > 0
    setHasInput((prev) => (prev === nextHasInput ? prev : nextHasInput))
  }, [])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isRequestInFlight) return
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasTxt = hasInput
  const noAttach = attachments.length >= maxFiles || isRequestInFlight
  const attachWhy = isRequestInFlight
    ? "Request in progress..."
    : attachments.length >= maxFiles
      ? "Maximum files attached..."
      : null
  const noSend = isRequestInFlight || !hasTxt
  const sendWhy = !hasTxt
    ? "Please type something"
    : isRequestInFlight
      ? "Request in progress..."
      : null
  const galOverlay =
    isGalleryOpen && curImg ? (
      <div
        className="gallery-overlay fixed inset-0 z-[11000] flex items-center justify-center p-4"
        onClick={closeGallery}
        role="dialog"
        aria-modal="true"
        aria-label="Image gallery"
      >
        <ArwesActionButton
          type="button"
          frame="octagon"
          className="arwes-octagon-button arwes-download-img-button absolute left-4 top-4 z-[120] h-11 w-20 min-h-0 p-0 sm:h-14 sm:w-24"
          onClick={(event) => {
            event.stopPropagation()
            if (curImg) {
              dlImg(curImg)
            }
          }}
          aria-label="Download image"
        >
          <Download className="h-6 w-6 sm:h-8 sm:w-8" />
        </ArwesActionButton>

        <ArwesActionButton
          type="button"
          frame="octagon"
          className="arwes-octagon-button arwes-remove-attachment-button absolute right-4 top-4 z-[120] h-11 w-20 min-h-0 p-0 sm:h-14 sm:w-24"
          onClick={(event) => {
            event.stopPropagation()
            closeGallery()
          }}
          aria-label="Close gallery"
        >
          <X className="h-6 w-6 sm:h-8 sm:w-8" />
        </ArwesActionButton>

        <div
          className="gallery-frame-shell relative inline-flex  items-center justify-center p-0"
          onClick={(event) => event.stopPropagation()}
        >
          <FrameLines
            styled
            animated
            padding={1}
            largeLineWidth={3}
            smallLineWidth={5}
            smallLineLength={65}
            className="gallery-lines-frame pointer-events-none absolute inset-0 z-[1]"
          />
          <ArwesActionButton
            type="button"
            frame="octagon"
            className="gallery-nav-button active:translate-y-0 absolute left-[2%] z-[60] h-14 w-14 cursor-pointer sm:h-24 sm:w-24 gal-prev"
            onClick={(event) => {
              event.stopPropagation()
              prevGal()
            }}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-8 w-8 sm:h-14 sm:w-14" />
          </ArwesActionButton>

          <div className="gallery-image-shell   flex items-center justify-center">
            <FrameLines
              styled
              animated
              padding={1}
              largeLineWidth={2}
              smallLineWidth={3}
              smallLineLength={14}
              className="gallery-image-lines-frame pointer-events-none "
            />
            <div className="gallery-image-inner relative z-[2]">
              <Image
                src={curImg}
                alt={`Chat image ${activeGalleryIndex + 1}`}
                width={1600}
                height={1600}
                unoptimized
                className="gallery-image block object-contain"
              />
            </div>
          </div>
          <ArwesActionButton
            type="button"
            frame="octagon"
            className="gallery-nav-button active:translate-y-0 absolute right-[2%] z-[60] h-14 w-14 cursor-pointer sm:h-24 sm:w-24 gal-next"
            onClick={(event) => {
              event.stopPropagation()
              nextGal()
            }}
            aria-label="Next image"
          >
            <ChevronRight className="h-8 w-8 sm:h-14 sm:w-14" />
          </ArwesActionButton>
        </div>

        <div className="gallery-counter-shell absolute bottom-4 left-1/2 z-[40] flex h-10 w-24 -translate-x-1/2 items-center justify-center overflow-hidden px-3 py-1 text-sm text-cyan-100">
          <FrameLines
            styled
            animated
            padding={1}
            largeLineWidth={1}
            smallLineWidth={1}
            smallLineLength={1}
            className="gallery-counter-frame pointer-events-none absoluteinset-0 z-[1]"
          />
          <ArwesTypedText
            as="span"
            className="gallery-counter-text relative z-[2] text-center"
            text={`${activeGalleryIndex + 1} / ${galleryImages.length}`}
            trigger={`gallery-count-${activeGalleryIndex}`}
          />
        </div>
      </div>
    ) : null

  return (
    <TooltipProvider>
      <div className="cyber-terminal flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={viewRef}
            className="h-full overflow-y-auto px-3 py-4 sm:px-4 md:px-6"
          >
            <div className="mx-auto w-full max-w-4xl space-y-4 pb-4">
              {messages.map((message) => {
                const inlineImgs = getImgUrls(message.content)
                const txtBody = cleanImgUrls(message.content)
                const isUserMessage = message.role === "user"
                const isLoadAid =
                  message.role === "assistant" &&
                  (message.responseState === "loading" || message.id.startsWith("assistant-loading-"))
                const isErrAid =
                  message.role === "assistant" && message.responseState === "error"
                const bubbleStyle = isUserMessage
                  ? usrBubbleStyle
                  : isErrAid
                    ? errBubbleStyle
                    : aidBubbleStyle

                return (
                  <div
                    key={message.id}
                    className={`flex ${isUserMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div className="w-full max-w-[92%] sm:max-w-[82%] md:max-w-[72%]">
                      <div
                        className={`relative p-4 ${
                          isUserMessage
                            ? "border border-cyan-300/50"
                            : isErrAid
                              ? "border border-red-400/60 shadow-[0_0_18px_rgba(255,82,82,0.28)]"
                              : "border border-cyan-500/35"
                        }`}
                      >
                          <FrameNefrex
                            {...arwesPanel1}
                            style={bubbleStyle}
                            className="pointer-events-none absolute inset-0 z-[1]"
                          />
                        <div
                          className={`relative z-[2] ${
                            isUserMessage ? "text-cyan-50" : "text-cyan-100"
                          }`}
                        >
                          {isLoadAid ? (
                            <p className="relative z-[2] text-decipher pending-loading-text text-cyan-200">
                              <SlowDecipherText
                                text={message.content || LOADING_LABEL}
                                trigger={`${message.id}-${loadingAnimationTick}`}
                                durationMs={2400}
                              />
                            </p>
                          ) : (
                            txtBody.length > 0 && (
                              isUserMessage ? (
                                <ArwesTypedText
                                  as="p"
                                  className="whitespace-pre-wrap break-words"
                                  text={txtBody}
                                  trigger={message.id}
                                />
                              ) : (
                                <AssistantMarkdown
                                  getjson={txtBody}
                                  cpbtn_markdown={handleCopy}
                                />
                              )
                            )
                          )}
                          {inlineImgs.length > 0 && (
                            <div className={txtBody.length > 0 ? "mt-3 space-y-3" : "space-y-3"}>
                              {inlineImgs.map((imageUrl, index) => (
                                <div key={`${message.id}-inline-image-${index}`}>
                                  <Image
                                    src={imageUrl}
                                    alt="Generated result"
                                    width={1024}
                                    height={1024}
                                    unoptimized
                                    loading="lazy"
                                    className="max-h-[440px] w-full cursor-zoom-in rounded-md border border-cyan-400/30 bg-black/40 object-contain"
                                    onClick={() =>
                                      openGal(`${message.id}-inline-image-${index}`)
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2 text-sm text-cyan-300">
                              <ArwesTypedText
                                as="span"
                                className="text-sm text-cyan-300"
                                text={`Attached: ${message.attachments.length} file(s)`}
                                trigger={`${message.id}-attachments`}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {message.role === "assistant" && !isLoadAid && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {inlineImgs.length > 0 && txtBody.length === 0 ? (
                            <>
                              <button
                                type="button"
                                className="relative inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:text-cyan-100"
                                onClick={() => dlImg(inlineImgs[0])}
                              >
                                <FrameCorners
                                  style={aidActionStyle}
                                  className="pointer-events-none absolute inset-0"
                                  padding={1}
                                />
                                <Download className="relative z-[2] h-3.5 w-3.5" />
                                <ArwesTypedText
                                  as="span"
                                  className="relative z-[2]"
                                  text="Download image"
                                  trigger={`${message.id}-download`}
                                />
                              </button>
                              <button
                                type="button"
                                className="relative inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:text-cyan-100"
                                onClick={() => void editImg(inlineImgs[0])}
                              >
                                <FrameCorners
                                  style={aidActionStyle}
                                  className="pointer-events-none absolute inset-0"
                                  padding={1}
                                />
                                <Pencil className="relative z-[2] h-3.5 w-3.5" />
                                <ArwesTypedText
                                  as="span"
                                  className="relative z-[2]"
                                  text="Edit"
                                  trigger={`${message.id}-edit`}
                                />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="relative inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:text-cyan-100"
                              onClick={() => handleCopy(message.content)}
                            >
                              <FrameCorners
                                style={aidActionStyle}
                                className="pointer-events-none absolute inset-0"
                                padding={1}
                              />
                              <Copy className="relative z-[2] h-3.5 w-3.5" />
                              <ArwesTypedText
                                as="span"
                                className="relative z-[2]"
                                text="Copy text"
                                trigger={`${message.id}-copy`}
                              />
                            </button>
                          )}
                          
                          <button
                            type="button"
                            className="relative inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                            onClick={regenMsg}
                            disabled={isRequestInFlight || message.id !== lastAidId}
                          >
                            <FrameCorners
                              style={aidActionStyle}
                              className="pointer-events-none absolute inset-0"
                              padding={1}
                            />
                            <RotateCcw className="relative z-[2] h-3.5 w-3.5" />
                            <ArwesTypedText
                              as="span"
                              className="relative z-[2]"
                              text="Regenerate"
                              trigger={`${message.id}-regenerate`}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-cyan-500/30 bg-black/10 p-3 backdrop-blur-sm sm:p-4">
          <div className="mx-auto w-full max-w-4xl">
           <div className="relative">
            

              <Textarea
                ref={textAreaRef}
                frame="nero"
                onChange={onInputChange}
                onKeyDown={onKey}
                disabled={isRequestInFlight}
                placeholder={
                  chatMode === "image"
                    ? "Describe your image request..."
                    : "Type your message here..."
                }
                className={`arwes-chat-textarea-nefrex relative z-[2] min-h-[92px] resize-none bg-transparent pr-24 text-cyan-100 placeholder-cyan-400/50 ${
                  isPromptHighlighted
                    ? "ring-2 ring-cyan-300/80 shadow-[0_0_14px_rgba(102,246,255,0.32)]"
                    : ""
                }`}
              />
              <div className="absolute bottom-2 right-2 z-[4] flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={chatMode === "image"}
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={onFilePick}
                  className="hidden"
                />

                <div className="bottom-2 right-2 z-[4] flex gap-2 ">
                  {attachWhy ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <ArwesActionButton
                            type="button"
                            frame="octagon"
                            onClick={() => fileInputRef.current?.click()}
                            className="arwes-octagon-button h-8 w-8 min-h-0 p-0"
                            disabled={noAttach}
                            aria-disabled={noAttach}
                          >
                            <Paperclip className="h-4 w-4" />
                          </ArwesActionButton>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="cyberpunk-tooltip-content" side="top" sideOffset={7}>
                        {attachWhy}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <ArwesActionButton
                      type="button"
                      frame="octagon"
                      onClick={() => fileInputRef.current?.click()}
                      className="arwes-octagon-button h-8 w-8 min-h-0 p-0"
                      disabled={noAttach}
                    >
                      <Paperclip className="h-4 w-4" />
                    </ArwesActionButton>
                  )}

                  {isLoadingVisible ? (
                    <ArwesActionButton
                      type="button"
                      frame="octagon"
                      onClick={stopReq}
                      className="arwes-octagon-button arwes-chat-action-octagon arwes-chat-action-octagon-stop h-8 w-8 min-h-0 p-0"
                    >
                      <Square className="h-4 w-4" />
                    </ArwesActionButton>
                  ) : (
                    <>
                      {sendWhy ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <ArwesActionButton
                                type="button"
                                frame="octagon"
                                onClick={handleSend}
                                disabled={noSend}
                                aria-disabled={noSend}
                                className="arwes-octagon-button h-8 w-8 min-h-0 p-0"
                              >
                                <Send className="h-4 w-4" />
                              </ArwesActionButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            className="cyberpunk-tooltip-content"
                            side="top"
                            sideOffset={7}
                          >
                            {sendWhy}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <ArwesActionButton
                          type="button"
                          frame="octagon"
                          onClick={handleSend}
                          disabled={noSend}
                          className="arwes-octagon-button h-8 w-8 min-h-0 p-0"
                        >
                          <Send className="h-4 w-4" />
                        </ArwesActionButton>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-cyan-300">
                <ArwesTypedText
                  as="span"
                  text={`${attachments.length} image${attachments.length > 1 ? "s" : ""} attached${chatMode === "image" ? ` (${attachments.length}/4)` : ""}`}
                  trigger={`attachments-${attachments.length}-${chatMode}`}
                />
                <ArwesActionButton
                  type="button"
                  frame="octagonX"
                  onClick={clearAttach}
                  className="arwes-octagon-button arwes-remove-attachment-button h-8 w-8 min-h-0 p-0"
                  aria-label="Remove attachment"
                >
                  <Trash2 className="h-4 w-4" />
                </ArwesActionButton>
              </div>
            )}
          </div>
        </div>
      </div>
      {typeof window !== "undefined" ? createPortal(galOverlay, document.body) : null}
      {toastMessage && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[10000] w-max max-w-[85vw] -translate-x-1/2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
          <div
            className={`cyberpunk-toast_notif cyberpunk-tooltip-content relative px-3 py-1.5 ${
              isToastExiting ? "cyberpunk-toast-out" : "cyberpunk-toast-in"
            }`}
          >
            <FrameUnderline
              {...arwesUnder1}
              style={toastFrameStyle}
              className="cyberpunk-tooltip-frame cyberpunk-tooltip-frame-main pointer-events-none absolute inset-0 z-[1]"
            />
            <FrameUnderline
              {...arwesUnder1}
              style={toastFrameStyle}
              className="cyberpunk-tooltip-frame cyberpunk-tooltip-frame-inner pointer-events-none absolute inset-[2px] z-[1]"
            />
            <div className="relative z-[2]">
              <ArwesTypedText
                as="span"
                className="cyberpunk-tooltip-text"
                text={toastMessage}
                trigger={`toast_notif-${toastMessage}`}
              />
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
