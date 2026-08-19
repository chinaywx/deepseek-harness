// DetailsPanel: the details dock occupant. The dock hosts studio panels
// (Design, PPT, …) contributed through the `details.studio` slot ledger as
// tabs; the first panel is the default view. The active panel is a
// per-session observable shared with the composer command path (`/design`,
// `/ppt` wake-up). With no studio plugin composed in, the dock shows an
// empty state — tool-call details intentionally live in the message flow's
// inline row expansion, not here.

import { useState, useSyncExternalStore } from 'react'
import type { DetailsSlotProps } from '../contract/slots.ts'
import css from './DetailsPanel.module.css'

/** Full props composed by reference from the contract (automatic shares & injected share). */
export type DetailsPanelProps = DetailsSlotProps

export function DetailsPanel({
  renderSlot, closeDetails, studioViews, setStudio, useStudio, t,
}: DetailsSlotProps) {
  useSyncExternalStore(studioViews.subscribe, studioViews.version)
  const studioTabs = studioViews.list()
  const activeStudioId = useStudio(s => s)
  // Default to the first panel; a stale id (plugin composed out) lands there too.
  const activeStudio = studioTabs.find(tab => tab.id === activeStudioId) ?? studioTabs[0]
  const hasStudio = studioTabs.length > 0

  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className={css.root}>
      <div className={css.header}>
        {hasStudio ? (
          <div className={css.tabs} role="tablist">
            {studioTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === activeStudio?.id}
                className={css.tab}
                data-active={tab.id === activeStudio?.id || undefined}
                onClick={() => { setStudio(tab.id) }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className={css.title}>{t('details.panels')}</div>
        )}
        <div className={css.headerActions}>
          {activeStudio !== undefined && (
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
        {activeStudio !== undefined
          ? (
            <div className={css.studioBody}>
              {renderSlot('details.studio', { refreshKey }, { only: activeStudio.id })}
            </div>
          )
          : <div className={css.empty}>{t('details.noPanels')}</div>}
      </div>
    </div>
  )
}
