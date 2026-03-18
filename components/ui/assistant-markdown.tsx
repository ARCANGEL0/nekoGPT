"use client"

import { memo, useMemo, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeHighlight from "rehype-highlight"
import rehypeKatex from "rehype-katex"
import katex from "katex"
import type { Components } from "react-markdown"

interface AssistantMarkdownProps {
  getjson: string
  cpbtn_markdown: (text: string) => void | Promise<void>
}

const hasClassToken = (className: string | undefined, token: string): boolean =>
  className?.split(/\s+/).includes(token) ?? false

const restoreLatexEscapes = (value: string) =>
  value
    .replace(/\u0008/g, "\\b")
    .replace(/\u0009/g, "\\t")
    .replace(/\u000b/g, "\\v")
    .replace(/\u000c/g, "\\f")
    .replace(/\u000d/g, "\\r")

const normalizeMathSymbols = (value: string) =>
  value
    .replace(/⟹/g, "\\Longrightarrow")
    .replace(/⟸/g, "\\Longleftarrow")
    .replace(/⟺/g, "\\Longleftrightarrow")
    .replace(/∘/g, "\\circ")
    .replace(/×/g, "\\times")
    .replace(/·/g, "\\cdot")

const unescapeDoubleBackslashCommands = (value: string): string =>
  value.replace(/\\\\([A-Za-z]+)/g, "\\$1")

const fixDecimalComma = (value: string): string =>
  value
    .replace(/(\d)\{,\s*(\d)/g, "$1{,}$2")
    .replace(/(\d),(\d)/g, "$1{,}$2")

const unwrapCommand = (value: string, command: string): string => {
  const token = `\\${command}{`
  let out = ""
  let i = 0

  while (i < value.length) {
    const start = value.indexOf(token, i)
    if (start === -1) {
      out += value.slice(i)
      break
    }
    out += value.slice(i, start)
    let cursor = start + token.length
    let depth = 1
    while (cursor < value.length && depth > 0) {
      const char = value[cursor]
      if (char === "{") depth += 1
      if (char === "}") depth -= 1
      cursor += 1
    }
    if (depth === 0) {
      out += value.slice(start + token.length, cursor - 1)
      i = cursor
    } else {
      out += value.slice(start)
      break
    }
  }
  return out
}

const stripTag = (value: string): string => {
  return value.replace(/\\tag\*?\{[^}]*\}/g, "")
}
/// new features, latex and math support for functions math expressions, formulas and STEM resources 
const normalizeMathInput = (value: string): string => {
  const normalized = normalizeMathSymbols(value)
  const unescaped = unescapeDoubleBackslashCommands(normalized)
  const fixed = fixDecimalComma(unescaped)
  const unboxed = unwrapCommand(fixed, "boxed")
  return stripTag(unboxed)
}

const sanitizeLatex = (value: string): string => {
  const restored = restoreLatexEscapes(value)
  const trimmed = restored.trim()
  const withoutDelims = trimmed
    .replace(/^\${1,2}/, "")
    .replace(/\${1,2}$/, "")
    .replace(/^\\\(/, "")
    .replace(/\\\)$/, "")
    .replace(/^\\\[/, "")
    .replace(/\\\]$/, "")
  return normalizeMathInput(withoutDelims)
}

const looksLikeMathBlock = (value: string): boolean => {
  const cleaned = value.replace(/\s+/g, " ").trim()
  if (!cleaned) return false
  const hasCommand = /\\[A-Za-z]{2,}/.test(cleaned)
  const hasOperators = /[=+\-*/^_<>]/.test(cleaned)
  if (!hasCommand && !hasOperators) return false
  const withoutTexty = cleaned.replace(
    /\\(?:text|mathrm|mathit|mathbf|mathsf|mathtt|operatorname)\*?\{[^}]*\}/g,
    ""
  )
  const plain = withoutTexty.replace(/\\[A-Za-z]+/g, "")
  const plainWords = plain.match(/[A-Za-z]{3,}/g)
  if (plainWords && plainWords.length > 0) return false
  return true
}

function getMdText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map((part) => getMdText(part)).join("")
  }
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props
    return getMdText(props?.children ?? "")
  }
  return ""
}

const MarkdownSpan: Components["span"] = ({ className, children }) => {
  if (className?.includes("katex-error")) {
    const raw = getMdText(children)
    const sanitized = sanitizeLatex(raw)
    try {
      const html = katex.renderToString(sanitized, {
        throwOnError: false,
        strict: "ignore",
      })
      return <span dangerouslySetInnerHTML={{ __html: html }} />
    } catch {
      return <span className={className}>{children}</span>
    }
  }
  if (hasClassToken(className, "katex-display")) {
    return (
      <span className="assistant-md-katex-frame assistant-md-katex-frame--display">
        <span className={className}>{children}</span>
      </span>
    )
  }
  return <span className={className}>{children}</span>
}

function getLang(className?: string): string {
  if (!className) return "text"
  const got = className.match(/language-([\w-]+)/i)
  return got?.[1]?.toLowerCase() ?? "text"
}

function normalizeMathDelimiters(input: string): string {
  const containsMathEscape = (value: string): boolean => /\\[A-Za-z]/.test(value)

  const hasPlainWord = (value: string): boolean => {
    const isLetter = (char: string) => /[A-Za-z]/.test(char)
    const skipBraceGroup = (input: string, start: number): number => {
      if (input[start] !== "{") return start
      let depth = 0
      let i = start
      while (i < input.length) {
        const char = input[i]
        if (char === "{") depth += 1
        if (char === "}") {
          depth -= 1
          if (depth === 0) return i + 1
        }
        i += 1
      }
      return i
    }

    let i = 0
    let word = ""

    const flushWord = (): boolean => {
      if (word.length >= 3) return true
      word = ""
      return false
    }

    while (i < value.length) {
      const char = value[i]
      if (char === "\\") {
        if (flushWord()) return true
        i += 1
        while (i < value.length && isLetter(value[i])) i += 1
        if (value[i] === "{") {
          i = skipBraceGroup(value, i)
        }
        continue
      }
      if (isLetter(char)) {
        word += char
        i += 1
        continue
      }
      if (flushWord()) return true
      i += 1
    }
    return flushWord()
  }

  const splitInlineCode = (line: string): string[] => line.split(/(`[^`]*`)/g)

  const splitByMathDelimiters = (value: string): Array<{ type: "text" | "math"; value: string }> => {
    const segments: Array<{ type: "text" | "math"; value: string }> = []
    let i = 0
    while (i < value.length) {
      const next = value.indexOf("$", i)
      if (next === -1) {
        segments.push({ type: "text", value: value.slice(i) })
        break
      }
      if (next > 0 && value[next - 1] === "\\") {
        i = next + 1
        continue
      }
      segments.push({ type: "text", value: value.slice(i, next) })
      const isDouble = value[next + 1] === "$"
      const delim = isDouble ? "$$" : "$"
      const close = value.indexOf(delim, next + delim.length)
      if (close === -1) {
        segments.push({ type: "text", value: value.slice(next) })
        break
      }
      segments.push({ type: "math", value: value.slice(next, close + delim.length) })
      i = close + delim.length
    }
    return segments
  }

  const isCommandStart = (value: string, index: number): boolean => {
    if (value[index] !== "\\") return false
    const match = value.slice(index + 1).match(/^[A-Za-z]{2,}/)
    return Boolean(match)
  }

  const stopWords = new Set([
    "and",
    "are",
    "as",
    "because",
    "before",
    "but",
    "by",
    "for",
    "from",
    "if",
    "in",
    "is",
    "like",
    "means",
    "on",
    "or",
    "so",
    "that",
    "the",
    "then",
    "therefore",
    "this",
    "thus",
    "to",
    "was",
    "were",
    "where",
    "which",
    "with",
    "without",
  ])

  const findNextNonSpaceIndex = (value: string, index: number): number => {
    let i = index
    while (i < value.length && value[i] === " ") i += 1
    return i
  }

  const findMathRunEnd = (value: string, start: number): number => {
    let i = start
    let depth = 0
    let sawOperator = false
    while (i < value.length) {
      const char = value[i]
      if (char === "\\") {
        i += 1
        while (i < value.length && /[A-Za-z]/.test(value[i])) i += 1
        continue
      }
      if (char === "{") {
        depth += 1
        i += 1
        continue
      }
      if (char === "}") {
        depth = Math.max(0, depth - 1)
        i += 1
        continue
      }
      if (/[=+\-*/^_]/.test(char)) {
        sawOperator = true
      }
      if (char === "$" || char === "`" || char === "\n") break
      if (depth === 0) {
        if (/[:!?]/.test(char)) {
          const nextIndex = findNextNonSpaceIndex(value, i + 1)
          const nextChar = nextIndex < value.length ? value[nextIndex] : ""
          if (!/\\|\d|[=+\-*/^_{[(]/.test(nextChar)) break
        }
        if (char === "." && (!/\d/.test(value[i - 1] ?? "") || !/\d/.test(value[i + 1] ?? ""))) {
          break
        }
        if (char === " ") {
          const nextIndex = findNextNonSpaceIndex(value, i)
          if (nextIndex >= value.length) {
            i = nextIndex
            break
          }
          const nextChar = value[nextIndex]
          if (/\\|\d|[=+\-*/^_{[(]/.test(nextChar)) {
            i = nextIndex
            continue
          }
          if (/[A-Za-z]/.test(nextChar)) {
            const wordMatch = value.slice(nextIndex).match(/^[A-Za-z]+/)
            if (wordMatch) {
              const word = wordMatch[0].toLowerCase()
              if (word.length >= 3 && stopWords.has(word)) break
              if (!sawOperator && word.length >= 4) break
            }
          }
        }
        if (!/[0-9A-Za-z=+\-*/^_{}()[\].,<>|;]/.test(char)) break
      }
      i += 1
    }
    return i
  }

  const shouldStopForWord = (word: string): boolean => {
    if (!word) return false
    const lower = word.toLowerCase()
    if (stopWords.has(lower)) return true
    return word.length >= 4
  }

  const skipSpacesRight = (value: string, index: number): number => {
    let i = index
    while (i < value.length && value[i] === " ") i += 1
    return i
  }

  const findMathRunStart = (value: string, anchor: number): number => {
    let i = anchor - 1
    let depth = 0
    let word = ""

    const flushWord = (boundaryIndex: number): number | null => {
      if (!word) return null
      if (shouldStopForWord(word)) {
        word = ""
        return skipSpacesRight(value, boundaryIndex + 1)
      }
      word = ""
      return null
    }

    while (i >= 0) {
      const char = value[i]
      if (char === "$" || char === "`" || char === "\n") break
      if (char === "}") {
        depth += 1
        i -= 1
        continue
      }
      if (char === "{") {
        depth = Math.max(0, depth - 1)
        i -= 1
        continue
      }
      if (/[A-Za-z]/.test(char)) {
        word = char + word
        i -= 1
        continue
      }
      const boundary = flushWord(i)
      if (boundary !== null) return boundary
      if (depth === 0) {
        if (/[:!?]/.test(char)) break
        if (char === "." && (!/\d/.test(value[i - 1] ?? "") || !/\d/.test(value[i + 1] ?? ""))) {
          break
        }
      }
      if (!/[0-9=+\-*/^_{}()[\].,<>|\\; ]/.test(char)) break
      i -= 1
    }

    if (word && shouldStopForWord(word)) {
      const boundary = skipSpacesRight(value, i + 1 + word.length)
      return boundary
    }
    return skipSpacesRight(value, i + 1)
  }

  const wrapInlineMathSegments = (value: string): string => {
    if (!containsMathEscape(value)) return value
    let out = ""
    let i = 0
    while (i < value.length) {
      const next = value.indexOf("\\", i)
      if (next === -1) {
        out += value.slice(i)
        break
      }
      if (!isCommandStart(value, next)) {
        out += value.slice(i, next + 1)
        i = next + 1
        continue
      }
      const chunkStart = findMathRunStart(value, next)
      out += value.slice(i, chunkStart)
      const end = findMathRunEnd(value, chunkStart)
      const chunk = value.slice(chunkStart, end)
      const trailingWhitespace = chunk.match(/\s+$/)?.[0] ?? ""
      const core = trailingWhitespace ? chunk.slice(0, -trailingWhitespace.length) : chunk
      if (!core) {
        out += chunk
      } else {
        const normalized = normalizeMathInput(core)
        out += `$${normalized.replace(/\s*\n\s*/g, " ")}$${trailingWhitespace}`
      }
      i = end
    }
    return out
  }

  const replaceExplicitDelimiters = (value: string): string =>
    value
      .replace(/\\\[/g, "$")
      .replace(/\\\]/g, "$")
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$")

  const splitPrefix = (line: string): { prefix: string; content: string } => {
    const match = line.match(/^(\s*(?:>+\s*)?(?:[-*+]\s+|\d+\.\s+)?)(.*)$/)
    if (!match) return { prefix: "", content: line }
    return { prefix: match[1], content: match[2] }
  }

  const splitPrefixParts = (prefix: string): { quotePrefix: string; listPrefix: string } => {
    const match = prefix.match(/^(\s*(?:>+\s*)?)(.*)$/)
    return { quotePrefix: match?.[1] ?? "", listPrefix: match?.[2] ?? "" }
  }

  const normalizeDoubleDollarMathText = (value: string): string =>
    value.includes("$$") ? value.replace(/\$\$([\s\S]*?)\$\$/g, (_match, body) => `$${body}$`) : value

  const isStandaloneMathDelimiterLine = (value: string): boolean => {
    const stripped = value
      .replace(/^\s*(?:>+\s*)?(?:[-*+]\s+|\d+\.\s+)?/, "")
      .trim()
    return stripped === "$" || stripped === "$$"
  }

  const normalizeMathSegment = (segment: string): string => {
    const leading = segment.match(/^\s*/)?.[0] ?? ""
    const trailing = segment.match(/\s*$/)?.[0] ?? ""
    const core = segment.trim()
    if (!core.startsWith("$")) return segment
    const isDouble = core.startsWith("$$")
    const openLen = isDouble ? 2 : 1
    const closeLen = isDouble ? 2 : 1
    if (core.length <= openLen + closeLen) return segment
    const body = core.slice(openLen, core.length - closeLen)
    const normalized = normalizeMathInput(body).replace(/\s*\n\s*/g, " ")
    return `${leading}$${normalized}$${trailing}`
  }

  const separateInlineMathParagraphs = (line: string): string => {
    if (!line.includes("$")) return line
    const { prefix, content } = splitPrefix(line)

    const segments = splitByMathDelimiters(content)
    const hasMath = segments.some((segment) => segment.type === "math")
    if (!hasMath) return line

    const cleanedSegments: Array<{ type: "text" | "math"; value: string }> = []
    for (const segment of segments) {
      if (segment.type === "text") {
        if (!segment.value.trim()) continue
        const trimmed = segment.value
        if (
          /^[\s.,;:!?]+$/.test(trimmed) &&
          cleanedSegments.length > 0 &&
          cleanedSegments[cleanedSegments.length - 1].type === "text"
        ) {
          cleanedSegments[cleanedSegments.length - 1].value += trimmed
        } else {
          cleanedSegments.push({ type: "text", value: trimmed })
        }
      } else {
        cleanedSegments.push(segment)
      }
    }

    const { quotePrefix, listPrefix } = splitPrefixParts(prefix)
    const hasList = listPrefix.length > 0
    const contPrefix = `${quotePrefix}${" ".repeat(listPrefix.length)}`
    const chunks: string[] = []
    let emitted = false

    const emitText = (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      const linePrefix = emitted ? contPrefix : prefix
      chunks.push(`${linePrefix}${trimmed}`)
      emitted = true
    }

    const emitMath = (value: string) => {
      const normalized = normalizeMathSegment(value).trim()
      if (!normalized) return
      const core = normalized.replace(/^\$+/, "").replace(/\$+$/, "").trim()
      if (!core) return
      const fencePrefix = hasList ? contPrefix : prefix
      const fencedMath = `\\(${core}\\)`

      if (!emitted && hasList) {
        const listLine = `${quotePrefix}${listPrefix}`.trimEnd()
        const block = `${listLine}\n${fencePrefix}\`\`\`latex\n${fencePrefix}${fencedMath}\n${fencePrefix}\`\`\``
        chunks.push(block)
        emitted = true
        return
      }

      const block = `${fencePrefix}\`\`\`latex\n${fencePrefix}${fencedMath}\n${fencePrefix}\`\`\``
      chunks.push(block)
      emitted = true
    }

    for (const segment of cleanedSegments) {
      if (segment.type === "math") {
        emitMath(segment.value)
      } else {
        emitText(segment.value)
      }
    }

    return chunks.length ? chunks.join("\n\n") : line
  }

  const forceWrapMathLine = (line: string): string | null => {
    if (line.includes("`")) return null
    const { prefix, content } = splitPrefix(line)
    const trimmed = content.trim()
    if (!trimmed) return null
    if (!containsMathEscape(trimmed)) return null
    if (hasPlainWord(trimmed)) return null

    const cleaned = trimmed
      .replace(/\$\$/g, "")
      .replace(/\$/g, "")
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "")
      .replace(/\\\(/g, "")
      .replace(/\\\)/g, "")
    const normalized = normalizeMathInput(cleaned).replace(/\s*\n\s*/g, " ")
    return `${prefix}$${normalized}$`
  }

  const wrapStandaloneLine = (line: string): string => {
    if (line.includes("`")) return line
    const { prefix, content } = splitPrefix(line)
    const trimmed = content.trim()
    if (!trimmed) return line
    if (trimmed.startsWith("$") || trimmed.startsWith("$$") || trimmed.includes("$")) return line
    if (!containsMathEscape(trimmed)) return line
    if (hasPlainWord(trimmed)) return line

    const normalized = normalizeMathInput(trimmed).replace(/\s*\n\s*/g, " ")
    return `${prefix}$${normalized}$`
  }

  const processTextPart = (part: string): string => {
    const withDelims = replaceExplicitDelimiters(part)
    const segments = splitByMathDelimiters(withDelims)
    return segments
      .map((segment) =>
        segment.type === "math" ? normalizeMathSegment(segment.value) : wrapInlineMathSegments(segment.value)
      )
      .join("")
  }

  const ensureMathWrapped = (line: string): string => {
    if (!containsMathEscape(line)) return line
    const segments = splitByMathDelimiters(line)
    let changed = false
    const out = segments
      .map((segment) => {
        if (segment.type !== "text") return segment.value
        if (!containsMathEscape(segment.value)) return segment.value
        const trimmed = segment.value.trim()
        if (!trimmed) return segment.value
        changed = true
        const normalized = normalizeMathInput(trimmed).replace(/\s*\n\s*/g, " ")
        return segment.value.replace(trimmed, `$${normalized}$`)
      })
      .join("")
    return changed ? out : line
  }

  const processLine = (line: string): string => {
    const forced = forceWrapMathLine(line)
    if (forced) return separateInlineMathParagraphs(forced)
    if (line.includes("`")) {
      const parts = splitInlineCode(line)
      return parts
        .map((part) =>
          part.startsWith("`") && part.endsWith("`")
            ? part
            : processTextPart(normalizeDoubleDollarMathText(part))
        )
        .join("")
    }

    const normalized = normalizeDoubleDollarMathText(line)
    const standalone = wrapStandaloneLine(normalized)
    const base = standalone !== normalized ? standalone : normalized
    const processed = processTextPart(base)
    return separateInlineMathParagraphs(ensureMathWrapped(processed))
  }

  const withEscapes = restoreLatexEscapes(input)
  const lines = withEscapes.split("\n")
  const outLines: string[] = []
  let inFence = false
  let fence = ""

  for (const line of lines) {
    const fenceMatch = line.match(/^```+/)
    if (fenceMatch) {
      if (!inFence) {
        inFence = true
        fence = fenceMatch[0]
      } else if (line.startsWith(fence)) {
        inFence = false
        fence = ""
      }
      outLines.push(line)
      continue
    }
    if (inFence) {
      outLines.push(line)
      continue
    }
    const processed = processLine(line)
    const splitProcessed = processed.split("\n")
    for (const nextLine of splitProcessed) {
      if (isStandaloneMathDelimiterLine(nextLine)) continue
      outLines.push(nextLine)
    }
  }

  return outLines.join("\n")
}

function isCompactCodeBlock(rawCode: string): boolean {
  if (!rawCode) return false
  if (rawCode.includes("\n")) return false
  return rawCode.length <= 72
}

export const AssistantMarkdown = memo(function AssistantMarkdown({ getjson, cpbtn_markdown }: AssistantMarkdownProps) {
  const parseMD = useMemo(() => normalizeMathDelimiters(getjson.replace(/\r\n/g, "\n")), [getjson])

  const renderMD = useMemo<Components>(() => ({
    h1: ({ children }) => <h1 className="assistant-md-heading assistant-md-h1">{children}</h1>,
    h2: ({ children }) => <h2 className="assistant-md-heading assistant-md-h2">{children}</h2>,
    h3: ({ children }) => <h3 className="assistant-md-heading assistant-md-h3">{children}</h3>,
    h4: ({ children }) => <h4 className="assistant-md-heading assistant-md-h4">{children}</h4>,
    h5: ({ children }) => <h5 className="assistant-md-heading assistant-md-h5">{children}</h5>,
    h6: ({ children }) => <h6 className="assistant-md-heading assistant-md-h6">{children}</h6>,
    p: ({ children }) => {
      const raw = getMdText(children)
      if (looksLikeMathBlock(raw)) {
        const sanitized = sanitizeLatex(raw)
        try {
          const html = katex.renderToString(sanitized, {
            displayMode: true,
            throwOnError: false,
            strict: "ignore",
          })
          return (
            <div className="assistant-md-p">
              <span
                className="assistant-md-katex-frame assistant-md-katex-frame--display"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          )
        } catch {
          return <p className="assistant-md-p">{children}</p>
        }
      }
      return <p className="assistant-md-p">{children}</p>
    },
    span: MarkdownSpan,
    a: ({ href, children }) => (
      <a
        href={href}
        className="assistant-md-link"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    strong: ({ children }) => <strong className="assistant-md-strong">{children}</strong>,
    em: ({ children }) => <em className="assistant-md-em">{children}</em>,
    blockquote: ({ children }) => (
      <blockquote className="assistant-md-quote">{children}</blockquote>
    ),
    ul: ({ children }) => <ul className="assistant-md-list-ul">{children}</ul>,
    ol: ({ children }) => <ol className="assistant-md-list-ol">{children}</ol>,
    li: ({ children, className }) => {
      if (className?.includes("task-list-item")) {
        return <li className="assistant-md-task-item">{children}</li>
      }
      return <li>{children}</li>
    },
    table: ({ children }) => (
      <div className="assistant-md-table-wrap">
        <table className="assistant-md-table">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="assistant-md-thead">{children}</thead>,
    tbody: ({ children }) => <tbody className="assistant-md-tbody">{children}</tbody>,
    tr: ({ children }) => <tr className="assistant-md-tr">{children}</tr>,
    th: ({ children }) => <th className="assistant-md-th">{children}</th>,
    td: ({ children }) => <td className="assistant-md-td">{children}</td>,
    hr: () => <hr className="assistant-md-hr" />,
    code: (props) => {
      const className = props.className
      const children = props.children
      const isInline = "inline" in props && Boolean((props as { inline?: boolean }).inline)

      if (isInline) {
        return <code className="assistant-md-inline-code">{children}</code>
      }

      const lang = getLang(className)
      const rawCode = getMdText(children).replace(/\n$/, "")
      const compactBlock = isCompactCodeBlock(rawCode)

      const isLatexLang = ["latex", "math", "tex"].includes(lang)
      if (isLatexLang) {
        const sanitized = sanitizeLatex(rawCode)
        if (sanitized) {
          try {
            const html = katex.renderToString(sanitized, {
              displayMode: true,
              throwOnError: false,
              strict: "ignore",
              trust: true,
            })
            return (
              <div className="assistant-md-latex-block">
                <div className="assistant-md-latex-block__head">
                  <span className="assistant-md-latex-block__lang">{lang}</span>
                  <button
                    type="button"
                    className="assistant-md-latex-block__copy-btn"
                    onClick={() => void cpbtn_markdown(rawCode)}
                    aria-label="Copy latex block"
                    title="Copy latex block"
                  >
                    Copy
                  </button>
                </div>
                <div className="assistant-md-latex-block__content">
                  <div
                    className="assistant-md-latex-block__math"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              </div>
            )
          } catch {
            // fall through to the default rendering to preserve copy button
          }
        }
      }

      if (compactBlock) {
        return (
          <button
            type="button"
            className="assistant-md-inline-code assistant-md-inline-code-btn"
            onClick={() => void cpbtn_markdown(rawCode)}
            aria-label={`Copy ${lang} snippet`}
            title="Copy snippet"
          >
            {rawCode}
          </button>
        )
      }

      return (
        <div className="cpbtn_markdown_wrap">
          <div className="cpbtn_markdown_head">
            <span className="cpbtn_markdown_lang">{lang}</span>
            <button
              type="button"
              className="cpbtn_markdown_btn"
              onClick={() => void cpbtn_markdown(rawCode)}
              aria-label="Copy code block"
              title="Copy code block"
            >
              Copy
            </button>
          </div>
          <pre className="cpbtn_markdown_pre">
            <code className={`cpbtn_markdown_code ${className ?? ""}`}>
              {children}
            </code>
          </pre>
        </div>
      )
    },
  }), [cpbtn_markdown])

  return (
    <div className="assistant-md-root">
      <ReactMarkdown
        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }], remarkGfm]}
        rehypePlugins={[
          rehypeHighlight,
          [rehypeKatex, { throwOnError: false, strict: "ignore", trust: true }],
        ]}
        components={renderMD}
      >
        {parseMD}
      </ReactMarkdown>
    </div>
  )
})
