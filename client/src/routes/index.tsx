import { createFileRoute, redirect } from '@tanstack/react-router'

const DEV_FORCE_ONBOARDING = import.meta.env.DEV && import.meta.env.VITE_FORCE_ONBOARDING === 'true'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (DEV_FORCE_ONBOARDING) localStorage.removeItem('tv_onboarding_complete')
    const done = localStorage.getItem('tv_onboarding_complete')
    throw redirect({ to: done ? '/overview' : '/onboarding' })
  },
})
