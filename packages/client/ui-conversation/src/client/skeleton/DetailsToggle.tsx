// DetailsToggleButton: the details-dock opener in the session header
// utilities row. Owned by ui-conversation (not by any studio plugin) so the
// dock stays reachable — showing its empty details state — even when no
// studio plugin is composed in.

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DetailsToggleInjected } from '../contract/slots.ts'
import css from './DetailsToggle.module.css'

/** Full props: runtime share of the header-utilities seat + injected opener + locale. */
export type DetailsToggleProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<DetailsToggleInjected>
  & PropsLocale<'conversation'>

export function DetailsToggleButton({ openDetails, t }: DetailsToggleProps) {
  return (
    <button
      type="button"
      className={css.toggle}
      aria-label={t('details.open')}
      title={t('details.open')}
      onClick={() => { openDetails() }}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10 2.5v11" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </button>
  )
}
