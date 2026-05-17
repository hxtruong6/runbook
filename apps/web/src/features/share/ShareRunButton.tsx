// apps/web/src/features/share/ShareRunButton.tsx
import { useState } from 'react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconShare } from '@tabler/icons-react'
import { createShare } from '../../api/share'
import type { BlockRunResult } from '../../blocks/types'

type Props = {
  scenarioId: string
  runResult: BlockRunResult | null
  bundleId?: string
  bundle?: Record<string, unknown>
}

export function ShareRunButton({ scenarioId, runResult, bundleId, bundle }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleShare() {
    if (!runResult) {
      notifications.show({
        color: 'gray',
        message: 'Run the scenario first to share the result.',
      })
      return
    }

    setLoading(true)
    try {
      const { url } = await createShare({
        bundleId,
        bundle,
        scenarioId,
        runResult,
        ttlDays: 30,
      })

      await navigator.clipboard.writeText(url)
      notifications.show({
        color: 'green',
        title: 'Link copied!',
        message: 'Shareable run link copied to clipboard.',
      })
    } catch {
      notifications.show({
        color: 'red',
        title: 'Share failed',
        message: 'Could not create share link. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip label="Share run result" withinPortal>
      <ActionIcon
        aria-label="Share run result"
        loading={loading}
        onClick={handleShare}
      >
        <IconShare size={18} />
      </ActionIcon>
    </Tooltip>
  )
}
