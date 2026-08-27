import { createFileRoute } from '@tanstack/react-router'
import { ActionPage } from '../layers/action/ActionPage'

export const Route = createFileRoute('/action')({
  component: ActionPage,
})
