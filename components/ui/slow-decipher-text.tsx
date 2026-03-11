"use client"

import { useEffect, useMemo, useState } from "react"

interface SlowDecipherTextProps {
  text: string
  trigger?: number | string
  durationMs?: number
  stepMs?: number
  loop?: boolean
}

const DECIPHER_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%*+-<>"

const getRandomGlyph = () => DECIPHER_GLYPHS[Math.floor(Math.random() * DECIPHER_GLYPHS.length)]

export function SlowDecipherText({
  text,
  trigger = 0,
  durationMs = 2100,
  stepMs = 52,
  loop = false,
}: SlowDecipherTextProps) {
  const targetChars = useMemo(() => Array.from(text), [text])
  const [displayedText, setDisplayedText] = useState("")

  useEffect(() => {
    if (!text) {
      setDisplayedText("")
      return
    }

    const totalFrames = Math.max(1, Math.ceil(durationMs / stepMs))
    let frame = 0
    const buildFrameText = (revealedCount: number) =>
      targetChars
        .map((char, index) => {
          if (char === " " || char === ".") {
            return char
          }
          return index < revealedCount ? char : getRandomGlyph()
        })
        .join("")

    setDisplayedText(buildFrameText(0))

    const intervalId = window.setInterval(() => {
      frame += 1

      if (loop) {
        const loopFrame = frame % (totalFrames + 1)
        const revealProgress = loopFrame / totalFrames
        const revealCount = Math.floor(revealProgress * targetChars.length)
        setDisplayedText(buildFrameText(revealCount))
        return
      }

      const revealProgress = frame / totalFrames
      const revealCount = Math.floor(revealProgress * targetChars.length)
      setDisplayedText(buildFrameText(revealCount))

      if (frame >= totalFrames) {
        window.clearInterval(intervalId)
        setDisplayedText(text)
      }
    }, stepMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [durationMs, stepMs, targetChars, text, trigger, loop])

  return <>{displayedText}</>
}
