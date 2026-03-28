"use client"

import { memo, useMemo, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import katex from "katex"
import type { Components } from "react-markdown"

interface AssistantMarkdownProps {
  getjson: string
  cpbtn_markdown: (text: string) => void | Promise<void>
}

const latexMds = (value: string) =>
  value
    .replace(/\u0008/g, "\\b")
    .replace(/\u0009/g, "\\t")
    .replace(/\u000b/g, "\\v")
    .replace(/\u000c/g, "\\f")
    .replace(/\u000d/g, "\\r")

const formatMath = (value: string) =>
  value
    .replace(/⟹/g, "\\Longrightarrow")
    .replace(/⟸/g, "\\Longleftarrow")
    .replace(/⟺/g, "\\Longleftrightarrow")
    .replace(/∘/g, "\\circ")
    .replace(/×/g, "\\times")
    .replace(/·/g, "\\cdot")

const formatBackslash = (value: string): string =>
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

const stripTag = (value: string): string => value.replace(/\\tag\*?\{[^}]*\}/g, "")

const normalizeMathInput = (value: string): string => {
  const normalized = formatMath(value)
  const unescaped = formatBackslash(normalized)
  const fixed = fixDecimalComma(unescaped)
  const unboxed = unwrapCommand(fixed, "boxed")
  return stripTag(unboxed)
}

const sanitizeLatex = (value: string): string => {
  const restored = latexMds(value)
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

function getLang(className?: string): string {
  if (!className) return "text"
  const got = className.match(/language-([\w-]+)/i)
  return got?.[1]?.toLowerCase() ?? "text"
}

function isCompactCodeBlock(rawCode: string): boolean {
  if (!rawCode) return false
  if (rawCode.includes("\n")) return false
  return rawCode.length <= 72
}

export const AssistantMarkdown = memo(function AssistantMarkdown({
  getjson,
  cpbtn_markdown,
}: AssistantMarkdownProps) {
  const parseMD = useMemo(() => getjson.replace(/\r\n/g, "\n"), [getjson])

  const renderMD = useMemo<Components>(() => ({
    h1: ({ children }) => <h1 className="assistant-md-heading assistant-md-h1">{children}</h1>,
    h2: ({ children }) => <h2 className="assistant-md-heading assistant-md-h2">{children}</h2>,
    h3: ({ children }) => <h3 className="assistant-md-heading assistant-md-h3">{children}</h3>,
    h4: ({ children }) => <h4 className="assistant-md-heading assistant-md-h4">{children}</h4>,
    h5: ({ children }) => <h5 className="assistant-md-heading assistant-md-h5">{children}</h5>,
    h6: ({ children }) => <h6 className="assistant-md-heading assistant-md-h6">{children}</h6>,
    p: ({ children }) => <p className="assistant-md-p">{children}</p>,
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

      if (lang === "latex") {
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
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={renderMD}
      >
        {parseMD}
      </ReactMarkdown>
    </div>
  )
})
