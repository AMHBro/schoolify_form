import type {
  AssignmentField,
  AssignmentSchema,
  SubmissionRecord,
} from '../types/assignment'
import { DEMO_ASSIGNMENT } from '../mock/fixtures'
import {
  mockAppendSubmission,
  mockCreateAssignment as persistMockAssignment,
  mockDeleteAssignment,
  mockFindByIdAndToken,
  mockFindByIdForTeacher,
  mockFindByShareCode,
  mockGenerateShareCode,
  mockListAssignments,
  mockListForTeacher,
  toSchema,
} from './localAssignmentStore'
import {
  mockDeleteTeacher,
  mockListTeachers,
  mockLoginTeacher,
  mockRegisterTeacher,
} from './teacherMockStore'
import { getTeacherSession, setTeacherSession } from './teacherSession'
import { compressFileForUpload } from './compressUpload'
import {
  getSupabaseClient,
  isSupabaseEnabled,
  SUBMISSION_BUCKET,
} from './supabaseClient'
import { normalizeTeacherNameForRpc, normalizeTeacherPhone } from './phoneNormalize'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** الاسم: مواءمة مع normalize_teacher_full_name في Postgres */
function rpcTeacherFullName(raw: string): string {
  return normalizeTeacherNameForRpc(raw)
}

/** الجوال: نفس منطق public.normalize_teacher_phone قبل الإرسال */
function rpcTeacherPhone(raw: string): string {
  const t = raw.trim()
  const n = normalizeTeacherPhone(t)
  return n || t
}

const USE_MOCK = !isSupabaseEnabled()

export type CreateAssignmentInput = {
  title: string
  description?: string
  deadlineAt?: string | null
  fields: AssignmentField[]
  shareCode?: string | null
}

export type CreateAssignmentResult = {
  id: string
  shareCode: string
  teacherViewToken: string
}

function parseRpcAssignmentPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null
  if (typeof data === 'string') {
    try {
      const p = JSON.parse(data) as unknown
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>
    } catch {
      return null
    }
    return null
  }
  if (typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>
  return null
}

/** نتيجة teacher_login: قد تأتي ككائن أو مصفوفة من عنصر أو مُغلفة */
function parseTeacherLoginPayload(data: unknown): Record<string, unknown> | null {
  let payload: unknown = data
  if (Array.isArray(payload) && payload.length === 1) payload = payload[0]
  let raw = parseRpcAssignmentPayload(payload)
  if (!raw) return null
  const hasToken =
    raw.token != null || (raw as { Token?: unknown }).Token != null
  const hasId =
    raw.teacherId != null ||
    raw.teacher_id != null ||
    (raw as { TeacherId?: unknown }).TeacherId != null
  if (!hasToken || !hasId) {
    for (const v of Object.values(raw)) {
      const inner = parseRpcAssignmentPayload(v)
      if (
        inner &&
        (inner.token != null ||
          inner.Token != null ||
          inner.teacherId != null ||
          inner.teacher_id != null)
      ) {
        return inner
      }
    }
  }
  return raw
}

function normalizeFieldType(raw: unknown): AssignmentField['type'] {
  const t = String(raw ?? 'text').trim().toLowerCase()
  if (t === 'images' || t === 'image' || t === 'img' || t === 'photos')
    return 'images'
  if (t === 'files' || t === 'file' || t === 'attachments') return 'files'
  return 'text'
}

function parseFieldsColumn(raw: unknown): AssignmentField[] {
  let arr: unknown[] = []
  if (Array.isArray(raw)) arr = raw
  else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown
      if (Array.isArray(p)) arr = p
    } catch {
      return []
    }
  } else return []

  const out: AssignmentField[] = []
  for (const row of arr) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const o = row as Record<string, unknown>
    const id = String(o.id ?? '').trim()
    const label = String(o.label ?? '').trim()
    if (!id || !label) continue
    const type = normalizeFieldType(o.type)
    const f: AssignmentField = {
      id,
      type,
      label,
      required: Boolean(o.required),
    }
    if (typeof o.accept === 'string' && o.accept.trim()) f.accept = o.accept.trim()
    if (typeof o.maxFiles === 'number' && Number.isFinite(o.maxFiles))
      f.maxFiles = o.maxFiles
    out.push(f)
  }
  return out
}

function mapDbRowToAssignment(raw: Record<string, unknown>): AssignmentSchema {
  const shareCode = normalizeShareCode(
    String(raw.share_code ?? raw.shareCode ?? '')
  )
  const deadlineRaw = raw.deadline_at ?? raw.deadlineAt
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    description:
      raw.description != null ? String(raw.description) : undefined,
    deadlineAt: deadlineRaw
      ? new Date(String(deadlineRaw)).toISOString()
      : undefined,
    shareCode,
    publicUrl: `/s/${encodeURIComponent(shareCode)}`,
    fields: parseFieldsColumn(raw.fields),
  }
}

/** توحيد الكود كما في قاعدة Supabase (أحرف كبيرة) */
export function normalizeShareCode(code: string): string {
  return code.trim().toUpperCase()
}

function publicUrlForStoragePath(supabaseUrl: string, path: string): string {
  const base = supabaseUrl.replace(/\/+$/, '')
  const enc = path.split('/').map(encodeURIComponent).join('/')
  return `${base}/storage/v1/object/public/${SUBMISSION_BUCKET}/${enc}`
}

function mapTeacherSubmission(
  raw: Record<string, unknown>,
  supabaseUrl: string
): SubmissionRecord {
  const assets = (raw.assets as Array<Record<string, unknown>> | null) ?? []
  const submittedAt = raw.submittedAt
    ? new Date(String(raw.submittedAt)).toISOString()
    : new Date().toISOString()
  return {
    id: String(raw.id ?? ''),
    studentName: String(raw.studentName ?? 'طالب'),
    submittedAt,
    textAnswer: raw.textAnswer ? String(raw.textAnswer) : undefined,
    files: assets.map((a) => ({
      name: String(a.name ?? 'ملف'),
      url: publicUrlForStoragePath(supabaseUrl, String(a.path ?? '')),
      isImage: Boolean(a.isImage),
    })),
  }
}

export async function fetchAssignmentByCode(
  shareCode: string
): Promise<AssignmentSchema | null> {
  const normalized = normalizeShareCode(shareCode)

  if (USE_MOCK) {
    await delay(80)
    const local = mockFindByShareCode(normalized)
    if (local) return toSchema(local)
    if (normalized === DEMO_ASSIGNMENT.shareCode.trim().toUpperCase()) {
      return DEMO_ASSIGNMENT
    }
    return null
  }

  const sb = getSupabaseClient()!
  const { data, error } = await sb.rpc('get_assignment_by_share_code', {
    p_code: normalized,
  })

  if (error) {
    console.warn('[Schoolify] get_assignment_by_share_code', error.message)
    return null
  }

  const row = parseRpcAssignmentPayload(data)
  if (!row) return null

  const assignment = mapDbRowToAssignment(row)
  if (!assignment.id || !assignment.shareCode) return null
  return assignment
}

export type TeacherDashboardData = {
  assignment: AssignmentSchema
  submissions: SubmissionRecord[]
}

export type TeacherAssignmentListItem = {
  id: string
  title: string
  shareCode: string
  deadlineAt: string | null
  createdAt: string | null
  submissionCount: number
}

type TeacherCreds = { assignmentId: string; teacherToken: string }

function resolveTeacherCreds(explicit?: TeacherCreds | null): TeacherCreds {
  const envId = import.meta.env.VITE_SUPABASE_ASSIGNMENT_ID?.trim()
  const envTv = import.meta.env.VITE_SUPABASE_TEACHER_TOKEN?.trim()
  const assignmentId = explicit?.assignmentId?.trim() || envId
  const teacherToken = explicit?.teacherToken?.trim() || envTv
  if (!assignmentId || !teacherToken) throw new Error('NO_CREDS')
  return { assignmentId, teacherToken }
}

export async function fetchTeacherDashboard(
  explicit?: TeacherCreds | null
): Promise<TeacherDashboardData> {
  if (USE_MOCK) {
    await delay(60)
    const { assignmentId, teacherToken } = resolveTeacherCreds(explicit)
    const row = mockFindByIdAndToken(assignmentId, teacherToken)
    if (!row) throw new Error('NOT_FOUND')
    return {
      assignment: toSchema(row),
      submissions: row.submissions,
    }
  }

  const { assignmentId, teacherToken } = resolveTeacherCreds(explicit)
  const sb = getSupabaseClient()!
  const { data, error } = await sb.rpc('get_teacher_dashboard_data', {
    p_assignment_id: assignmentId,
    p_teacher_token: teacherToken,
  })

  if (error) throw error
  if (!data || typeof data !== 'object') {
    throw new Error('EMPTY')
  }

  const payload = data as {
    assignment: Record<string, unknown>
    submissions: Record<string, unknown>[]
  }
  const url = import.meta.env.VITE_SUPABASE_URL!.replace(/\/+$/, '')
  const assignment = mapDbRowToAssignment(payload.assignment)
  const submissions = (payload.submissions ?? []).map((s) =>
    mapTeacherSubmission(s, url)
  )
  return { assignment, submissions }
}

export function translateAuthError(message: string): string {
  const m = (message || '').toLowerCase()
  if (m.includes('invalid_credentials')) return 'بيانات الدخول غير صحيحة.'
  if (m.includes('registration_admin_only'))
    return 'إضافة المعلّم تتم من لوحة إدارة النظام فقط. اطلب من المشرف تسجيلك ثم سجّل الدخول هنا.'
  if (m.includes('phone_taken')) return 'هذا الرقم مسجّل مسبقًا.'
  if (m.includes('phone_invalid')) return 'رقم الجوال غير صالح.'
  if (m.includes('name_required')) return 'الاسم مطلوب.'
  if (m.includes('session_invalid')) return 'انتهت الجلسة.'
  if (
    m.includes('could not find') ||
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('42883')
  ) {
    return 'تعذّر تسجيل الدخول.'
  }
  if (m.includes('permission denied') || m.includes('42501')) {
    return 'غير مسموح.'
  }
  if (m.includes('jwt') || m.includes('apikey') || m.includes('invalid api')) {
    return 'إعداد الاتصال غير صالح.'
  }
  if (
    m.includes('failed to fetch') ||
    m.includes('load failed') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    (m.includes('typeerror') && m.includes('fetch')) ||
    m.includes('network')
  ) {
    return 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وإعدادات المشروع على الاستضافة.'
  }
  if (m.includes('login_parse_failed')) {
    return 'أعد المحاولة.'
  }
  if (message.trim()) {
    return 'تعذّر إكمال العملية.'
  }
  return 'تعذّر إكمال العملية.'
}

export async function teacherRegister(
  fullName: string,
  phone: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (USE_MOCK) {
    await delay(40)
    const r = mockRegisterTeacher(fullName, phone)
    if (r.ok === false) return { ok: false, message: translateAuthError(r.code) }
    return { ok: true }
  }
  const sb = getSupabaseClient()!
  const { error } = await sb.rpc('teacher_register', {
    p_full_name: rpcTeacherFullName(fullName),
    p_phone: rpcTeacherPhone(phone),
  })
  if (error) return { ok: false, message: translateAuthError(error.message) }
  return { ok: true }
}

export async function teacherLogin(
  fullName: string,
  phone: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (USE_MOCK) {
    await delay(40)
    const r = mockLoginTeacher(fullName, phone)
    if ('error' in r) return { ok: false, message: translateAuthError(r.error) }
    return { ok: true }
  }
  const name = rpcTeacherFullName(fullName)
  const sb = getSupabaseClient()!
  let data: unknown
  try {
    const r = await sb.rpc('teacher_login', {
      p_full_name: name,
      p_phone: rpcTeacherPhone(phone),
    })
    data = r.data
    if (r.error) {
      const errRec = r.error as {
        message: string
        details?: string
        hint?: string
      }
      const combined = [errRec.message, errRec.details, errRec.hint]
        .filter(Boolean)
        .join(' ')
      console.warn('[Schoolify] teacher_login', combined)
      return { ok: false, message: translateAuthError(combined) }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[Schoolify] teacher_login', msg)
    return { ok: false, message: translateAuthError(msg) }
  }

  const raw = parseTeacherLoginPayload(data)
  if (!raw) {
    console.warn('[Schoolify] teacher_login unexpected data', data)
    return { ok: false, message: translateAuthError('login_parse_failed') }
  }

  const tokenVal = raw.token ?? raw.Token
  const teacherIdVal =
    raw.teacherId ?? raw.teacher_id ?? (raw as { TeacherId?: unknown }).TeacherId
  const nameVal = raw.fullName ?? raw.full_name ?? name

  const tokenS = tokenVal != null ? String(tokenVal).trim() : ''
  const idS = teacherIdVal != null ? String(teacherIdVal).trim() : ''
  if (
    tokenS.length < 8 ||
    idS.length < 8 ||
    tokenS === '[object Object]' ||
    idS === '[object Object]'
  ) {
    console.warn('[Schoolify] teacher_login missing fields', raw)
    return { ok: false, message: translateAuthError('invalid_credentials') }
  }

  setTeacherSession({
    token: tokenS,
    teacherId: idS,
    fullName: String(nameVal),
  })
  return { ok: true }
}

function parseAssignmentListJson(data: unknown): TeacherAssignmentListItem[] {
  if (data == null) return []
  let rows: unknown = data
  if (typeof data === 'string') {
    try {
      rows = JSON.parse(data) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(rows)) return []
  return rows.map((r) => {
    const o = r as Record<string, unknown>
    return {
      id: String(o.id ?? ''),
      title: String(o.title ?? ''),
      shareCode: String(o.shareCode ?? o.share_code ?? ''),
      deadlineAt: o.deadlineAt != null ? String(o.deadlineAt) : null,
      createdAt: o.createdAt != null ? String(o.createdAt) : null,
      submissionCount: Number(o.submissionCount ?? 0),
    }
  })
}

export type SystemAdminTeacherRow = {
  id: string
  fullName: string
  phone: string
  createdAt: string | null
}

export type SystemAdminAssignmentRow = {
  id: string
  title: string
  shareCode: string
  createdAt: string | null
  deadlineAt: string | null
  teacherName: string | null
  submissionCount: number
}

function systemAdminMockSecretExpected(): string {
  return (import.meta.env.VITE_SYSTEM_ADMIN_MOCK_KEY ?? 'schoolify-dev-admin').trim()
}

function assertSystemAdminMockKey(key: string): boolean {
  return key.trim() === systemAdminMockSecretExpected()
}

export function translateSystemAdminError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('system_admin_forbidden')) return 'مفتاح الإدارة غير صحيح.'
  if (m.includes('phone_taken')) return 'هذا الرقم مسجّل مسبقًا.'
  if (m.includes('phone_invalid')) return 'رقم الجوال غير صالح.'
  if (m.includes('name_required')) return 'الاسم مطلوب (حرفان على الأقل).'
  if (m.includes('assignment_not_found')) return 'الواجب غير موجود.'
  if (m.includes('teacher_not_found')) return 'المعلّم غير موجود.'
  if (
    m.includes('could not find') ||
    m.includes('does not exist') ||
    m.includes('42883')
  ) {
    return 'دوال لوحة النظام غير مثبّتة. نفّذ ملف 20260408240000_system_admin_dashboard.sql في Supabase.'
  }
  if (message.trim()) return message.trim()
  return 'تعذّر تنفيذ العملية.'
}

function parseSystemAdminTeachersJson(data: unknown): SystemAdminTeacherRow[] {
  if (data == null) return []
  let rows: unknown = data
  if (typeof data === 'string') {
    try {
      rows = JSON.parse(data) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(rows)) return []
  return rows.map((r) => {
    const o = r as Record<string, unknown>
    return {
      id: String(o.id ?? ''),
      fullName: String(o.fullName ?? o.full_name ?? ''),
      phone: String(o.phone ?? ''),
      createdAt: o.createdAt != null ? String(o.createdAt) : null,
    }
  })
}

function parseSystemAdminListAssignmentsJson(
  data: unknown
): SystemAdminAssignmentRow[] {
  if (data == null) return []
  let rows: unknown = data
  if (typeof data === 'string') {
    try {
      rows = JSON.parse(data) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(rows)) return []
  return rows.map((r) => {
    const o = r as Record<string, unknown>
    const tn = o.teacherName ?? o.teacher_name
    return {
      id: String(o.id ?? ''),
      title: String(o.title ?? ''),
      shareCode: String(o.shareCode ?? o.share_code ?? ''),
      createdAt: o.createdAt != null ? String(o.createdAt) : null,
      deadlineAt: o.deadlineAt != null ? String(o.deadlineAt) : null,
      teacherName: tn != null && String(tn).length > 0 ? String(tn) : null,
      submissionCount: Number(o.submissionCount ?? 0),
    }
  })
}

export async function systemAdminListTeachers(
  adminKey: string
): Promise<
  { ok: true; rows: SystemAdminTeacherRow[] } | { ok: false; message: string }
> {
  if (USE_MOCK) {
    await delay(30)
    if (!assertSystemAdminMockKey(adminKey))
      return { ok: false, message: translateSystemAdminError('system_admin_forbidden') }
    const rows = mockListTeachers().map((t) => ({
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      createdAt: null as string | null,
    }))
    return { ok: true, rows }
  }
  const sb = getSupabaseClient()!
  const { data, error } = await sb.rpc('system_admin_list_teachers', {
    p_secret: adminKey.trim(),
  })
  if (error)
    return { ok: false, message: translateSystemAdminError(error.message) }
  return { ok: true, rows: parseSystemAdminTeachersJson(data) }
}

export async function systemAdminRegisterTeacher(
  adminKey: string,
  fullName: string,
  phone: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (USE_MOCK) {
    await delay(40)
    if (!assertSystemAdminMockKey(adminKey))
      return { ok: false, message: translateSystemAdminError('system_admin_forbidden') }
    const r = mockRegisterTeacher(fullName, phone)
    if (r.ok === false) return { ok: false, message: translateAuthError(r.code) }
    return { ok: true }
  }
  const sb = getSupabaseClient()!
  const { error } = await sb.rpc('system_admin_register_teacher', {
    p_secret: adminKey.trim(),
    p_full_name: rpcTeacherFullName(fullName),
    p_phone: rpcTeacherPhone(phone),
  })
  if (error)
    return { ok: false, message: translateSystemAdminError(error.message) }
  return { ok: true }
}

export async function systemAdminListAssignments(
  adminKey: string
): Promise<
  | { ok: true; rows: SystemAdminAssignmentRow[] }
  | { ok: false; message: string }
> {
  if (USE_MOCK) {
    await delay(30)
    if (!assertSystemAdminMockKey(adminKey))
      return { ok: false, message: translateSystemAdminError('system_admin_forbidden') }
    const teachers = mockListTeachers()
    const nameById = new Map(teachers.map((t) => [t.id, t.fullName]))
    const rows = mockListAssignments()
      .map((a) => ({
        id: a.id,
        title: a.title,
        shareCode: a.shareCode,
        createdAt: a.createdAt ?? null,
        deadlineAt: a.deadlineAt ?? null,
        teacherName: a.teacherId ? nameById.get(a.teacherId) ?? null : null,
        submissionCount: a.submissions.length,
      }))
      .sort((x, y) => {
        const tx = x.createdAt ? new Date(x.createdAt).getTime() : 0
        const ty = y.createdAt ? new Date(y.createdAt).getTime() : 0
        return ty - tx
      })
    return { ok: true, rows }
  }
  const sb = getSupabaseClient()!
  const { data, error } = await sb.rpc('system_admin_list_assignments', {
    p_secret: adminKey.trim(),
  })
  if (error)
    return { ok: false, message: translateSystemAdminError(String(error.message)) }
  return { ok: true, rows: parseSystemAdminListAssignmentsJson(data) }
}

export async function systemAdminDeleteTeacher(
  adminKey: string,
  teacherId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (USE_MOCK) {
    await delay(50)
    if (!assertSystemAdminMockKey(adminKey))
      return { ok: false, message: translateSystemAdminError('system_admin_forbidden') }
    const ok = mockDeleteTeacher(teacherId)
    if (!ok)
      return { ok: false, message: translateSystemAdminError('teacher_not_found') }
    return { ok: true }
  }
  const sb = getSupabaseClient()!
  const { error } = await sb.rpc('system_admin_delete_teacher', {
    p_secret: adminKey.trim(),
    p_teacher_id: teacherId,
  })
  if (error)
    return { ok: false, message: translateSystemAdminError(error.message) }
  return { ok: true }
}

export async function systemAdminDeleteAssignment(
  adminKey: string,
  assignmentId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (USE_MOCK) {
    await delay(50)
    if (!assertSystemAdminMockKey(adminKey))
      return { ok: false, message: translateSystemAdminError('system_admin_forbidden') }
    const ok = mockDeleteAssignment(assignmentId)
    if (!ok)
      return { ok: false, message: translateSystemAdminError('assignment_not_found') }
    return { ok: true }
  }
  const sb = getSupabaseClient()!
  const { error } = await sb.rpc('system_admin_delete_assignment', {
    p_secret: adminKey.trim(),
    p_assignment_id: assignmentId,
  })
  if (error)
    return { ok: false, message: translateSystemAdminError(error.message) }
  return { ok: true }
}

export async function listTeacherAssignments(): Promise<
  TeacherAssignmentListItem[]
> {
  const sess = getTeacherSession()
  if (!sess) return []
  if (USE_MOCK) {
    await delay(40)
    return mockListForTeacher(sess.teacherId)
      .map((a) => ({
        id: a.id,
        title: a.title,
        shareCode: a.shareCode,
        deadlineAt: a.deadlineAt ?? null,
        createdAt: a.createdAt ?? null,
        submissionCount: a.submissions.length,
      }))
      .sort((x, y) => {
        const tx = x.createdAt ? new Date(x.createdAt).getTime() : 0
        const ty = y.createdAt ? new Date(y.createdAt).getTime() : 0
        return ty - tx
      })
  }
  const sb = getSupabaseClient()!
  const { data, error } = await sb.rpc('list_teacher_assignments', {
    p_session_token: sess.token,
  })
  if (error) {
    console.warn('[Schoolify] list_teacher_assignments', error.message)
    return []
  }
  return parseAssignmentListJson(data)
}

export async function fetchTeacherDashboardForSession(
  assignmentId: string
): Promise<TeacherDashboardData> {
  const sess = getTeacherSession()
  if (!sess) throw new Error('NO_CREDS')
  if (USE_MOCK) {
    await delay(60)
    const row = mockFindByIdForTeacher(assignmentId, sess.teacherId)
    if (!row) throw new Error('NOT_FOUND')
    return {
      assignment: toSchema(row),
      submissions: row.submissions,
    }
  }
  const sb = getSupabaseClient()!
  const { data, error } = await sb.rpc('get_teacher_dashboard_for_session', {
    p_session_token: sess.token,
    p_assignment_id: assignmentId,
  })
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('EMPTY')
  const payload = data as {
    assignment: Record<string, unknown>
    submissions: Record<string, unknown>[]
  }
  const url = import.meta.env.VITE_SUPABASE_URL!.replace(/\/+$/, '')
  const assignment = mapDbRowToAssignment(payload.assignment)
  const submissions = (payload.submissions ?? []).map((s) =>
    mapTeacherSubmission(s, url)
  )
  return { assignment, submissions }
}

export function translateCreateError(message: string): string {
  if (message.includes('title_required')) return 'عنوان الواجب مطلوب.'
  if (message.includes('fields_required'))
    return 'أضف حقلًا واحدًا على الأقل.'
  if (message.includes('share_code_taken')) return 'كود المشاركة مستخدم مسبقًا.'
  if (message.includes('share_code_length')) return 'طول الكود غير مناسب (4–40).'
  if (message.includes('share_code_format')) return 'الكود يقبل أحرفًا إنجليزية وأرقامًا و _ و - فقط.'
  if (message.includes('session_invalid') || message.includes('session_required'))
    return 'انتهت الجلسة أو لم تسجّل الدخول. أعد تسجيل الدخول من الصفحة الرئيسية.'
  return 'تعذّر إنشاء الواجب.'
}

export async function createAssignment(
  input: CreateAssignmentInput
): Promise<CreateAssignmentResult> {
  const title = input.title.trim()
  if (!title) throw new Error('title_required')
  if (!input.fields?.length) throw new Error('fields_required')

  const sess = getTeacherSession()
  if (!sess) throw new Error('session_required')

  if (USE_MOCK) {
    await delay(120)
    const custom = input.shareCode?.trim()
    if (custom) {
      const u = custom.toUpperCase()
      if (u.length < 4 || u.length > 40) throw new Error('share_code_length')
      if (!/^[A-Z0-9_-]+$/.test(u)) throw new Error('share_code_format')
    }
    const code = custom ? custom.toUpperCase() : mockGenerateShareCode()
    if (mockFindByShareCode(code)) throw new Error('share_code_taken')
    const id = crypto.randomUUID()
    const teacherViewToken = crypto.randomUUID()
    persistMockAssignment({
      id,
      teacherId: sess.teacherId,
      teacherViewToken,
      shareCode: code,
      title,
      description: input.description?.trim() || undefined,
      deadlineAt: input.deadlineAt?.trim() || undefined,
      createdAt: new Date().toISOString(),
      fields: input.fields,
    })
    return { id, shareCode: code, teacherViewToken }
  }

  const sb = getSupabaseClient()!
  const { data, error } = await sb.rpc('create_assignment_session', {
    p_session_token: sess.token,
    p_title: title,
    p_description: input.description?.trim() ?? null,
    p_deadline_at: input.deadlineAt
      ? new Date(input.deadlineAt).toISOString()
      : null,
    p_fields: input.fields,
    p_share_code: input.shareCode?.trim()
      ? input.shareCode.trim().toUpperCase()
      : null,
  })

  if (error) throw new Error(error.message)

  const raw = data as Record<string, unknown> | null
  if (!raw?.id) throw new Error('empty')
  const shareCode = String(raw.shareCode ?? raw.share_code ?? '')
  const teacherViewToken = String(
    raw.teacherViewToken ?? raw.teacher_view_token ?? ''
  )
  if (!shareCode || !teacherViewToken) throw new Error('empty')

  return {
    id: String(raw.id),
    shareCode,
    teacherViewToken,
  }
}

/**
 * أسماء ملفات URL-safe / ASCII فقط — Storage يرفض المسارات ذات الأحرف غير اللاتينية (مثلاً أرقام عربية في اسم لقطة الشاشة).
 */
function sanitizeFileName(name: string): string {
  const leaf = name.replace(/^.*[/\\]/, '').trim() || 'file'
  const lastDot = leaf.lastIndexOf('.')
  const ext =
    lastDot > 0 && lastDot < leaf.length - 1
      ? leaf.slice(lastDot).slice(0, 20)
      : ''
  const stem = lastDot > 0 ? leaf.slice(0, lastDot) : leaf

  const mapped = stem
    .normalize('NFKC')
    .replace(/[\u0660-\u0669]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x0660 + 0x0030)
    )
    .replace(/[\u06f0-\u06f9]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x06f0 + 0x0030)
    )

  const safeStem = mapped
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100)

  const safeExt = ext
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9.]+/g, '')
    .slice(0, 15)

  const out = `${safeStem || 'file'}${safeExt}`.slice(0, 120)
  return out || 'file'
}

function parseSubmissionForm(fd: FormData): {
  assignmentId: string
  answers: Record<string, string>
  fileRows: { fieldId: string; file: File; sort: number }[]
} {
  const assignmentId = String(fd.get('assignment_id') ?? '')
  const answers: Record<string, string> = {}
  const fileRows: { fieldId: string; file: File; sort: number }[] = []
  const counts = new Map<string, number>()

  for (const [key, value] of fd.entries()) {
    if (key === 'assignment_id') continue
    if (key.includes('_meta')) continue
    if (key.endsWith('[]') && value instanceof File) {
      const fieldId = key.slice(0, -2)
      const n = counts.get(fieldId) ?? 0
      counts.set(fieldId, n + 1)
      fileRows.push({ fieldId, file: value, sort: n })
    } else if (!(value instanceof File)) {
      answers[key] = String(value ?? '')
    }
  }
  return { assignmentId, answers, fileRows }
}

type PreparedFileRow = {
  fieldId: string
  /** الملف بعد الضغط (صور) أو الأصل — للمسار في التخزين و contentType */
  file: File
  sort: number
  /** اسم الملف كما اختاره الطالب — يُمرَّر إلى p_original_name ويُعرَض للأستاذ */
  originalName: string
}

async function prepareFilesForUpload(
  fileRows: { fieldId: string; file: File; sort: number }[]
): Promise<PreparedFileRow[]> {
  return Promise.all(
    fileRows.map(async (row) => {
      const originalName = row.file.name
      const file = await compressFileForUpload(row.file)
      return {
        fieldId: row.fieldId,
        sort: row.sort,
        file,
        originalName,
      }
    })
  )
}

function translateSubmitError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('not_found')) return 'الواجب غير موجود.'
  if (m.includes('deadline_passed')) return 'انتهى موعد التسليم.'
  if (m.includes('invalid_submission')) return 'تعذّر تسجيل الملف.'
  if (m.includes('invalid key')) {
    return 'اسم الملف يحتوي رموزًا لا يقبلها التخزين. غيّر الاسم أو أعد المحاولة.'
  }
  if (m.includes('mime') || m.includes('mime type')) {
    return 'نوع الملف غير مسموح. جرّب PDF أو صورة، أو راجع إعدادات التخزين.'
  }
  if (m.includes('payload too large') || m.includes('file_size_limit')) {
    return 'حجم الملف أكبر من المسموح.'
  }
  if (m.includes('row-level security') || m.includes('policy')) {
    return 'رفض الخادم للملف. تحقق من سياسات التخزين في Supabase.'
  }
  return message.trim() ? `تعذّر الإرسال: ${message}` : 'تعذّر الإرسال.'
}

export async function submitAssignment(
  shareCode: string,
  payload: FormData
): Promise<{ ok: boolean; message?: string }> {
  if (USE_MOCK) {
    await delay(350)
    const local = mockFindByShareCode(shareCode)
    if (local) {
      if (
        local.deadlineAt &&
        Date.now() > new Date(local.deadlineAt).getTime()
      ) {
        return { ok: false, message: 'انتهى موعد التسليم.' }
      }
      const { answers, fileRows } = parseSubmissionForm(payload)
      const prepared = await prepareFilesForUpload(fileRows)
      const submission: SubmissionRecord = {
        id: crypto.randomUUID(),
        studentName: answers.student_name || answers.name || 'طالب',
        submittedAt: new Date().toISOString(),
        textAnswer: answers.answer_text?.trim() || undefined,
        files: prepared.map((fr) => ({
          name: fr.originalName,
          url: URL.createObjectURL(fr.file),
          isImage: fr.file.type.startsWith('image/'),
        })),
      }
      mockAppendSubmission(shareCode, submission)
      return { ok: true }
    }
    if (
      shareCode.trim().toUpperCase() ===
      DEMO_ASSIGNMENT.shareCode.trim().toUpperCase()
    ) {
      console.info('[mock submit demo]', shareCode, [...payload.entries()])
      return { ok: true }
    }
    return { ok: false, message: 'الواجب غير موجود.' }
  }

  const sb = getSupabaseClient()!
  const { assignmentId, answers, fileRows } = parseSubmissionForm(payload)

  const answersJson: Record<string, string> = { ...answers }
  delete answersJson.assignment_id

  const { data: submissionId, error: createErr } = await sb.rpc(
    'create_submission',
    { p_share_code: normalizeShareCode(shareCode), p_answers: answersJson }
  )

  if (createErr || !submissionId) {
    return {
      ok: false,
      message: translateSubmitError(createErr?.message ?? ''),
    }
  }

  const subId = String(submissionId)
  const prepared = await prepareFilesForUpload(fileRows)

  for (const row of prepared) {
    const safe = sanitizeFileName(row.file.name)
    const objectPath = `${assignmentId}/${subId}/${row.fieldId}/${crypto.randomUUID()}_${safe}`

    const { error: upErr } = await sb.storage
      .from(SUBMISSION_BUCKET)
      .upload(objectPath, row.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: row.file.type || undefined,
      })

    if (upErr) {
      return {
        ok: false,
        message: translateSubmitError(upErr.message),
      }
    }

    const { error: regErr } = await sb.rpc('register_submission_asset', {
      p_share_code: normalizeShareCode(shareCode),
      p_submission_id: subId,
      p_field_id: row.fieldId,
      p_storage_path: objectPath,
      // اسم العرض للأستاذ — من جهاز الطالب قبل أي إعادة تسمية للتخزين
      p_original_name: row.originalName,
      p_mime_type: row.file.type || null,
      p_is_image: row.file.type.startsWith('image/'),
      p_sort_order: row.sort,
    })

    if (regErr) {
      return {
        ok: false,
        message: translateSubmitError(regErr.message),
      }
    }
  }

  return { ok: true }
}