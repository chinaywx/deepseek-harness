// DetailsPanel: right-column content that shows either the selected tool call
// details or studio views (Design/PPT). Studio views are selected through the
// shared chat store's active view id and rendered from the `details.studio`
// slot; the panel keeps its own refresh key so a refresh button can remount the
// active studio iframe.

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { shallowEqual } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSnapshot, RunningToolCall, ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { DetailsSlotProps } from '../contract/slots.ts'
import type { ViewTab } from '../contract/views.ts'
import { findToolCall } from '../chat/tool-node-reader.ts'
import css from './DetailsPanel.module.css'

/** Full props composed by reference from the contract (automatic shares & injected share). */
export type DetailsPanelProps = DetailsSlotProps

const STUDIO_VIEW_SUFFIX = '-studio'

/** Studio views are rendered in the details panel instead of the main tab ring. */
function isStudioView(viewTab: ViewTab): boolean {
  return viewTab.id.endsWith(STUDIO_VIEW_SUFFIX)
}

/**
 * Selected call material: the call's display name and args plus the frozen
 * block slice it came from. `block` is a snapshot-cached reference, so the
 * wrapper stays shallow-equal across unrelated snapshot frames; the settled /
 * running split is read off it with the `'kind' in block` discrimination
 * instead of duplicated as flags.
 */
interface CallMaterial {
  name: string
  argsRaw: string | null
  block: ToolCallBlock
}

/** Material of a settled result node (native call or run_code sub-dispatch). */
function settledMaterial(node: ToolResultNode, callId: string): CallMaterial {
  return { name: node.call?.name ?? callId, argsRaw: node.call?.argsRaw ?? null, block: node }
}

/** Material of an in-flight call (native call or run_code sub-dispatch). */
function runningMaterial(call: RunningToolCall): CallMaterial {
  return { name: call.name, argsRaw: call.argsRaw, block: call }
}

function materialFor(s: ConversationSnapshot, callId: string): CallMaterial | null {
  const found = findToolCall(s, callId)
  if (found === undefined) return null
  return 'kind' in found ? settledMaterial(found, callId) : runningMaterial(found)
}

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    // Not JSON (streaming fragment or plain text): show verbatim.
    return raw
  }
}

/** Flatten a settled result for the no-ui-tool fallback. */
function rawResultText(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  const parts = block.content.map(item => item.type === 'text' ? item.text : JSON.stringify(item, null, 2))
  if (parts.length === 0 && block.error !== undefined) parts.push(`${block.error.name}: ${block.error.code}`)
  return parts.join('\n')
}

export function DetailsPanel({
  useSession, useSessions, sessionId, useStore, actions, renderSlot,
  openDetails, closeDetails, views, t,
}: DetailsSlotProps) {
  useSyncExternalStore(views.subscribe, views.version)
  const studioTabs = views.list().filter(isStudioView)
  const selectedId = useStore(s => s.view)
  const activeStudio = studioTabs.find(viewTab => viewTab.id === selectedId)
  const hasStudio = studioTabs.length > 0

  // Open the details panel once when studio views first appear, and keep the
  // first studio selected by default so the tab bar is never inert.
  const openedOnce = useRef(false)
  useEffect(() => {
    if (!hasStudio) {
      openedOnce.current = false
      return
    }
    if (activeStudio === undefined) {
      const first = studioTabs[0]
      if (first !== undefined) actions.setView(first.id)
    }
    if (!openedOnce.current) {
      openedOnce.current = true
      openDetails()
    }
  }, [hasStudio, activeStudio, actions, openDetails, studioTabs])

  const selection = useStore(s => s.selection)
  // Session workspace root: an omitted or relative terminal cwd resolves
  // against it, which the pure presenter cannot see.
  const sessionCwd = useSessions(list => list.byId[sessionId]?.cwd)
  const callId = selection?.callId
  // materialFor builds a fresh wrapper; shallowEqual short-circuits on its
  // stable members (result node reference rides the snapshot's structural sharing).
  const material = useSession(
    s => (callId === undefined ? null : materialFor(s, callId)),
    (a, b) => shallowEqual(a, b))

  const [refreshKey, setRefreshKey] = useState(0)

  const showStudio = activeStudio !== undefined

  return (
    <div className={css.root}>
      <div className={css.header}>
        {hasStudio ? (
          <div className={css.tabs} role="tablist">
            {studioTabs.map(viewTab => (
              <button
                key={viewTab.id}
                type="button"
                role="tab"
                aria-selected={viewTab.id === activeStudio?.id}
                className={css.tab}
                data-active={viewTab.id === activeStudio?.id || undefined}
                onClick={() => { actions.setView(viewTab.id) }}
              >
                {viewTab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className={css.title}>
            {selection === null ? t('details.title') : material?.name ?? selection.toolName ?? t('details.title')}
          </div>
        )}
        <div className={css.headerActions}>
          {showStudio && (
            <button
              type="button"
              className={css.refresh}
              aria-label={t('details.refresh')}
              onClick={() => { setRefreshKey(k => k + 1) }}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path
                  d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 4.5V8h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <button
            type="button" className={css.close} aria-label={t('details.close')}
            onClick={() => { closeDetails() }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className={css.body}>
        {showStudio
          ? (
            <div className={css.studioBody}>
              {renderSlot('details.studio', { refreshKey }, { only: activeStudio.id })}
            </div>
          )
          : selection === null || callId === undefined
            ? <div className={css.empty}>{t('details.empty')}</div>
            : material === null
              ? <div className={css.empty}>{t('details.notInWindow')}</div>
              : (
                <>
                  {material.argsRaw !== null && (
                    <section className={css.section}>
                      <div className={css.sectionLabel}>{t('details.input')}</div>
                      <CodeBlock code={pretty(material.argsRaw)} lang="json" copyLabel={t('copy')} copiedLabel={t('copied')} />
                    </section>
                  )}
                  <section className={css.section}>
                    <div className={css.sectionLabel}>{t('details.output')}</div>
                    {/* Keyed by the selected call: the body owns per-call view
                        state (the terminal card's expand and copy), which React
                        would otherwise carry into the next selection because the
                        panel does not unmount between calls. */}
                    <Fragment key={callId}>
                      {renderSlot('conversation.details.tool', { block: material.block, cwd: sessionCwd }, {
                        fallback: 'kind' in material.block
                          ? (
                            <pre className={css.code} data-error={material.block.isError || undefined}>
                              {rawResultText(material.block)}
                            </pre>
                          )
                          : <div className={css.empty}>{t('details.running')}</div>,
                      })}
                    </Fragment>
                  </section>
                </>
              )}
      </div>
    </div>
  )
}
