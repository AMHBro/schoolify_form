import type {
  AssignmentField,
  AssignmentSchema,
  SubmissionRecord,
} from '../types/assignment'
import { DEMO_ASSIGNMENT } from '../mock/fixtures'
import {
  mockAppendSubmission,
  mockCreateAssignment as persistMockAssignment,
  mockFindByIdAndToken,
  mockFindByShareCode,
  mockGenerateShareCode,
  toSchema,
} from './localAssignmentStore'
import {
  getSupabaseClient,
  isSupabaseEnabled,
  SUBMISSION_BUCKET,
} from './supabaseClient'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

function parseFieldsColumn(raw: unknown): AssignmentField[] {
  if (Array.isArray(raw)) return raw as AssignmentField[]
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown
      return Array.isArray(p) ? (p as AssignmentField[]) : []
    } catch {
      return []
    }
  }
  return []
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

export function translateCreateError(message: string): string {
  if (message.includes('title_required')) return 'عنوان الواجب مطلوب.'
  if (message.includes('fields_required'))
    return 'أضف حقلًا واحدًا على الأقل.'
  if (message.includes('share_code_taken')) return 'كود المشاركة مستخدم مسبقًا.'
  if (message.includes('share_code_length')) return 'طول الكود غير مناسب (4–40).'
  if (message.includes('share_code_format')) return 'الكود يقبل أحرفًا إنجليزية وأرقامًا و _ و - فقط.'
  return 'تعذّر إنشاء الواجب.'
}

export async function createAssignment(
  input: CreateAssignmentInput
): Promise<CreateAssignmentResult> {
  const title = input.title.trim()
  if (!title) throw new Error('title_required')
  if (!input.fields?.length) throw new Error('fields_required')

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
      teacherViewToken,
      shareCode: code,
      title,
      description: input.description?.trim() || undefined,
      deadlineAt: input.deadlineAt?.trim() || undefined,
      fields: input.fields,
    })
    return { id, shareCode: code, teacherViewToken }
  }

  const sb = getSupabaseClient()!
  const { data, error } = await sb.rpc('create_assignment', {
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

function sanitizeFileName(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, '')
    .replace(/[^\w.\u0600-\u06FF-]+/g, '_')
    .slice(0, 120)
  return base || 'file'
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

function translateSubmitError(message: string): string {
  if (message.includes('not_found')) return 'الواجب غير موجود.'
  if (message.includes('deadline_passed')) return 'انتهى موعد التسليم.'
  if (message.includes('invalid_submission')) return 'تعذّر تسجيل الملف.'
  return 'تعذّر الإرسال.'
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
      const submission: SubmissionRecord = {
        id: crypto.randomUUID(),
        studentName: answers.student_name || answers.name || 'طالب',
        submittedAt: new Date().toISOString(),
        textAnswer: answers.answer_text?.trim() || undefined,
        files: fileRows.map((fr) => ({
          name: fr.file.name,
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

  const { data: submissionId, error: createErr } = await sb.rpc(
    'create_submission',
    { p_share_code: normalizeShareCode(shareCode), p_answers: answers }
  )

  if (createErr || !submissionId) {
    return {
      ok: false,
      message: translateSubmitError(createErr?.message ?? ''),
    }
  }

  const subId = String(submissionId)

  for (const row of fileRows) {
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
      p_original_name: row.file.name,
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