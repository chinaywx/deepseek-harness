// @vitest-environment jsdom

/** DetailsPanel studio dock tabs + DetailsToggleButton behavior tests. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  createSnapshotStore, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSnapshot, SessionId, SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionProviderComponent } from '@deepseek-ai/dsh-client-ui-slots'
import type { DetailsSlotProps, DetailsStudioOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { DetailsPanel } from '../src/client/skeleton/DetailsPanel.tsx'
import { DetailsToggleButton } from '../src/client/skeleton/DetailsToggle.tsx'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh, commonZh)

afterEach(() => { cleanup() })

const SID = 's1' as SessionId

/** Minimal framework seat for direct DetailsPanel host tests. */
const SessionProviderStub: SessionProviderComponent = ({ children }) => children(SID)

const STUDIO_TABS = [{ id: 'ppt', label: 'PPT' }, { id: 'design', label: 'Design' }]

/** Two-entry studio ledger, as projected from the details.studio slot. */
const studioViews: DetailsSlotProps['studioViews'] = {
  list: () => STUDIO_TABS,
  subscribe: () => () => {},
  version: () => 0,
}

const emptyStudioViews: DetailsSlotProps['studioViews'] = {
  list: () => [],
  subscribe: () => () => {},
  version: () => 0,
}

interface StudioCall {
  owner: DetailsStudioOwnerProps
  only: string | undefined
}

function snapshotBase(): ConversationSnapshot {
  return {
    sessionId: SID, views: EMPTY_CONVERSATION_VIEWS, chat: EMPTY_CHAT_SNAPSHOT,
    nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [],
    pending: [], queue: [], running: false, composerPhase: 'active', removed: false, openState: 'open', openError: null,
    hasMore: false, loadingOlder: false, promptError: null, blank: false, subagent: null, lastAgentError: null,
  }
}

function mountDock(studioId: string | null, views: DetailsSlotProps['studioViews'] = studioViews) {
  const snap = snapshotBase()
  const studio = createSnapshotStore<string | null>(studioId)
  const calls: StudioCall[] = []
  const renderSlot: DetailsSlotProps['renderSlot'] = (_key, owner, options) => {
    calls.push({ owner: owner as DetailsStudioOwnerProps, only: (options as { only?: string } | undefined)?.only })
    return <div data-testid="studio-seat" />
  }
  const view = render(
    <DetailsPanel
      SessionProvider={SessionProviderStub}
      renderSlot={renderSlot}
      sessionId={SID}
      useSession={bindSnapshotSelector({ getSnapshot: () => snap, subscribe: () => () => {} })}
      useSessions={bindSnapshotSelector(createSnapshotStore<SessionListState>(
        { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined }))}
      useWorkspaces={bindSnapshotSelector(createSnapshotStore<WorkspaceListState>({
        items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
        baselinesReady: true, recentWorkspaceId: undefined,
      }))}
      useProjection={(() => undefined)}
      useInput={(() => { throw new Error('unused') })}
      inputActions={{ setDraft: () => {}, addImages: () => true, removeImage: () => {}, pruneImages: () => {}, submit: () => {} }}
      closeDetails={vi.fn()}
      openDetails={vi.fn()}
      studioViews={views}
      setStudio={(id) => { studio.set(id) }}
      useStudio={bindSnapshotSelector(studio)}
      t={t}
    />,
  )
  return { view, calls, studio }
}

describe('DetailsPanel studio dock', () => {
  it('renders one tab per studio panel and shows the first panel by default', () => {
    const { view, calls } = mountDock(null)
    const tabs = view.getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual(['PPT', 'Design'])
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    expect(view.getByTestId('studio-seat')).toBeTruthy()
    expect(calls.at(-1)).toEqual({ owner: { refreshKey: 0 }, only: 'ppt' })
  })

  it('clicking a studio tab writes the selection and renders that panel through details.studio', () => {
    const { view, calls, studio } = mountDock(null)
    fireEvent.click(view.getByRole('tab', { name: 'Design' }))
    expect(studio.getSnapshot()).toBe('design')
    expect(calls.at(-1)?.only).toBe('design')
  })

  it('the refresh button bumps the refreshKey owner currency of the active studio panel', () => {
    const { view, calls } = mountDock('design')
    expect(calls.at(-1)).toEqual({ owner: { refreshKey: 0 }, only: 'design' })
    fireEvent.click(view.getByRole('button', { name: '刷新' }))
    expect(calls.at(-1)).toEqual({ owner: { refreshKey: 1 }, only: 'design' })
  })

  it('a stale studio id (plugin composed out) falls back to the first panel', () => {
    const { view, calls } = mountDock('ghost')
    expect(view.getByRole('tab', { name: 'PPT' }).getAttribute('aria-selected')).toBe('true')
    expect(calls.at(-1)?.only).toBe('ppt')
  })

  it('the fullscreen toggle covers the window and Esc or ✕ exits it', () => {
    const { view } = mountDock(null)
    const root = () => view.container.firstChild as HTMLElement
    expect(root().getAttribute('data-fullscreen')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: '全屏' }))
    expect(root().getAttribute('data-fullscreen')).toBe('true')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(root().getAttribute('data-fullscreen')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: '全屏' }))
    fireEvent.click(view.getByRole('button', { name: '关闭面板' }))
    expect(root().getAttribute('data-fullscreen')).toBeNull()
  })

  it('with no studio plugin composed in, the dock shows its empty state', () => {
    const { view } = mountDock(null, emptyStudioViews)
    expect(view.queryAllByRole('tab')).toHaveLength(0)
    expect(view.getByText('暂无可用面板')).toBeTruthy()
    expect(view.queryByRole('button', { name: '刷新' })).toBeNull()
  })
})

describe('DetailsToggleButton', () => {
  it('opens the details panel on click', () => {
    const openDetails = vi.fn()
    const view = render(
      <DetailsToggleButton
        sessionId={SID}
        useSession={bindSnapshotSelector({ getSnapshot: () => snapshotBase(), subscribe: () => () => {} })}
        useSessions={bindSnapshotSelector(createSnapshotStore<SessionListState>(
          { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined }))}
        useWorkspaces={bindSnapshotSelector(createSnapshotStore<WorkspaceListState>({
          items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
          baselinesReady: true, recentWorkspaceId: undefined,
        }))}
        useProjection={(() => undefined)}
        useInput={(() => { throw new Error('unused') })}
        inputActions={{ setDraft: () => {}, addImages: () => true, removeImage: () => {}, pruneImages: () => {}, submit: () => {} }}
        openDetails={openDetails}
        t={t}
      />,
    )
    fireEvent.click(view.getByRole('button', { name: '打开面板' }))
    expect(openDetails).toHaveBeenCalledTimes(1)
  })
})
