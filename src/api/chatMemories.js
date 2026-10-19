import request from './request'
import { memoryManagementLinks } from '@/utils/chatMemoryActions'

export function listChatMemories() {
  return request.get(memoryManagementLinks(0).list)
}

export function getChatMemory(memoryId) {
  return request.get(memoryManagementLinks(memoryId).detail)
}
