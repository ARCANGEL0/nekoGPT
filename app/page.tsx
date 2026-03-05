"use client"

import { useState } from "react"
import { ChatPageWrapper } from "@/components/chat-page-wrapper"
import { LoadingScreen } from "@/components/loading-screen"

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false)

  if (!isLoaded) {
    return <LoadingScreen onComplete={() => setIsLoaded(true)} />
  }

  return <ChatPageWrapper />
}
