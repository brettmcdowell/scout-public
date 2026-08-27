import { Outlet } from '@tanstack/react-router'
import { AppSidebar } from './AppSidebar'
import { FarmProvider } from '../../contexts/FarmContext'

export function AppLayout() {
  return (
    <FarmProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </FarmProvider>
  )
}
