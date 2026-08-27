import { createFileRoute } from '@tanstack/react-router'
import { IntelligencePage } from '../layers/intelligence/IntelligencePage'

export const Route = createFileRoute('/intelligence')({
  component: IntelligencePage,
})
