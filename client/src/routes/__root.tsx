import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { AppLayout } from '../components/layout/AppLayout'

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (pathname.startsWith('/onboarding')) {
    return <Outlet />
  }

  return <AppLayout />
}

export const Route = createRootRoute({ component: RootComponent })
