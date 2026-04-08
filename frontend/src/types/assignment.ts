export type FieldType = 'text' | 'images' | 'files'

export interface AssignmentField {
  id: string
  type: FieldType
  label: string
  required?: boolean
  /** MIME hints, e.g. image/*, application/pdf */
  accept?: string
  maxFiles?: number
}

/** Schema returned by Laravel / consumed by React to build the UI */
export interface AssignmentSchema {
  id: string
  title: string
  description?: string
  /** ISO 8601 — submissions blocked after this instant */
  deadlineAt?: string
  shareCode: string
  publicUrl: string
  fields: AssignmentField[]
}

export interface UploadedAssetPreview {
  id: string
  file: File
  previewUrl: string
  isImage: boolean
}

export interface SubmissionFileMeta {
  name: string
  url: string
  isImage: boolean
}

export interface SubmissionRecord {
  id: string
  studentName: string
  submittedAt: string
  textAnswer?: string
  files: SubmissionFileMeta[]
}
