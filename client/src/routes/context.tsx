import { createFileRoute } from '@tanstack/react-router'
import { ContextPage } from '../layers/context/ContextPage'

export const Route = createFileRoute('/context')({
  component: ContextPage,
})
