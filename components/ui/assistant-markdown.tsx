"use client"

import { memo, useMemo, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import type { Components } from "react-markdown"

interface AssistantMarkdownProps {
  getjson: string
  cpbtn_markdown: (text: string) => void | Promise<void>
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

export const AssistantMarkdown = memo(function AssistantMarkdown({ getjson, cpbtn_markdown }: AssistantMarkdownProps) {
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
