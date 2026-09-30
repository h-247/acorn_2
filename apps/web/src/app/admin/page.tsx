'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AppShell,
  Button,
  Badge,
  Card,
  Input,
  Textarea,
  Select,
  Dialog,
} from '@acorn/ui';
import {
  Users,
  BookOpen,
  GraduationCap,
  CheckSquare,
  Plus,
  Trash2,
  UserPlus,
  Shield,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  List,
  FolderTree,
} from 'lucide-react';
import { api, setStoredUser } from '@/lib/api';

type AdminTab = 'users' | 'courses' | 'classes' | 'taxonomy' | 'audit';

interface PaginationBarProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  label?: string;
}

function PaginationBar({ page, limit, total, onPageChange, onLimitChange, label = 'records' }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : Math.min((safePage - 1) * limit + 1, total);
  const end = Math.min(safePage * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border border-gray-200/80 rounded-xl text-xs text-[#656C79]">
      <div className="flex items-center gap-2">
        <span>
          Showing <strong className="text-[#082051]">{start}</strong> to{' '}
          <strong className="text-[#082051]">{end}</strong> of{' '}
          <strong className="text-[#082051]">{total}</strong> {label}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span>Page size:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Select page size"
            className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#082051] font-medium focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span>
            Page <strong className="text-[#082051]">{page}</strong> of{' '}
            <strong className="text-[#082051]">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
              className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-[#082051]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
              className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-[#082051]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyStateView({
  message = 'No matching records found.',
  onClear,
}: {
  message?: string;
  onClear?: () => void;
}) {
  return (
    <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-gray-200">
      <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-2.5">
        <Search className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-[#082051]">No results found</h3>
      <p className="text-xs text-[#656C79] mt-1 max-w-sm mx-auto">{message}</p>
      {onClear && (
        <Button variant="outline" size="sm" onClick={onClear} className="mt-3">
          Clear Filters
        </Button>
      )}
    </div>
  );
}

function AdminPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab state
  const tabParam = (searchParams.get('tab') as AdminTab) || 'users';
  const [activeTab, setActiveTab] = useState<AdminTab>(tabParam);

  // Sync tab with URL
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const updateUrl = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const sp = new URLSearchParams(Array.from(searchParams.entries()));
      for (const [key, val] of Object.entries(paramsToUpdate)) {
        if (val === undefined || val === '' || (key === 'page' && val === 1)) {
          sp.delete(key);
        } else {
          sp.set(key, String(val));
        }
      }
      const qs = sp.toString();
      router.replace(`/admin${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, searchParams]
  );

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Global lookup lists
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [skillTree, setSkillTree] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any | null>(null);

  // Tab data states
  const [users, setUsers] = useState<any[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userLimit, setUserLimit] = useState(10);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  const [courses, setCourses] = useState<any[]>([]);
  const [courseTotal, setCourseTotal] = useState(0);
  const [coursePage, setCoursePage] = useState(1);
  const [courseLimit, setCourseLimit] = useState(10);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseLevelFilter, setCourseLevelFilter] = useState('');

  const [classes, setClasses] = useState<any[]>([]);
  const [classTotal, setClassTotal] = useState(0);
  const [classPage, setClassPage] = useState(1);
  const [classLimit, setClassLimit] = useState(10);
  const [classSearch, setClassSearch] = useState('');
  const [classCourseFilter, setClassCourseFilter] = useState('');
  const [classTeacherFilter, setClassTeacherFilter] = useState('');
  const [classLevelFilter, setClassLevelFilter] = useState('');

  const [skills, setSkills] = useState<any[]>([]);
  const [skillTotal, setSkillTotal] = useState(0);
  const [skillPage, setSkillPage] = useState(1);
  const [skillLimit, setSkillLimit] = useState(10);
  const [skillSearch, setSkillSearch] = useState('');
  const [skillAreaFilter, setSkillAreaFilter] = useState('');
  const [skillLevelFilter, setSkillLevelFilter] = useState('');

  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(10);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');
  const [auditRoleFilter, setAuditRoleFilter] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');

  const showSuccess = (msg: string) => setSuccessMessage(msg);

  // Enrollments Modal States
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [classEnrollments, setClassEnrollments] = useState<any[]>([]);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [enrollmentTotal, setEnrollmentTotal] = useState(0);
  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [enrollmentLimit, setEnrollmentLimit] = useState(5);
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [activeEnrollmentClass, setActiveEnrollmentClass] = useState<any | null>(null);
  const [isEnrollmentsModalOpen, setIsEnrollmentsModalOpen] = useState(false);
  const [taxonomyView, setTaxonomyView] = useState<'list' | 'tree'>('list');

  // User Modal States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('STUDENT');

  // Course Modal States
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseLevel, setNewCourseLevel] = useState('BEGINNER');
  const [newCourseDesc, setNewCourseDesc] = useState('');

  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseLevel, setEditCourseLevel] = useState('');
  const [editCourseDesc, setEditCourseDesc] = useState('');

  // Class Modal States
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [newClassCourseId, setNewClassCourseId] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState('BEGINNER');
  const [newClassTeacherId, setNewClassTeacherId] = useState('');
  const [newClassNextActivity, setNewClassNextActivity] = useState('');

  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassLevel, setEditClassLevel] = useState('');
  const [editClassTeacherId, setEditClassTeacherId] = useState('');
  const [editClassNextActivity, setEditClassNextActivity] = useState('');

  // Enroll Modal States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedEnrollClassId, setSelectedEnrollClassId] = useState('');
  const [selectedEnrollStudentId, setSelectedEnrollStudentId] = useState('');

  // Skill Modal States
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [newSkillCode, setNewSkillCode] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillArea, setNewSkillArea] = useState('READING');
  const [newSkillParentId, setNewSkillParentId] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState('A1');
  const [newSkillDesc, setNewSkillDesc] = useState('');

  // Reset Password Modal States
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Refresh global lookups helper
  const refreshLookups = useCallback(async () => {
    try {
      const [cList, uList, sTree, mData, clsList] = await Promise.all([
        api.getCourses({ all: true }).catch(() => []),
        api.getUsers({ all: true }).catch(() => []),
        api.getSkillTree().catch(() => []),
        api.getMetrics().catch(() => null),
        api.getClasses({ all: true }).catch(() => []),
      ]);
      const courseRows = Array.isArray(cList?.items) ? cList.items : Array.isArray(cList) ? cList : [];
      const userRows = Array.isArray(uList?.items) ? uList.items : Array.isArray(uList) ? uList : [];
      const classRows = Array.isArray(clsList?.items) ? clsList.items : Array.isArray(clsList) ? clsList : [];
      const teachers = userRows.filter((u: any) => u.role === 'TEACHER' || u.role === 'ADMIN');
      const students = userRows.filter((u: any) => u.role === 'STUDENT');

      setAllCourses(courseRows);
      setAllTeachers(teachers);
      setAllStudents(students);
      setAllClasses(classRows);
      setSkillTree(Array.isArray(sTree) ? sTree : []);
      setMetrics(mData);

      if (courseRows.length > 0) setNewClassCourseId((prev) => prev || courseRows[0].id);
      if (teachers.length > 0) setNewClassTeacherId((prev) => prev || teachers[0].id);
      if (students.length > 0) setSelectedEnrollStudentId((prev) => prev || students[0].id);
      if (classRows.length > 0) setSelectedEnrollClassId((prev) => prev || classRows[0].id);
    } catch (err: any) {
      console.warn('Failed to load lookup items:', err);
    }
  }, []);

  // 1. Initial auth and lookup data
  useEffect(() => {
    async function loadLookups() {
      try {
        const me = await api.getMe();
        setCurrentUser(me);
      } catch (authErr: any) {
        setStoredUser(null);
        window.location.href = '/sign-in';
        return;
      }
      await refreshLookups();
    }
    loadLookups();
  }, [refreshLookups]);

  // 2. Fetch active tab data
  const loadActiveTabData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'users') {
        const res = await api.getUsers({
          page: userPage,
          limit: userLimit,
          search: userSearch.trim() || undefined,
          role: userRoleFilter || undefined,
          status: userStatusFilter || undefined,
          paginate: true,
        });
        if (res && Array.isArray(res.items)) {
          setUsers(res.items);
          setUserTotal(res.total ?? res.items.length);
        } else if (Array.isArray(res)) {
          setUsers(res);
          setUserTotal(res.length);
        }
      } else if (activeTab === 'courses') {
        const res = await api.getCourses({
          page: coursePage,
          limit: courseLimit,
          search: courseSearch.trim() || undefined,
          level: courseLevelFilter || undefined,
          paginate: true,
        });
        if (res && Array.isArray(res.items)) {
          setCourses(res.items);
          setCourseTotal(res.total ?? res.items.length);
        } else if (Array.isArray(res)) {
          setCourses(res);
          setCourseTotal(res.length);
        }
      } else if (activeTab === 'classes') {
        const res = await api.getClasses({
          page: classPage,
          limit: classLimit,
          search: classSearch.trim() || undefined,
          courseId: classCourseFilter || undefined,
          teacherId: classTeacherFilter || undefined,
          level: classLevelFilter || undefined,
          paginate: true,
        });
        if (res && Array.isArray(res.items)) {
          setClasses(res.items);
          setClassTotal(res.total ?? res.items.length);
        } else if (Array.isArray(res)) {
          setClasses(res);
          setClassTotal(res.length);
        }
      } else if (activeTab === 'taxonomy') {
        const [res, tree] = await Promise.all([
          api.getSkills({
            page: skillPage,
            limit: skillLimit,
            search: skillSearch.trim() || undefined,
            area: skillAreaFilter || undefined,
            level: skillLevelFilter || undefined,
            paginate: true,
          }),
          api.getSkillTree(),
        ]);
        if (res && Array.isArray(res.items)) {
          setSkills(res.items);
          setSkillTotal(res.total ?? res.items.length);
        } else if (Array.isArray(res)) {
          setSkills(res);
          setSkillTotal(res.length);
        }
        if (Array.isArray(tree)) {
          setSkillTree(tree);
        }
      } else if (activeTab === 'audit') {
        const res = await api.getAuditEvents({
          page: auditPage,
          limit: auditLimit,
          search: auditSearch.trim() || undefined,
          action: auditActionFilter || undefined,
          entityType: auditEntityFilter || undefined,
          actorRole: auditRoleFilter || undefined,
          startDate: auditStartDate || undefined,
          endDate: auditEndDate || undefined,
          paginate: true,
        });
        if (res && Array.isArray(res.items)) {
          setAuditEvents(res.items);
          setAuditTotal(res.total ?? res.items.length);
        } else if (Array.isArray(res)) {
          setAuditEvents(res);
          setAuditTotal(res.length);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load administrative data');
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    userPage,
    userLimit,
    userSearch,
    userRoleFilter,
    userStatusFilter,
    coursePage,
    courseLimit,
    courseSearch,
    courseLevelFilter,
    classPage,
    classLimit,
    classSearch,
    classCourseFilter,
    classTeacherFilter,
    classLevelFilter,
    skillPage,
    skillLimit,
    skillSearch,
    skillAreaFilter,
    skillLevelFilter,
    auditPage,
    auditLimit,
    auditSearch,
    auditActionFilter,
    auditEntityFilter,
    auditRoleFilter,
    auditStartDate,
    auditEndDate,
  ]);

  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData]);

  // Load Class Enrollments
  const loadClassEnrollments = useCallback(async (classId: string, page = 1, limit = 5, search = '') => {
    setEnrollmentLoading(true);
    try {
      const res = await api.getClassEnrollments(classId, { page, limit, search: search.trim() || undefined, paginate: true });
      if (res && Array.isArray(res.items)) {
        setClassEnrollments(res.items);
        setEnrollmentTotal(res.total ?? res.items.length);
      } else if (Array.isArray(res)) {
        setClassEnrollments(res);
        setEnrollmentTotal(res.length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load class enrollments');
    } finally {
      setEnrollmentLoading(false);
    }
  }, []);

  const openEnrollmentsModal = (cls: any) => {
    setActiveEnrollmentClass(cls);
    setEnrollmentPage(1);
    setEnrollmentSearch('');
    setIsEnrollmentsModalOpen(true);
    loadClassEnrollments(cls.id, 1, enrollmentLimit, '');
  };

  // Handlers
  const handleToggleUserActive = async (user: any) => {
    setError(null);
    try {
      const nextActive = user.isActive === false;
      await api.updateUser(user.id, { isActive: nextActive });
      showSuccess(`User ${user.name} ${nextActive ? 'reactivated' : 'deactivated'} successfully.`);
      loadActiveTabData();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetTargetUser) return;
    if (!newResetPassword || newResetPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    try {
      await api.resetUserPassword(resetTargetUser.id, newResetPassword);
      setIsResetPasswordModalOpen(false);
      showSuccess(`Password reset for ${resetTargetUser.name} successfully!`);
      setResetTargetUser(null);
      setNewResetPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset user password');
    }
  };

  const openEditCourse = (course: any) => {
    setEditingCourseId(course.id);
    setEditCourseCode(course.code);
    setEditCourseName(course.name);
    setEditCourseLevel(course.level || 'B1');
    setEditCourseDesc(course.description || '');
    setIsEditCourseModalOpen(true);
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!editingCourseId) return;
    try {
      await api.updateCourse(editingCourseId, {
        code: editCourseCode,
        name: editCourseName,
        level: editCourseLevel,
        description: editCourseDesc,
      });
      setIsEditCourseModalOpen(false);
      showSuccess(`Course updated successfully!`);
      loadActiveTabData();
    } catch (err: any) {
      setError(err.message || 'Failed to update course');
    }
  };

  const openEditClass = (cls: any) => {
    setEditingClassId(cls.id);
    setEditClassName(cls.name);
    setEditClassLevel(cls.level || 'B1');
    setEditClassTeacherId(cls.teacherId || '');
    setEditClassNextActivity(cls.nextActivity || '');
    setIsEditClassModalOpen(true);
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!editingClassId) return;
    try {
      await api.updateClass(editingClassId, {
        name: editClassName,
        level: editClassLevel,
        teacherId: editClassTeacherId,
        nextActivity: editClassNextActivity,
      });
      setIsEditClassModalOpen(false);
      showSuccess(`Class updated successfully!`);
      loadActiveTabData();
    } catch (err: any) {
      setError(err.message || 'Failed to update class');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createUser({
        email: newUserEmail,
        name: newUserName,
        password: newUserPassword,
        role: newUserRole,
      });
      setIsUserModalOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      showSuccess(`User ${newUserName} created successfully!`);
      const uList = await api.getUsers({ all: true }).catch(() => null);
      if (uList) {
        const userRows = Array.isArray(uList?.items) ? uList.items : Array.isArray(uList) ? uList : [];
        setAllTeachers(userRows.filter((u: any) => u.role === 'TEACHER' || u.role === 'ADMIN'));
        setAllStudents(userRows.filter((u: any) => u.role === 'STUDENT'));
      }
      loadActiveTabData();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createCourse({
        code: newCourseCode,
        name: newCourseName,
        level: newCourseLevel,
        description: newCourseDesc,
      });
      setIsCourseModalOpen(false);
      setNewCourseCode('');
      setNewCourseName('');
      setNewCourseDesc('');
      showSuccess(`Course ${newCourseName} created successfully!`);
      loadActiveTabData();
    } catch (err: any) {
      setError(err.message || 'Failed to create course');
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createClass({
        courseId: newClassCourseId,
        name: newClassName,
        level: newClassLevel,
        teacherId: newClassTeacherId,
        nextActivity: newClassNextActivity,
      });
      setIsClassModalOpen(false);
      setNewClassName('');
      setNewClassNextActivity('');
      showSuccess(`Class ${newClassName} created successfully!`);
      loadActiveTabData();
    } catch (err: any) {
      setError(err.message || 'Failed to create class');
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.enrollLearner(selectedEnrollClassId, selectedEnrollStudentId);
      setIsEnrollModalOpen(false);
      showSuccess('Learner enrolled successfully!');
      loadActiveTabData();
      if (activeEnrollmentClass && activeEnrollmentClass.id === selectedEnrollClassId) {
        loadClassEnrollments(selectedEnrollClassId, enrollmentPage, enrollmentLimit, enrollmentSearch);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enroll learner');
    }
  };

  const handleUnenroll = async (classId: string, learnerId: string, learnerName?: string) => {
    if (!confirm(`Are you sure you want to unenroll ${learnerName || 'this student'} from this class?`)) return;
    setError(null);
    try {
      await api.unenrollLearner(classId, learnerId);
      showSuccess('Learner unenrolled successfully.');
      loadActiveTabData();
      if (activeEnrollmentClass && activeEnrollmentClass.id === classId) {
        loadClassEnrollments(classId, enrollmentPage, enrollmentLimit, enrollmentSearch);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unenroll learner');
    }
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createSkill({
        code: newSkillCode,
        name: newSkillName,
        area: newSkillArea,
        parentId: newSkillParentId || null,
        level: newSkillLevel,
        description: newSkillDesc || undefined,
      });
      setIsSkillModalOpen(false);
      setNewSkillCode('');
      setNewSkillName('');
      setNewSkillDesc('');
      showSuccess(`Skill ${newSkillName} added to taxonomy!`);
      refreshLookups();
      loadActiveTabData();
    } catch (err: any) {
      setError(err.message || 'Failed to create skill');
    }
  };

  const handleDeleteSkill = async (skillId: string, skillName: string) => {
    if (!confirm(`Are you sure you want to delete "${skillName}"? This action cannot be undone.`)) return;
    setError(null);
    try {
      await api.deleteSkill(skillId);
      showSuccess(`Skill "${skillName}" deleted.`);
      refreshLookups();
      loadActiveTabData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete skill node');
    }
  };

  return (
    <AppShell
      currentPath={`/admin?tab=${activeTab}`}
      userName={currentUser?.name || 'Administrator'}
      userRole={currentUser?.role || 'Admin'}
      roleMode="ADMIN"
    >
      <div className="space-y-6">
        {/* Global Notifications */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: USERS */}
        {/* ========================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-base font-bold text-[#082051]">Users &amp; Permissions</h2>
                <p className="text-xs text-[#656C79]">Manage user accounts, roles, and permissions.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<UserPlus className="w-4 h-4" />}
                onClick={() => setIsUserModalOpen(true)}
              >
                Create User
              </Button>
            </div>

            {/* Filter Bar */}
            <Card className="p-3.5 border-gray-200/80 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                      updateUrl({ search: e.target.value, page: 1 });
                    }}
                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#082051] focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
                  />
                </div>

                <Select
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                    updateUrl({ role: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All Roles', value: '' },
                    { label: 'Teacher', value: 'TEACHER' },
                    { label: 'Student', value: 'STUDENT' },
                    { label: 'Administrator', value: 'ADMIN' },
                  ]}
                />

                <Select
                  value={userStatusFilter}
                  onChange={(e) => {
                    setUserStatusFilter(e.target.value);
                    setUserPage(1);
                    updateUrl({ status: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All Account Statuses', value: '' },
                    { label: 'Active Only', value: 'active' },
                    { label: 'Deactivated Only', value: 'deactivated' },
                  ]}
                />
              </div>
            </Card>

            {/* Results Table */}
            {users.length === 0 ? (
              <EmptyStateView
                message="No users match the search and filter criteria."
                onClear={() => {
                  setUserSearch('');
                  setUserRoleFilter('');
                  setUserStatusFilter('');
                  setUserPage(1);
                  updateUrl({ search: undefined, role: undefined, status: undefined, page: 1 });
                }}
              />
            ) : (
              <Card className="overflow-hidden border-gray-200/80">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F3F6FC] text-[#656C79] font-semibold border-b border-gray-200">
                      <tr>
                        <th className="p-3">User</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Created</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/50">
                          <td className="p-3">
                            <div className="font-semibold text-[#082051]">{u.name}</div>
                            <div className="text-[#656C79] text-[11px]">{u.email}</div>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                u.role === 'ADMIN' ? 'danger' : u.role === 'TEACHER' ? 'primary' : 'default'
                              }
                            >
                              {u.role}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {u.isActive === false ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800">
                                Deactivated
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[#656C79]">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleUserActive(u)}
                                className={`text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                                  u.isActive === false
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                }`}
                              >
                                {u.isActive === false ? 'Reactivate' : 'Deactivate'}
                              </button>
                              <button
                                onClick={() => {
                                  setResetTargetUser(u);
                                  setNewResetPassword('');
                                  setIsResetPasswordModalOpen(true);
                                }}
                                className="text-[11px] font-medium text-[#0967F7] bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                              >
                                Reset PW
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <PaginationBar
              page={userPage}
              limit={userLimit}
              total={userTotal}
              label="users"
              onPageChange={(p) => {
                setUserPage(p);
                updateUrl({ page: p });
              }}
              onLimitChange={(l) => {
                setUserLimit(l);
                setUserPage(1);
                updateUrl({ limit: l, page: 1 });
              }}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: COURSES */}
        {/* ========================================================= */}
        {activeTab === 'courses' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-base font-bold text-[#082051]">Curriculum Courses</h2>
                <p className="text-xs text-[#656C79]">Course codes, CEFR levels, and learning syllabi.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setIsCourseModalOpen(true)}
              >
                Create Course
              </Button>
            </div>

            {/* Filter Bar */}
            <Card className="p-3.5 border-gray-200/80 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search code or title..."
                    value={courseSearch}
                    onChange={(e) => {
                      setCourseSearch(e.target.value);
                      setCoursePage(1);
                      updateUrl({ search: e.target.value, page: 1 });
                    }}
                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#082051] focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
                  />
                </div>

                <Select
                  value={courseLevelFilter}
                  onChange={(e) => {
                    setCourseLevelFilter(e.target.value);
                    setCoursePage(1);
                    updateUrl({ level: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All CEFR Levels', value: '' },
                    { label: 'A1', value: 'A1' },
                    { label: 'A2', value: 'A2' },
                    { label: 'B1', value: 'B1' },
                    { label: 'B2', value: 'B2' },
                    { label: 'C1', value: 'C1' },
                    { label: 'C2', value: 'C2' },
                  ]}
                />
              </div>
            </Card>

            {/* Courses List */}
            {courses.length === 0 ? (
              <EmptyStateView
                message="No courses match the search and filter criteria."
                onClear={() => {
                  setCourseSearch('');
                  setCourseLevelFilter('');
                  setCoursePage(1);
                  updateUrl({ search: undefined, level: undefined, page: 1 });
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((course) => (
                  <Card key={course.id} className="p-5 border-gray-200/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="text-[10px] font-mono text-[#0967F7] font-bold uppercase">
                          {course.code}
                        </span>
                        <Badge variant="primary">{course.level}</Badge>
                      </div>
                      <h3 className="text-base font-bold text-[#082051]">{course.name}</h3>
                      <p className="text-xs text-[#656C79] line-clamp-3 mt-1.5">
                        {course.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-gray-100 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => openEditCourse(course)}>
                        Edit Course
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <PaginationBar
              page={coursePage}
              limit={courseLimit}
              total={courseTotal}
              label="courses"
              onPageChange={(p) => {
                setCoursePage(p);
                updateUrl({ page: p });
              }}
              onLimitChange={(l) => {
                setCourseLimit(l);
                setCoursePage(1);
                updateUrl({ limit: l, page: 1 });
              }}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: CLASSES */}
        {/* ========================================================= */}
        {activeTab === 'classes' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-base font-bold text-[#082051]">Class Cohorts & Enrollments</h2>
                <p className="text-xs text-[#656C79]">Active teaching cohorts, assigned instructors, and student rosters.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<UserPlus className="w-4 h-4" />}
                  onClick={() => {
                    if (!selectedEnrollClassId && classes.length > 0) {
                      setSelectedEnrollClassId(classes[0].id);
                    }
                    setIsEnrollModalOpen(true);
                  }}
                >
                  Enroll Learner
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsClassModalOpen(true)}
                >
                  Create Class
                </Button>
              </div>
            </div>

            {/* Filter Bar */}
            <Card className="p-3.5 border-gray-200/80 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search class name..."
                    value={classSearch}
                    onChange={(e) => {
                      setClassSearch(e.target.value);
                      setClassPage(1);
                      updateUrl({ search: e.target.value, page: 1 });
                    }}
                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#082051] focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
                  />
                </div>

                <Select
                  value={classCourseFilter}
                  onChange={(e) => {
                    setClassCourseFilter(e.target.value);
                    setClassPage(1);
                    updateUrl({ courseId: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All Courses', value: '' },
                    ...allCourses.map((c) => ({ label: `${c.code} - ${c.name}`, value: c.id })),
                  ]}
                />

                <Select
                  value={classTeacherFilter}
                  onChange={(e) => {
                    setClassTeacherFilter(e.target.value);
                    setClassPage(1);
                    updateUrl({ teacherId: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All Teachers', value: '' },
                    ...allTeachers.map((t) => ({ label: t.name, value: t.id })),
                  ]}
                />

                <Select
                  value={classLevelFilter}
                  onChange={(e) => {
                    setClassLevelFilter(e.target.value);
                    setClassPage(1);
                    updateUrl({ level: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All Levels', value: '' },
                    { label: 'A1', value: 'A1' },
                    { label: 'A2', value: 'A2' },
                    { label: 'B1', value: 'B1' },
                    { label: 'B2', value: 'B2' },
                    { label: 'C1', value: 'C1' },
                    { label: 'C2', value: 'C2' },
                  ]}
                />
              </div>
            </Card>

            {/* Classes List */}
            {classes.length === 0 ? (
              <EmptyStateView
                message="No classes match the search and filter criteria."
                onClear={() => {
                  setClassSearch('');
                  setClassCourseFilter('');
                  setClassTeacherFilter('');
                  setClassLevelFilter('');
                  setClassPage(1);
                  updateUrl({ search: undefined, courseId: undefined, teacherId: undefined, level: undefined, page: 1 });
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map((cls) => (
                  <Card key={cls.id} className="p-5 border-gray-200/80 space-y-3.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono text-[#656C79] uppercase">
                          {cls.courseName || 'Curriculum Course'}
                        </span>
                        <h3 className="text-base font-bold text-[#082051]">{cls.name}</h3>
                      </div>
                      <Badge variant="primary">{cls.level}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50/70 p-3 rounded-xl">
                      <div>
                        <span className="text-[#656C79]">Teacher:</span>
                        <p className="font-semibold text-[#082051]">{cls.teacherName || 'Not assigned'}</p>
                      </div>
                      <div>
                        <span className="text-[#656C79]">Learners Enrolled:</span>
                        <p className="font-semibold text-[#0967F7]">{cls.learnerCount} students</p>
                      </div>
                    </div>

                    {cls.nextActivity && (
                      <div className="text-xs text-[#082051] bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                        <span className="font-bold text-[#0967F7]">Next Activity: </span>
                        <span>{cls.nextActivity}</span>
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditClass(cls)}>
                          Edit / Reassign
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEnrollmentsModal(cls)}>
                          Manage Students ({cls.learnerCount})
                        </Button>
                      </div>
                      <a href={`/classes/${cls.id}`}>
                        <Button variant="outline" size="sm">
                          Class Workspace ›
                        </Button>
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <PaginationBar
              page={classPage}
              limit={classLimit}
              total={classTotal}
              label="classes"
              onPageChange={(p) => {
                setClassPage(p);
                updateUrl({ page: p });
              }}
              onLimitChange={(l) => {
                setClassLimit(l);
                setClassPage(1);
                updateUrl({ limit: l, page: 1 });
              }}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: TAXONOMY */}
        {/* ========================================================= */}
        {activeTab === 'taxonomy' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-base font-bold text-[#082051]">Pedagogical Skill Taxonomy</h2>
                <p className="text-xs text-[#656C79]">Core English skills, subskills, and CEFR competency nodes.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setTaxonomyView('list')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      taxonomyView === 'list' ? 'bg-white text-[#0967F7] shadow-xs' : 'text-[#656C79]'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" /> List View
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxonomyView('tree')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      taxonomyView === 'tree' ? 'bg-white text-[#0967F7] shadow-xs' : 'text-[#656C79]'
                    }`}
                  >
                    <FolderTree className="w-3.5 h-3.5" /> Tree View
                  </button>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsSkillModalOpen(true)}
                >
                  Add Skill Node
                </Button>
              </div>
            </div>

            {/* Filter Bar */}
            <Card className="p-3.5 border-gray-200/80 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search code or skill name..."
                    value={skillSearch}
                    onChange={(e) => {
                      setSkillSearch(e.target.value);
                      setSkillPage(1);
                      updateUrl({ search: e.target.value, page: 1 });
                    }}
                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#082051] focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
                  />
                </div>

                <Select
                  value={skillAreaFilter}
                  onChange={(e) => {
                    setSkillAreaFilter(e.target.value);
                    setSkillPage(1);
                    updateUrl({ area: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All Skill Areas', value: '' },
                    { label: 'Reading', value: 'READING' },
                    { label: 'Listening', value: 'LISTENING' },
                    { label: 'Speaking', value: 'SPEAKING' },
                    { label: 'Writing', value: 'WRITING' },
                    { label: 'Grammar', value: 'GRAMMAR' },
                    { label: 'Vocabulary', value: 'VOCABULARY' },
                  ]}
                />

                <Select
                  value={skillLevelFilter}
                  onChange={(e) => {
                    setSkillLevelFilter(e.target.value);
                    setSkillPage(1);
                    updateUrl({ level: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All CEFR Levels', value: '' },
                    { label: 'Pre-A1', value: 'Pre-A1' },
                    { label: 'A1', value: 'A1' },
                    { label: 'A2', value: 'A2' },
                    { label: 'B1', value: 'B1' },
                    { label: 'B2', value: 'B2' },
                    { label: 'C1', value: 'C1' },
                    { label: 'C2', value: 'C2' },
                  ]}
                />
              </div>
            </Card>

            {/* View switcher: Flat list or Tree */}
            {taxonomyView === 'list' ? (
              skills.length === 0 ? (
                <EmptyStateView
                  message="No skill nodes match the filter criteria."
                  onClear={() => {
                    setSkillSearch('');
                    setSkillAreaFilter('');
                    setSkillLevelFilter('');
                    setSkillPage(1);
                    updateUrl({ search: undefined, area: undefined, level: undefined, page: 1 });
                  }}
                />
              ) : (
                <>
                  <Card className="overflow-hidden border-gray-200/80">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F3F6FC] text-[#656C79] font-semibold border-b border-gray-200">
                          <tr>
                            <th className="p-3">Code</th>
                            <th className="p-3">Skill Name</th>
                            <th className="p-3">Area</th>
                            <th className="p-3">Target Level</th>
                            <th className="p-3">Description</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {skills.map((s) => (
                            <tr key={s.id} className="hover:bg-gray-50/50">
                              <td className="p-3 font-mono text-[11px] font-bold text-[#0967F7]">{s.code}</td>
                              <td className="p-3 font-semibold text-[#082051]">{s.name}</td>
                              <td className="p-3">
                                <Badge variant="primary">{s.area}</Badge>
                              </td>
                              <td className="p-3 text-[#656C79]">{s.level || '—'}</td>
                              <td className="p-3 text-[#656C79] max-w-xs truncate">{s.description || '—'}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteSkill(s.id, s.name)}
                                  title="Delete skill"
                                  className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  <PaginationBar
                    page={skillPage}
                    limit={skillLimit}
                    total={skillTotal}
                    label="skills"
                    onPageChange={(p) => {
                      setSkillPage(p);
                      updateUrl({ page: p });
                    }}
                    onLimitChange={(l) => {
                      setSkillLimit(l);
                      setSkillPage(1);
                      updateUrl({ limit: l, page: 1 });
                    }}
                  />
                </>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {skillTree.map((root) => (
                  <Card key={root.id} className="p-5 border-gray-200/80 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                      <div>
                        <span className="text-[10px] font-mono text-[#0967F7] font-bold uppercase">{root.code}</span>
                        <h3 className="text-base font-bold text-[#082051]">{root.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="primary">{root.area}</Badge>
                        <button
                          onClick={() => handleDeleteSkill(root.id, root.name)}
                          title="Delete root skill"
                          className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pl-3 border-l-2 border-blue-200">
                      <span className="text-xs font-semibold text-[#656C79]">
                        Child Subskills ({root.children?.length || 0}):
                      </span>
                      {root.children && root.children.length > 0 ? (
                        root.children.map((child: any) => (
                          <div
                            key={child.id}
                            className="flex justify-between items-center text-xs p-1.5 bg-gray-50 rounded-lg"
                          >
                            <span className="font-medium text-[#082051]">{child.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-[#656C79]">{child.code}</span>
                              <button
                                onClick={() => handleDeleteSkill(child.id, child.name)}
                                title="Delete subskill"
                                className="text-gray-400 hover:text-red-600 p-0.5 rounded transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[#656C79] italic">No direct subskills</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: AUDIT LOG & ANALYTICS */}
        {/* ========================================================= */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#082051]">Authoritative Audit Trail & Analytics</h2>
              <p className="text-xs text-[#656C79]">
                Immutable, paginated audit log of all academic state mutations with verified system metrics.
              </p>
            </div>

            {/* System Analytics Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="p-3.5 border-gray-200/80 space-y-1">
                <span className="text-[11px] text-[#656C79] font-medium">Active Accounts</span>
                <div className="text-lg font-bold text-[#082051]">
                  {allTeachers.length + allStudents.length + 1}
                  <span className="text-xs font-normal text-[#656C79] ml-1">users</span>
                </div>
                <div className="text-[10px] text-[#656C79]">Total registered users</div>
              </Card>

              <Card className="p-3.5 border-gray-200/80 space-y-1">
                <span className="text-[11px] text-[#656C79] font-medium">Submissions & Evidence</span>
                <div className="text-lg font-bold text-[#0967F7]">
                  {metrics?.totalSubmissions || 0}
                  <span className="text-xs font-normal text-[#656C79] ml-1">
                    ({metrics?.totalEvidenceRecorded || 0} obs)
                  </span>
                </div>
                <div className="text-[10px] text-[#656C79]">Traceable evidence rows</div>
              </Card>

              <Card className="p-3.5 border-gray-200/80 space-y-1">
                <span className="text-[11px] text-[#656C79] font-medium">Material Reuse Rate</span>
                <div className="text-lg font-bold text-emerald-600">
                  {Math.round((metrics?.reuseRate || 0) * 100)}%
                </div>
                <div className="text-[10px] text-[#656C79]">
                  {metrics?.materialsDirectReuseCount || 0} reused • {metrics?.materialsAdaptedCount || 0} adapted
                </div>
              </Card>

              <Card className="p-3.5 border-gray-200/80 space-y-1">
                <span className="text-[11px] text-[#656C79] font-medium">Rec. Acceptance</span>
                <div className="text-lg font-bold text-indigo-600">
                  {Math.round((metrics?.recommendationsAcceptedRate || 0) * 100)}%
                </div>
                <div className="text-[10px] text-[#656C79]">
                  {metrics?.recommendationsAcceptedCount || 0} of {metrics?.recommendationsTotal || 0} accepted
                </div>
              </Card>

              <Card className="p-3.5 border-gray-200/80 space-y-1">
                <span className="text-[11px] text-[#656C79] font-medium">Teacher Decisions</span>
                <div className="text-lg font-bold text-[#082051]">
                  {metrics?.recommendationsAcceptedCount || 1}
                  <span className="text-xs font-normal text-[#656C79] ml-1">decided</span>
                </div>
                <div className="text-[10px] text-[#656C79]">Instructor approvals recorded</div>
              </Card>
            </div>

            {/* Filter Bar */}
            <Card className="p-3.5 border-gray-200/80 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                <div className="relative lg:col-span-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search action or entity ID..."
                    value={auditSearch}
                    onChange={(e) => {
                      setAuditSearch(e.target.value);
                      setAuditPage(1);
                      updateUrl({ search: e.target.value, page: 1 });
                    }}
                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#082051] focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
                  />
                </div>

                <Select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditPage(1);
                    updateUrl({ action: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All Actions', value: '' },
                    { label: 'SYSTEM_INITIALIZED', value: 'SYSTEM_INITIALIZED' },
                    { label: 'COURSE_CREATED', value: 'COURSE_CREATED' },
                    { label: 'CLASS_CREATED', value: 'CLASS_CREATED' },
                    { label: 'CLASS_UPDATED', value: 'CLASS_UPDATED' },
                    { label: 'LEARNERS_ENROLLED', value: 'LEARNERS_ENROLLED' },
                    { label: 'MATERIAL_CREATED', value: 'MATERIAL_CREATED' },
                    { label: 'MATERIAL_RELEASED', value: 'MATERIAL_RELEASED' },
                    { label: 'ASSESSMENT_CREATED', value: 'ASSESSMENT_CREATED' },
                    { label: 'ASSESSMENT_ASSIGNED', value: 'ASSESSMENT_ASSIGNED' },
                    { label: 'SUBMISSION_STARTED', value: 'SUBMISSION_STARTED' },
                    { label: 'SUBMISSION_COMPLETED', value: 'SUBMISSION_COMPLETED' },
                    { label: 'SUBMISSION_EVALUATED', value: 'SUBMISSION_EVALUATED' },
                    { label: 'RECOMMENDATION_GENERATED', value: 'RECOMMENDATION_GENERATED' },
                    { label: 'TEACHER_DECISION_RECORDED', value: 'TEACHER_DECISION_RECORDED' },
                    { label: 'TAXONOMY_UPDATED', value: 'TAXONOMY_UPDATED' },
                  ]}
                />

                <Select
                  value={auditEntityFilter}
                  onChange={(e) => {
                    setAuditEntityFilter(e.target.value);
                    setAuditPage(1);
                    updateUrl({ entityType: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All Entity Types', value: '' },
                    { label: 'SYSTEM', value: 'SYSTEM' },
                    { label: 'COURSE', value: 'COURSE' },
                    { label: 'CLASS', value: 'CLASS' },
                    { label: 'CLASS_MATERIAL', value: 'CLASS_MATERIAL' },
                    { label: 'MATERIAL', value: 'MATERIAL' },
                    { label: 'ASSESSMENT', value: 'ASSESSMENT' },
                    { label: 'ASSIGNMENT', value: 'ASSIGNMENT' },
                    { label: 'SUBMISSION', value: 'SUBMISSION' },
                    { label: 'RECOMMENDATION', value: 'RECOMMENDATION' },
                    { label: 'SKILL', value: 'SKILL' },
                  ]}
                />

                <Select
                  value={auditRoleFilter}
                  onChange={(e) => {
                    setAuditRoleFilter(e.target.value);
                    setAuditPage(1);
                    updateUrl({ actorRole: e.target.value, page: 1 });
                  }}
                  options={[
                    { label: 'All Roles', value: '' },
                    { label: 'ADMIN', value: 'ADMIN' },
                    { label: 'TEACHER', value: 'TEACHER' },
                    { label: 'STUDENT', value: 'STUDENT' },
                    { label: 'SYSTEM', value: 'SYSTEM' },
                  ]}
                />

                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={auditStartDate}
                    onChange={(e) => {
                      setAuditStartDate(e.target.value);
                      setAuditPage(1);
                      updateUrl({ startDate: e.target.value, page: 1 });
                    }}
                    title="From Date"
                    aria-label="From Date"
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#082051] focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
                  />
                  <input
                    type="date"
                    value={auditEndDate}
                    onChange={(e) => {
                      setAuditEndDate(e.target.value);
                      setAuditPage(1);
                      updateUrl({ endDate: e.target.value, page: 1 });
                    }}
                    title="To Date"
                    aria-label="To Date"
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#082051] focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
                  />
                </div>
              </div>
            </Card>

            {/* Audit Table */}
            {auditEvents.length === 0 ? (
              <EmptyStateView
                message="No audit records match the search and filter criteria."
                onClear={() => {
                  setAuditSearch('');
                  setAuditActionFilter('');
                  setAuditEntityFilter('');
                  setAuditRoleFilter('');
                  setAuditStartDate('');
                  setAuditEndDate('');
                  setAuditPage(1);
                  updateUrl({
                    search: undefined,
                    action: undefined,
                    entityType: undefined,
                    actorRole: undefined,
                    startDate: undefined,
                    endDate: undefined,
                    page: 1,
                  });
                }}
              />
            ) : (
              <Card className="overflow-hidden border-gray-200/80">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F3F6FC] text-[#656C79] font-semibold border-b border-gray-200">
                      <tr>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Entity Type & ID</th>
                        <th className="p-3">Actor Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {auditEvents.map((ev) => (
                        <tr key={ev.id} className="hover:bg-gray-50/50">
                          <td className="p-3 text-[#656C79] whitespace-nowrap">
                            {new Date(ev.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3 font-bold text-[#082051]">{ev.action}</td>
                          <td className="p-3 text-[#0967F7] font-mono text-[11px]">
                            {ev.entityType} {ev.entityId ? `(${ev.entityId.slice(0, 8)}...)` : ''}
                          </td>
                          <td className="p-3">
                            <Badge variant={ev.actorRole === 'ADMIN' ? 'danger' : ev.actorRole === 'TEACHER' ? 'primary' : 'default'}>
                              {ev.actorRole || 'SYSTEM'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <PaginationBar
              page={auditPage}
              limit={auditLimit}
              total={auditTotal}
              label="audit events"
              onPageChange={(p) => {
                setAuditPage(p);
                updateUrl({ page: p });
              }}
              onLimitChange={(l) => {
                setAuditLimit(l);
                setAuditPage(1);
                updateUrl({ limit: l, page: 1 });
              }}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: CLASS ENROLLMENTS (WITH FILTERING & PAGINATION) */}
        {/* ========================================================= */}
        <Dialog
          isOpen={isEnrollmentsModalOpen}
          onClose={() => setIsEnrollmentsModalOpen(false)}
          title={`Class Roster: ${activeEnrollmentClass?.name || 'Class'}`}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter student name or email..."
                  value={enrollmentSearch}
                  onChange={(e) => {
                    setEnrollmentSearch(e.target.value);
                    setEnrollmentPage(1);
                    if (activeEnrollmentClass) {
                      loadClassEnrollments(activeEnrollmentClass.id, 1, enrollmentLimit, e.target.value);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#082051] focus:outline-none focus:ring-1 focus:ring-[#0967F7]"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<UserPlus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setSelectedEnrollClassId(activeEnrollmentClass?.id || '');
                  setIsEnrollModalOpen(true);
                }}
              >
                Enroll Student
              </Button>
            </div>

            {enrollmentLoading ? (
              <div className="py-8 text-center text-gray-400">Loading roster...</div>
            ) : classEnrollments.length === 0 ? (
              <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-xs text-[#656C79]">No students enrolled matching filter.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[#656C79] font-semibold border-b border-gray-200">
                    <tr>
                      <th className="p-2.5">Learner</th>
                      <th className="p-2.5">Enrolled Date</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {classEnrollments.map((enr: any) => (
                      <tr key={enr.learnerId} className="hover:bg-gray-50/50">
                        <td className="p-2.5">
                          <div className="font-semibold text-[#082051]">{enr.learnerName}</div>
                          <div className="text-[11px] text-[#656C79]">{enr.learnerEmail}</div>
                        </td>
                        <td className="p-2.5 text-[#656C79]">
                          {enr.enrolledAt ? new Date(enr.enrolledAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleUnenroll(enr.classId, enr.learnerId, enr.learnerName)}
                            className="text-red-600 hover:text-red-800 font-medium text-[11px] px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Unenroll
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PaginationBar
              page={enrollmentPage}
              limit={enrollmentLimit}
              total={enrollmentTotal}
              label="students"
              onPageChange={(p) => {
                setEnrollmentPage(p);
                if (activeEnrollmentClass) {
                  loadClassEnrollments(activeEnrollmentClass.id, p, enrollmentLimit, enrollmentSearch);
                }
              }}
              onLimitChange={(l) => {
                setEnrollmentLimit(l);
                setEnrollmentPage(1);
                if (activeEnrollmentClass) {
                  loadClassEnrollments(activeEnrollmentClass.id, 1, l, enrollmentSearch);
                }
              }}
            />

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsEnrollmentsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>

        {/* DIALOG 1: CREATE USER */}
        <Dialog
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          title="Create Center User Account"
        >
          <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
            <Input
              label="Full Name"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="e.g. Taylor Nguyen"
              required
            />
            <Input
              label="Email Address"
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="e.g. tnguyen@acorn.edu"
              required
            />
            <Input
              label="Initial Password"
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Select
              label="Role"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              options={[
                { label: 'Teacher', value: 'TEACHER' },
                { label: 'Student', value: 'STUDENT' },
                { label: 'System Admin', value: 'ADMIN' },
              ]}
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsUserModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create Account
              </Button>
            </div>
          </form>
        </Dialog>

        {/* DIALOG 2: CREATE COURSE */}
        <Dialog
          isOpen={isCourseModalOpen}
          onClose={() => setIsCourseModalOpen(false)}
          title="Create Curriculum Course"
        >
          <form onSubmit={handleCreateCourse} className="space-y-4 text-xs">
            <Input
              label="Course Code"
              value={newCourseCode}
              onChange={(e) => setNewCourseCode(e.target.value)}
              placeholder="e.g. IELTS_5_0"
              required
            />
            <Input
              label="Course Title"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="e.g. IELTS 5.0 Preparation"
              required
            />
            <Select
              label="Target Level"
              value={newCourseLevel}
              onChange={(e) => setNewCourseLevel(e.target.value)}
              options={[
                { label: 'A1', value: 'A1' },
                { label: 'A2', value: 'A2' },
                { label: 'B1', value: 'B1' },
                { label: 'B2', value: 'B2' },
                { label: 'C1', value: 'C1' },
                { label: 'C2', value: 'C2' },
              ]}
            />
            <Textarea
              label="Description / Syllabus"
              value={newCourseDesc}
              onChange={(e) => setNewCourseDesc(e.target.value)}
              placeholder="Course overview, target band score, learning objectives..."
              rows={3}
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCourseModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create Course
              </Button>
            </div>
          </form>
        </Dialog>

        {/* DIALOG 3: EDIT COURSE */}
        <Dialog
          isOpen={isEditCourseModalOpen}
          onClose={() => setIsEditCourseModalOpen(false)}
          title="Edit Course Information"
        >
          <form onSubmit={handleUpdateCourse} className="space-y-4 text-xs">
            <Input
              label="Course Code"
              value={editCourseCode}
              onChange={(e) => setEditCourseCode(e.target.value)}
              required
            />
            <Input
              label="Course Title"
              value={editCourseName}
              onChange={(e) => setEditCourseName(e.target.value)}
              required
            />
            <Select
              label="Target Level"
              value={editCourseLevel}
              onChange={(e) => setEditCourseLevel(e.target.value)}
              options={[
                { label: 'A1', value: 'A1' },
                { label: 'A2', value: 'A2' },
                { label: 'B1', value: 'B1' },
                { label: 'B2', value: 'B2' },
                { label: 'C1', value: 'C1' },
                { label: 'C2', value: 'C2' },
              ]}
            />
            <Textarea
              label="Description / Syllabus"
              value={editCourseDesc}
              onChange={(e) => setEditCourseDesc(e.target.value)}
              rows={3}
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsEditCourseModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </Dialog>

        {/* DIALOG 4: CREATE CLASS */}
        <Dialog
          isOpen={isClassModalOpen}
          onClose={() => setIsClassModalOpen(false)}
          title="Create New Class Cohort"
        >
          <form onSubmit={handleCreateClass} className="space-y-4 text-xs">
            <Select
              label="Curriculum Course"
              value={newClassCourseId}
              onChange={(e) => setNewClassCourseId(e.target.value)}
              options={allCourses.map((c) => ({ label: `${c.code} - ${c.name}`, value: c.id }))}
            />
            <Input
              label="Class Name"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g. IELTS 5.0 Foundation A"
              required
            />
            <Select
              label="Class Level"
              value={newClassLevel}
              onChange={(e) => setNewClassLevel(e.target.value)}
              options={[
                { label: 'A1', value: 'A1' },
                { label: 'A2', value: 'A2' },
                { label: 'B1', value: 'B1' },
                { label: 'B2', value: 'B2' },
                { label: 'C1', value: 'C1' },
                { label: 'C2', value: 'C2' },
              ]}
            />
            <Select
              label="Assigned Teacher"
              value={newClassTeacherId}
              onChange={(e) => setNewClassTeacherId(e.target.value)}
              options={allTeachers.map((t) => ({ label: t.name, value: t.id }))}
            />
            <Input
              label="Initial Next Activity (Optional)"
              value={newClassNextActivity}
              onChange={(e) => setNewClassNextActivity(e.target.value)}
              placeholder="e.g. Reading: Urban Farming"
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsClassModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create Class
              </Button>
            </div>
          </form>
        </Dialog>

        {/* DIALOG 5: EDIT CLASS */}
        <Dialog
          isOpen={isEditClassModalOpen}
          onClose={() => setIsEditClassModalOpen(false)}
          title="Edit Class Cohort & Teacher"
        >
          <form onSubmit={handleUpdateClass} className="space-y-4 text-xs">
            <Input
              label="Class Name"
              value={editClassName}
              onChange={(e) => setEditClassName(e.target.value)}
              required
            />
            <Select
              label="Class Level"
              value={editClassLevel}
              onChange={(e) => setEditClassLevel(e.target.value)}
              options={[
                { label: 'A1', value: 'A1' },
                { label: 'A2', value: 'A2' },
                { label: 'B1', value: 'B1' },
                { label: 'B2', value: 'B2' },
                { label: 'C1', value: 'C1' },
                { label: 'C2', value: 'C2' },
              ]}
            />
            <Select
              label="Assigned Teacher"
              value={editClassTeacherId}
              onChange={(e) => setEditClassTeacherId(e.target.value)}
              options={allTeachers.map((t) => ({ label: t.name, value: t.id }))}
            />
            <Input
              label="Current Next Activity"
              value={editClassNextActivity}
              onChange={(e) => setEditClassNextActivity(e.target.value)}
              placeholder="e.g. Reading: Urban Farming"
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsEditClassModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </Dialog>

        {/* DIALOG 6: ENROLL LEARNER */}
        <Dialog
          isOpen={isEnrollModalOpen}
          onClose={() => setIsEnrollModalOpen(false)}
          title="Enroll Student in Class"
        >
          <form onSubmit={handleEnroll} className="space-y-4 text-xs">
            <Select
              label="Target Class Cohort"
              value={selectedEnrollClassId}
              onChange={(e) => setSelectedEnrollClassId(e.target.value)}
              options={allClasses.map((c) => ({ label: `${c.name} (${c.level})`, value: c.id }))}
            />
            <Select
              label="Student"
              value={selectedEnrollStudentId}
              onChange={(e) => setSelectedEnrollStudentId(e.target.value)}
              options={allStudents.map((s) => ({ label: `${s.name} (${s.email})`, value: s.id }))}
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsEnrollModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Confirm Enrollment
              </Button>
            </div>
          </form>
        </Dialog>

        {/* DIALOG 7: CREATE SKILL */}
        <Dialog
          isOpen={isSkillModalOpen}
          onClose={() => setIsSkillModalOpen(false)}
          title="Add Pedagogical Skill Node"
        >
          <form onSubmit={handleCreateSkill} className="space-y-4 text-xs">
            <Input
              label="Skill Code (Uppercase ID)"
              value={newSkillCode}
              onChange={(e) => setNewSkillCode(e.target.value.toUpperCase())}
              placeholder="e.g. READ_MAIN_IDEA"
              required
            />
            <Input
              label="Skill Name"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="e.g. Identifying Main Ideas"
              required
            />
            <Select
              label="Skill Area"
              value={newSkillArea}
              onChange={(e) => setNewSkillArea(e.target.value)}
              options={[
                { label: 'Reading', value: 'READING' },
                { label: 'Listening', value: 'LISTENING' },
                { label: 'Speaking', value: 'SPEAKING' },
                { label: 'Writing', value: 'WRITING' },
                { label: 'Grammar', value: 'GRAMMAR' },
                { label: 'Vocabulary', value: 'VOCABULARY' },
              ]}
            />
            <Select
              label="Parent Skill (Optional)"
              value={newSkillParentId}
              onChange={(e) => setNewSkillParentId(e.target.value)}
              options={[
                { label: 'None (Root Skill)', value: '' },
                ...skillTree.map((s) => ({ label: `${s.code} - ${s.name}`, value: s.id })),
              ]}
            />
            <Select
              label="Target Level"
              value={newSkillLevel}
              onChange={(e) => setNewSkillLevel(e.target.value)}
              options={[
                { label: 'Pre-A1', value: 'Pre-A1' },
                { label: 'A1', value: 'A1' },
                { label: 'A2', value: 'A2' },
                { label: 'B1', value: 'B1' },
                { label: 'B2', value: 'B2' },
                { label: 'C1', value: 'C1' },
                { label: 'C2', value: 'C2' },
              ]}
            />
            <Textarea
              label="Skill Description"
              value={newSkillDesc}
              onChange={(e) => setNewSkillDesc(e.target.value)}
              placeholder="Pedagogical definition and mastery indicators..."
              rows={3}
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsSkillModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Add Skill
              </Button>
            </div>
          </form>
        </Dialog>

        {/* DIALOG 8: RESET PASSWORD */}
        <Dialog
          isOpen={isResetPasswordModalOpen}
          onClose={() => setIsResetPasswordModalOpen(false)}
          title={`Reset Password for ${resetTargetUser?.name || 'User'}`}
        >
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            <p className="text-[#656C79]">
              Set a new temporary password for <strong>{resetTargetUser?.email}</strong>.
            </p>
            <Input
              label="New Password"
              type="password"
              value={newResetPassword}
              onChange={(e) => setNewResetPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setIsResetPasswordModalOpen(false);
                  setResetTargetUser(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Set Password
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Loading admin portal...</div>}>
      <AdminPortalContent />
    </Suspense>
  );
}
