import { NextRequest } from "next/server"

const VIS_URL = "https://api.arcangelo.net/neko_vision"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const canRetry = (error: unknown): boolean => {
  const retryCodes = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE"])
  const errLike = error as { code?: string; name?: string }
  return retryCodes.has(errLike.code ?? "") || errLike.name === "AbortError"
}

const fetchRetry = async (
  url: string,
  options: RequestInit,
  retries = 2
): Promise<Response> => {
  let lastErr: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const tCtrl = new AbortController()
    const timeoutId = setTimeout(() => tCtrl.abort(), 15000)

    try {
      return await fetch(url, {
        ...options,
        cache: "no-store",
        signal: tCtrl.signal,
      })
    } catch (error) {
      lastErr = error
      if (attempt === retries || !canRetry(error)) {
        throw error
      }
      await wait(450 * (attempt + 1))
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw (lastErr instanceof Error ? lastErr : new Error("Request failed"))
}

const uint8ToBase64 = (bytes: Uint8Array): string => {
  const CHUNK_SIZE = 0x8000
  let binary = ""

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

const fileToB64 = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return uint8ToBase64(bytes)
}

const rtjson = (rawText: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(rawText) as Record<string, unknown>
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    try {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    let prompt = ""
    let image = ""
    const contentType = request.headers.get("content-type") ?? ""

    if (contentType.includes("application/json")) {
      const data = (await request.json()) as { prompt?: unknown; image?: unknown }
      prompt = typeof data.prompt === "string" ? data.prompt.trim() : ""
      image = typeof data.image === "string" ? data.image.trim() : ""
    } else {
      const data = await request.formData()
      prompt = typeof data.get("prompt") === "string" ? (data.get("prompt") as string).trim() : ""
      const imgIn = data.get("image")

      if (typeof imgIn === "string") {
        image = imgIn.trim()
      } else if (imgIn instanceof File && imgIn.size > 0) {
        image = await fileToB64(imgIn)
      }
    }

    if (!prompt || !image) {
      return Response.json({ message: "Missing image or prompt" }, { status: 400 })
    }

    const upRes = await fetchRetry(VIS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, image }),
    })

    const rawText = await upRes.text()

    if (!upRes.ok) {
      return Response.json(
        {
          message: "Vision request failed",
          status: upRes.status,
          details: rawText.slice(0, 360),
        },
        { status: 502 }
      )
    }

    const parsed = rtjson(rawText)
    if (parsed) {
      return Response.json(parsed, { status: 200 })
    }

    return Response.json({ response: rawText }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected vision error"
    return Response.json({ message }, { status: 500 })
  }
}
