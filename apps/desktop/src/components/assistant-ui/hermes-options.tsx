import { type FC, useState } from 'react'

import { requestComposerSubmit } from '@/app/chat/composer/focus'
import { Button } from '@/components/ui/button'
import { triggerHaptic } from '@/lib/haptics'
import type { HermesOptionsPayload } from '@/lib/hermes-options'
import { ZapFilled } from '@/lib/icons'

interface HermesOptionsProps {
  payload: HermesOptionsPayload
}

/**
 * Option chips for a ```hermes-options block — the backend's machine-readable
 * way of asking the user to pick a direction. Clicking a chip submits the
 * option id through the SAME composer path as typing it (requestComposerSubmit
 * → the visible surface's composer → submitText → prompt.submit). The row
 * disables itself after one pick: the question is answered, and a stale
 * question must not be re-clickable.
 */
export const HermesOptions: FC<HermesOptionsProps> = ({ payload }) => {
  const [answered, setAnswered] = useState(false)

  const pick = (id: string) => {
    if (answered) {
      return
    }

    setAnswered(true)
    triggerHaptic('submit')
    requestComposerSubmit(id)
  }

  return (
    <div aria-label={payload.kind} className="my-2 flex flex-wrap gap-2" data-slot="aui_hermes-options" role="group">
      {payload.options.map(option => (
        <Button
          disabled={answered}
          key={option.id}
          onClick={() => pick(option.id)}
          size="sm"
          variant={option.recommended ? 'default' : 'secondary'}
        >
          {option.recommended ? <ZapFilled /> : null}
          {option.label}
        </Button>
      ))}
    </div>
  )
}
