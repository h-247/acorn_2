import React, { useState } from 'react';
import {
  Home,
  BookOpen,
  CheckSquare,
  Users,
  GraduationCap,
  Activity,
  Bell,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { Avatar } from '../primitives/Avatar';

declare const process: { env: { NEXT_PUBLIC_API_URL?: string } };

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
  roleMode?: 'TEACHER' | 'STUDENT' | 'ADMIN';
  children: React.ReactNode;
  onSearch?: (query: string) => void;
  onRoleSwitch?: (role: 'TEACHER' | 'STUDENT') => void;
  onLogout?: () => void;
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
  onLogout,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const teacherNav: NavItem[] = [
    { id: 'home', label: 'Home', href: '/', icon: <Home className="w-5 h-5 shrink-0" /> },
    { id: 'materials', label: 'Materials', href: '/materials', icon: <BookOpen className="w-5 h-5 shrink-0" /> },
    { id: 'assessments', label: 'Assessments', href: '/assessments', icon: <CheckSquare className="w-5 h-5 shrink-0" /> },
    { id: 'classes', label: 'Classes', href: '/classes', icon: <Users className="w-5 h-5 shrink-0" /> },
    { id: 'learners', label: 'Learners', href: '/learners', icon: <GraduationCap className="w-5 h-5 shrink-0" /> },
  ];

  const studentNav: NavItem[] = [
    { id: 'student-home', label: 'Home', href: '/student', icon: <Home className="w-5 h-5 shrink-0" /> },
    { id: 'student-assessments', label: 'My Assessments', href: '/student/assessments', icon: <CheckSquare className="w-5 h-5 shrink-0" /> },
    { id: 'student-materials', label: 'Study Materials', href: '/student/materials', icon: <BookOpen className="w-5 h-5 shrink-0" /> },
    { id: 'student-progress', label: 'My Progress', href: '/student/progress', icon: <GraduationCap className="w-5 h-5 shrink-0" /> },
  ];

  const adminNav: NavItem[] = [
    { id: 'admin-users', label: 'Users & Permissions', href: '/admin?tab=users', icon: <GraduationCap className="w-5 h-5 shrink-0" /> },
    { id: 'admin-courses', label: 'Courses & Curriculum', href: '/admin?tab=courses', icon: <BookOpen className="w-5 h-5 shrink-0" /> },
    { id: 'admin-classes', label: 'Classes & Enrollments', href: '/admin?tab=classes', icon: <Users className="w-5 h-5 shrink-0" /> },
    { id: 'admin-taxonomy', label: 'Skill Taxonomy', href: '/admin?tab=taxonomy', icon: <CheckSquare className="w-5 h-5 shrink-0" /> },
    { id: 'admin-audit', label: 'Audit Trail & Metrics', href: '/admin?tab=audit', icon: <Activity className="w-5 h-5 shrink-0" /> },
  ];

  const navItems = roleMode === 'ADMIN' ? adminNav : roleMode === 'STUDENT' ? studentNav : teacherNav;
  const brandHref = roleMode === 'ADMIN' ? '/admin?tab=users' : roleMode === 'STUDENT' ? '/student' : '/';
  const getIsActive = (href: string) => {
    if (href.includes('?')) {
      return currentPath === href;
    }

    if (href === '/' || href === '/student') {
      return currentPath === href;
    }

    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const handleSignOut = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      await fetch(`${apiBase}/identity/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('acorn_user');
      localStorage.removeItem('acorn_token');
      window.location.href = '/sign-in';
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FC]/60 flex">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-[#082051]/40 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - fixed viewport height, sticky top-0, dual fixed width 256px (w-64) or 80px (w-20) */}
      <aside
        className={`fixed lg:sticky top-0 h-screen z-50 bg-white border-r border-gray-200/80 flex flex-col justify-between transition-all duration-200 shrink-0 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand header */}
          <div className={`h-16 flex items-center justify-between border-b border-gray-100 shrink-0 ${isCollapsed ? 'gap-1 px-2' : 'px-4'}`}>
            <a href={brandHref} className="flex min-w-0 items-center gap-2.5 overflow-hidden" title="Acorn">
              <div className="w-8 h-8 min-w-[32px] rounded-lg bg-[#0967F7] flex items-center justify-center text-white text-lg font-bold shadow-xs">
                <span aria-hidden="true">🌰</span>
              </div>
              {!isCollapsed && (
                <div className="flex flex-col whitespace-nowrap overflow-hidden">
                  <span className="font-bold text-base text-[#082051] leading-tight">Acorn</span>
                </div>
              )}
            </a>
            {/* Desktop horizontal collapse/expand toggle */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex w-7 h-7 shrink-0 items-center justify-center rounded-lg text-[#656C79] hover:text-[#082051] hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0967F7]"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-[#656C79] hover:text-[#082051] p-1"
              aria-label="Close mobile menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav items with internal scrolling */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = getIsActive(item.href);
              return (
                <a
                  key={item.id}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={`flex items-center rounded-xl text-sm font-medium transition-colors relative ${
                    isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-[#0967F7] text-white shadow-xs'
                      : 'text-[#5969AB] hover:text-[#082051] hover:bg-[#F3F6FC]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-white' : 'text-[#5969AB]'}>{item.icon}</span>
                    {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#0967F7]'
                      }`}
                    >
                      {item.badgeCount}
                    </span>
                  )}
                  {isCollapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0967F7] ring-2 ring-white" />
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="shrink-0 p-2 border-t border-gray-100 space-y-1">
          <button
            type="button"
            onClick={handleSignOut}
            title={isCollapsed ? 'Sign Out' : undefined}
            aria-label="Sign Out"
            className={`w-full flex items-center rounded-lg text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 text-left transition-colors ${
              isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
            }`}
          >
            <LogOut className="w-4 h-4 text-red-500 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header (demo role switcher removed) */}
        <header className="h-16 bg-white border-b border-gray-200/80 px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-[#656C79] hover:text-[#082051] p-1.5"
              aria-label="Open sidebar"
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
            <button className="w-9 h-9 rounded-full hover:bg-[#F3F6FC] flex items-center justify-center text-[#656C79] relative" aria-label="Notifications">
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
