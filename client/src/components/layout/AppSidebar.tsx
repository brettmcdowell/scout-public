import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Avatar, Modal, Button } from 'flowbite-react'
import { HiHome, HiBeaker, HiLightningBolt, HiChartBar, HiCog, HiLogout } from 'react-icons/hi'
import type { IconType } from 'react-icons'

const NAV_ITEMS: { to: string; icon: IconType; label: string }[] = [
  { to: '/overview',     icon: HiHome,         label: 'Overview' },
  { to: '/intelligence', icon: HiBeaker,       label: 'Intelligence' },
  { to: '/context',      icon: HiChartBar,     label: 'Context' },
  { to: '/action',       icon: HiLightningBolt, label: 'Action' },
]

function NavItem({ to, icon: Icon, label }: { to: string; icon: IconType; label: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isActive = pathname === to

  return (
    <Link
      to={to}
      title={label}
      className={[
        'flex items-center justify-center w-full py-2.5 border-l-[3px] transition-colors',
        isActive
          ? 'bg-green-50 text-green-800 border-green-600'
          : 'text-gray-500 hover:bg-gray-50 border-transparent',
      ].join(' ')}
    >
      <Icon className={`w-5 h-5 ${isActive ? 'text-green-700' : 'text-gray-400'}`} />
    </Link>
  )
}

export function AppSidebar() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <aside className="w-14 flex-shrink-0 flex flex-col bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center justify-center h-14 flex-shrink-0 border-b border-gray-100">
          <img src="/scoutLogo.png" alt="Scout" className="h-7 w-7 object-contain" />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* User avatar */}
        <div className="flex items-center justify-center py-3 border-t border-gray-100">
          <button onClick={() => setModalOpen(true)} className="rounded-full focus:outline-none focus:ring-2 focus:ring-green-500">
            <Avatar placeholderInitials="AG" size="sm" rounded />
          </button>
        </div>
      </aside>

      <Modal show={modalOpen} size="sm" onClose={() => setModalOpen(false)}>
        <Modal.Header>Account</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-gray-500 mb-4">AgriGro Farms</p>
          <div className="space-y-2">
            <Button color="gray" className="w-full justify-start" disabled>
              <HiCog className="w-4 h-4 mr-2" /> Settings
            </Button>
            <Button color="gray" className="w-full justify-start" disabled>
              <HiLogout className="w-4 h-4 mr-2" /> Log out
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  )
}
