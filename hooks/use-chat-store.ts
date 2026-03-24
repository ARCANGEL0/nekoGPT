import { useEffect, useState, useCallback } from 'react'
import { chatStore, Chat } from '@/lib/chat-store'

export function useChatStore() {
  const [chats, setChats] = useState<Chat[]>([])
  
  useEffect(() => {
    const syncChats = () => {
      setChats(chatStore.getAllChats())
    }
    
    syncChats()
    return chatStore.subscribe(syncChats)
  }, [])

  const getChat = useCallback((id: string) => chatStore.getChat(id), [])
  const createChat = useCallback(() => chatStore.createChat(), [])
  const createTemporaryChat = useCallback(() => chatStore.createTemporaryChat(), [])
  const getOrNew = useCallback(() => chatStore.getOrNew(), [])
  const updateChat = useCallback((id: string, updates: Partial<Chat>) => chatStore.updateChat(id, updates), [])
  const addMessage = useCallback((chatId: string, message: any) => chatStore.addMessage(chatId, message), [])
  const updateMessage = useCallback((chatId: string, messageId: string, updates: any) => {
    chatStore.updateMessage(chatId, messageId, updates)
  }, [])
  const deleteChat = useCallback((id: string) => chatStore.deleteChat(id), [])
  
  return {
    chats,
    createChat,
    createTemporaryChat,
    getOrNew,
    getChat,
    updateChat,
    addMessage,
    updateMessage,
    deleteChat
  }
}
