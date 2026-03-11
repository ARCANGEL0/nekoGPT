import { NextRequest } from "next/server"

const DEF_NAME = "image.png"

const extFromMime = (mimeType: string): string => {
  const lower = mimeType.toLowerCase()
  if (lower.includes("image/jpeg")) return ".jpg"
  if (lower.includes("image/png")) return ".png"
  if (lower.includes("image/gif")) return ".gif"
  if (lower.includes("image/webp")) return ".webp"
  if (lower.includes("image/bmp")) return ".bmp"
  if (lower.includes("image/svg+xml")) return ".svg"
  return ".png"
}

const cleanName = (rawName: string): string => {
  const normalized = rawName
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>:"/\\|?*]+/g, "_")
    .trim()

  return normalized.length > 0 ? normalized : DEF_NAME
}

const nameFromUrl = (url: URL, mimeType: string): string => {
  const lastPathEnc = url.pathname.split("/").pop() ?? ""
  const lastPath = decodeURIComponent(lastPathEnc)
  const safeName = cleanName(lastPath)
  if (safeName !== DEF_NAME && safeName.includes(".")) {
    return safeName
  }

  const ext = extFromMime(mimeType)
  const baseName =
    safeName !== DEF_NAME
      ? safeName.replace(/\.[^/.]+$/, "")
      : DEF_NAME.replace(/\.[^/.]+$/, "")
  return `${baseName}${ext}`
}

export async function GET(request: NextRequest) {
  const urlRaw = request.nextUrl.searchParams.get("url") ?? ""
  if (urlRaw.trim().length === 0) {
    return Response.json({ message: "Missing url parameter" }, { status: 400 })
  }

  let urlObj: URL
  try {
    urlObj = new URL(urlRaw)
  } catch {
    return Response.json({ message: "Invalid url parameter" }, { status: 400 })
  }

  if (!["http:", "https:"].includes(urlObj.protocol)) {
    return Response.json({ message: "Unsupported url protocol" }, { status: 400 })
  }

  try {
    const up = await fetch(urlObj.toString(), {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    })

    if (!up.ok) {
      return Response.json({ message: "Unable to fetch image" }, { status: 502 })
    }

    const contentType = up.headers.get("content-type") ?? "application/octet-stream"
    const filename = nameFromUrl(urlObj, contentType)
    const len = up.headers.get("content-length")

    const headers = new Headers()
    headers.set("Content-Type", contentType)
    headers.set("Content-Disposition", `attachment; filename="${filename}"`)
    if (len) {
      headers.set("Content-Length", len)
    }
    headers.set("Cache-Control", "no-store")

    return new Response(up.body, {
      status: 200,
      headers,
    })
  } catch {
    return Response.json({ message: "Image download failed" }, { status: 500 })
  }
}
