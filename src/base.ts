import { resolve } from 'path'

export const storagePath = resolve(process.cwd(), 'storage')

export function timeout(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}
