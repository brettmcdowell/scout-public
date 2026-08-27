import { Avatar } from 'flowbite-react'

interface AppHeaderProps {
  collapsed: boolean
}

export function AppHeader({ collapsed }: AppHeaderProps) {
  return (
    <header
      className="flex items-center h-[60px] bg-white border-b border-gray-200 flex-shrink-0 z-10 transition-all duration-200"
    >
      {/* Logo — matches sidebar width */}
      <div
        className="flex-shrink-0 flex items-center justify-center border-r border-gray-200 h-full transition-all duration-200"
        style={{ width: collapsed ? 56 : 220 }}
      >
        <div className="flex items-center gap-2">
          <img src="/scoutLogo.png" alt="Scout" className="h-8 w-8 object-contain" />
          {!collapsed && (
            <span className="font-bold text-gray-900 text-base tracking-widest">SCOUT</span>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User */}
      <div className="flex items-center gap-2 px-4">
        <Avatar placeholderInitials="AG" size="sm" rounded />
        <span className="text-base font-medium text-gray-600 hidden md:block">AgriGro Farms</span>
      </div>
    </header>
  )
}
