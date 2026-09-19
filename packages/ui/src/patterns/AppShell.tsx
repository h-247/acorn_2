import React, { useState } from 'react';
import {
  Home,
  BookOpen,
  CheckSquare,
  Users,
  GraduationCap,
  HelpCircle,
  Settings,
  Bell,
  Search,
  ChevronDown,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { Avatar } from '../primitives/Avatar';;

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badgeCount?: number;
}

export interface AppShellProps {
  currentPath?: string;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  roleMode?: 'TEACHER' | 'STUDENT';
  children: React.ReactNode;
  onSearch?: (query: string) => void;
  onRoleSwitch?: (role: 'TEACHER' | 'STUDENT') => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentPath = '/',
  userName = 'Ms. Taylor',
  userRole = 'Teacher',
  userAvatar,
  roleMode = 'TEACHER',
  children,
  onSearch,
  onRoleSwitch,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const teacherNav: NavItem[] = [
    { id: 'home', label: 'Home', href: '/', icon: <Home className="w-5 h-5" /> },
    { id: 'materials', label: 'Materials', href: '/materials', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'assessments', label: 'Assessments', href: '/assessments', icon: <CheckSquare className="w-5 h-5" /> },
    { id: 'classes', label: 'Classes', href: '/classes', icon: <Users className="w-5 h-5" /> },
    { id: 'learners', label: 'Learners', href: '/learners', icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'ai-review', label: 'AI Review', href: '/ai-review', icon: <Sparkles className="w-5 h-5 text-amber-500" /> },
  ];

  const studentNav: NavItem[] = [
    { id: 'student-home', label: 'Home', href: '/student', icon: <Home className="w-5 h-5" /> },
    { id: 'student-classes', label: 'My Classes', href: '/student/classes', icon: <Users className="w-5 h-5" /> },
    { id: 'student-assessments', label: 'Assessments', href: '/student/assessments', icon: <CheckSquare className="w-5 h-5" /> },
    { id: 'student-progress', label: 'My Progress', href: '/student/progress', icon: <GraduationCap className="w-5 h-5" /> },
  ];

  const navItems = roleMode === 'TEACHER' ? teacherNav : studentNav;

  return (
    <div className="min-h-screen bg-[#F3F6FC]/60 flex">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-[#082051]/40 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-gray-200/80 flex flex-col justify-between transition-transform duration-200 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-gray-100">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0967F7] flex items-center justify-center text-white text-lg font-bold shadow-xs">
                🌰
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-[#082051] leading-tight">Acorn</span>
                <span className="text-[10px] text-[#656C79] font-medium leading-none">by Agentivium AI</span>
              </div>
            </a>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-[#656C79] hover:text-[#082051]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav items */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? currentPath === '/'
                  : currentPath.startsWith(item.href);
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#0967F7] text-white shadow-xs'
                      : 'text-[#5969AB] hover:text-[#082051] hover:bg-[#F3F6FC]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-white' : 'text-[#5969AB]'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#0967F7]'
                      }`}
                    >
                      {item.badgeCount}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Mascot Banner */}
        <div className="p-4 space-y-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 rounded-2xl p-4 border border-blue-100/80 relative overflow-hidden">
            <div className="text-3xl mb-1">🐿️</div>
            <div className="text-sm font-bold text-[#082051] leading-tight">Small steps big progress.</div>
            <div className="text-xs text-[#5969AB] mt-1">Acorn helps every learner grow.</div>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0967F7] mt-3 hover:underline"
            >
              Learn more ›
            </a>
          </div>

          <div className="pt-2 border-t border-gray-100 space-y-1">
            <a
              href="#"
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#656C79] hover:text-[#082051] rounded-lg hover:bg-gray-50"
            >
              <HelpCircle className="w-4 h-4 text-[#5969AB]" />
              <span>Help & Support</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#656C79] hover:text-[#082051] rounded-lg hover:bg-gray-50"
            >
              <Settings className="w-4 h-4 text-[#5969AB]" />
              <span>Settings</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200/80 px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-[#656C79] hover:text-[#082051] p-1.5"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#656C79]" />
              <input
                type="text"
                placeholder="Search materials, learners, topics... (⌘K)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (onSearch) onSearch(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2 bg-[#F3F6FC] rounded-xl text-sm text-[#082051] placeholder-[#656C79] border-none focus:ring-2 focus:ring-[#0967F7]/30 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick role switcher for demo */}
            {onRoleSwitch && (
              <div className="hidden sm:flex items-center bg-[#F3F6FC] rounded-lg p-0.5 border border-gray-200">
                <button
                  onClick={() => onRoleSwitch('TEACHER')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    roleMode === 'TEACHER' ? 'bg-white text-[#0967F7] shadow-xs' : 'text-[#656C79]'
                  }`}
                >
                  Teacher
                </button>
                <button
                  onClick={() => onRoleSwitch('STUDENT')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    roleMode === 'STUDENT' ? 'bg-white text-[#0967F7] shadow-xs' : 'text-[#656C79]'
                  }`}
                >
                  Student
                </button>
              </div>
            )}

            <button className="w-9 h-9 rounded-full hover:bg-[#F3F6FC] flex items-center justify-center text-[#656C79] relative">
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-red-500 absolute top-2 right-2 ring-2 ring-white" />
            </button>

            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-100">
              <Avatar name={userName} src={userAvatar} size="sm" />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-[#082051] leading-tight">{userName}</span>
                <span className="text-[11px] text-[#656C79]">{userRole}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#656C79] hidden md:block" />
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
