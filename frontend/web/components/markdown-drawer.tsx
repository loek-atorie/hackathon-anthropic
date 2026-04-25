"use client";

import { useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GraphNode, GraphNodeType } from "@/lib/vault-reader";
import { NODE_COLORS, NODE_TYPE_LABELS } from "./force-graph";

interface MarkdownDrawerProps {
  node: GraphNode | null;
  /** All known node ids — used to detect dangling wikilinks. */
  knownIds: ReadonlySet<string>;
  onClose: () => void;
  onWikilinkClick: (id: string) => void;
}

/**
 * Pre-processes a markdown body so that [[wikilinks]] become regular links
 * `[label](#wikilink:id)` that we can intercept inside react-markdown.
 */
function preprocessWikilinks(body: string): string {
  return body.replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (match, id, label) => {
    const target = String(id).trim();
    if (!target) return match;
    const text = (label ?? id).trim();
    return `[${text}](#wikilink:${encodeURIComponent(target)})`;
  });
}

function decodeWikilinkHref(href: string | undefined): string | null {
  if (!href || !href.startsWith("#wikilink:")) return null;
  try {
    return decodeURIComponent(href.slice("#wikilink:".length));
  } catch {
    return null;
  }
}

function formatFrontmatterValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-[var(--muted-2)]">—</span>;
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-full border border-[var(--border-strong)] bg-[var(--background-elev)] px-2 py-0.5 text-xs text-[var(--foreground)]"
          >
            {String(v).replace(/^\[\[|\]\]$/g, "")}
          </span>
        ))}
      </div>
    );
  }
  const str = String(value);
  // Strip wrapping [[wikilink]] for cleaner display.
  const stripped = str.replace(/^\[\[(.+)\]\]$/, "$1");
  return <span className="font-mono text-sm text-[var(--foreground)]">{stripped}</span>;
}

function typeBadge(type: GraphNodeType) {
  const color = NODE_COLORS[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em]"
      style={{
        borderColor: color,
        color: color,
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
      {NODE_TYPE_LABELS[type]}
    </span>
  );
}

export function MarkdownDrawer({ node, knownIds, onClose, onWikilinkClick }: MarkdownDrawerProps) {
  // ESC to close.
  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  const processedBody = useMemo(
    () => (node ? preprocessWikilinks(node.body) : ""),
    [node],
  );

  const isOpen = node !== null;

  return (
    <>
      {/* Backdrop / click-outside catcher. Subtle — we don't want to obscure
          the graph behind, just let users click anywhere outside the panel. */}
      {isOpen && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200"
        />
      )}

      <aside
        role="dialog"
        aria-label={node?.label ?? "Detail"}
        aria-hidden={!isOpen}
        className={[
          "fixed right-0 top-0 z-40 flex h-full w-full max-w-[480px] flex-col border-l border-[var(--border)] bg-[var(--background-elev)] shadow-[0_0_60px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {node && (
          <>
            {/* Header */}
            <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
              <div className="flex flex-col gap-2">
                {typeBadge(node.type)}
                <h2 className="font-mono text-lg font-medium tracking-tight text-[var(--foreground)]">
                  {node.label}
                </h2>
                <span className="text-[11px] text-[var(--muted-2)]">{node.path}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Sluiten"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--background-card)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {/* Frontmatter section */}
              <section className="border-b border-[var(--border)] px-6 py-5">
                <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                  Metagegevens
                </h3>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2.5">
                  {Object.entries(node.frontmatter).map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                        {key}
                      </dt>
                      <dd className="min-w-0 break-words text-sm text-[var(--foreground)]">
                        {formatFrontmatterValue(value)}
                      </dd>
                    </div>
                  ))}
                  {Object.keys(node.frontmatter).length === 0 && (
                    <div className="col-span-2 text-sm italic text-[var(--muted-2)]">
                      Geen frontmatter
                    </div>
                  )}
                </dl>
              </section>

              {/* Body */}
              <section className="prose-scammer px-6 py-5">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children, ...rest }) => {
                      const wid = decodeWikilinkHref(href);
                      if (wid !== null) {
                        const exists = knownIds.has(wid);
                        if (!exists) {
                          return (
                            <span
                              className="inline-flex items-center rounded-md border border-dashed border-[var(--border-strong)] px-1.5 py-0.5 align-middle font-mono text-[12px] text-[var(--muted-2)]"
                              title="Onbekende node"
                            >
                              {children}
                            </span>
                          );
                        }
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              onWikilinkClick(wid);
                            }}
                            className="inline-flex items-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-1.5 py-0.5 align-middle font-mono text-[12px] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]"
                          >
                            {children}
                          </button>
                        );
                      }
                      return (
                        <a href={href} {...rest}>
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {processedBody}
                </ReactMarkdown>
              </section>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
