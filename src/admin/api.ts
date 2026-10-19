let csrf = ''
export function setCsrf(value: string) {
  csrf = value
}
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
export async function api<T = unknown>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api/admin' + path, {
      method,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(15000),
      headers:
        method === 'GET'
          ? {}
          : {
              'Content-Type': 'application/json',
              'X-Auraflare-Request': 'admin',
              'X-CSRF-Token': csrf,
            },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new ApiError(
      0,
      'The studio server is unavailable. Check your connection and try again.',
    )
  }
  let data
  try {
    data = await response.json()
  } catch {
    throw new ApiError(
      response.status,
      'The secure admin needs the Node server. This static host cannot sign in to real accounts.',
    )
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error || 'This change could not be saved.',
    )
  return data
}
export function imageData(file: File, maxMB: number): Promise<string> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > maxMB * 1024 * 1024
  )
    return Promise.reject(
      new Error(`Choose a PNG, JPEG or WebP under ${maxMB} MB.`),
    )
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(file)
  })
}
