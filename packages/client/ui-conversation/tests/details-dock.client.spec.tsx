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
import { createChatStore } from '../src/client/stores.ts'
import { DetailsPanel } from '../src/client/skeleton/DetailsPanel.tsx'
import { DetailsToggleButton } from '../src/client/skeleton/DetailsToggle.tsx'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh, commonZh)

afterEach(() => { cleanup() })

const SID = 's1' as SessionId

/** Minimal framework seat for direct DetailsPanel host tests. */
const SessionProviderStub: SessionProviderComponent = ({ children }) => children(SID)

const STUDIO_TABS = [{ id: 'design', label: 'Design' }, { id: 'ppt', label: 'PPT' }]

/** Two-entry studio ledger, as projected from the details.studio slot. */
const studioViews: DetailsSlotProps['studioViews'] = {
  list: () => STUDIO_TABS,
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

function mountDock(studioId: string | null) {
  const snap = snapshotBase()
  const chat = createChatStore().create()
  const studio = createSnapshotStore<string | null>(studioId)
  const calls: StudioCall[] = []
  const renderSlot: DetailsSlotProps['renderSlot'] = (key, owner, options) => {
    if (key === 'details.studio') {
      calls.push({ owner: owner as DetailsStudioOwnerProps, only: (options as { only?: string } | undefined)?.only })
      return <div data-testid="studio-seat" />
    }
    return <div data-testid="tool-details-seat" />
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
      useStore={bindSnapshotSelector(chat)}
      actions={chat.actions}
      openDetails={vi.fn()}
      closeDetails={vi.fn()}
      studioViews={studioViews}
      setStudio={(id) => { studio.set(id) }}
      useStudio={bindSnapshotSelector(studio)}
      t={t}
    />,
  )
  return { view, calls, studio }
}

describe('DetailsPanel studio dock', () => {
  it('renders the built-in 详情 tab plus one tab per studio panel, 详情 active by default', () => {
    const { view } = mountDock(null)
    const tabs = view.getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual(['详情', 'Design', 'PPT'])
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    // No tool-call selection: the details empty guidance shows.
    expect(view.getByText('点击消息流中的工具行查看详情')).toBeTruthy()
    expect(view.queryByTestId('studio-seat')).toBeNull()
  })

  it('clicking a studio tab writes the selection and renders that panel through details.studio', () => {
    const { view, calls, studio } = mountDock(null)
    fireEvent.click(view.getByRole('tab', { name: 'PPT' }))
    expect(studio.getSnapshot()).toBe('ppt')
    expect(view.getByTestId('studio-seat')).toBeTruthy()
    expect(calls.at(-1)?.only).toBe('ppt')
    // And the 详情 tab returns the dock to the tool-details view.
    fireEvent.click(view.getByRole('tab', { name: '详情' }))
    expect(studio.getSnapshot()).toBe(null)
    expect(view.queryByTestId('studio-seat')).toBeNull()
  })

  it('the refresh button bumps the refreshKey owner currency of the active studio panel', () => {
    const { view, calls } = mountDock('design')
    expect(view.getByTestId('studio-seat')).toBeTruthy()
    expect(calls.at(-1)).toEqual({ owner: { refreshKey: 0 }, only: 'design' })
    fireEvent.click(view.getByRole('button', { name: '刷新' }))
    expect(calls.at(-1)).toEqual({ owner: { refreshKey: 1 }, only: 'design' })
  })

  it('a stale studio id (plugin composed out) falls back to the 详情 tab', () => {
    const { view } = mountDock('ghost')
    expect(view.getByRole('tab', { name: '详情' }).getAttribute('aria-selected')).toBe('true')
    expect(view.queryByTestId('studio-seat')).toBeNull()
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
    fireEvent.click(view.getByRole('button', { name: '打开详情面板' }))
    expect(openDetails).toHaveBeenCalledTimes(1)
  })
})
