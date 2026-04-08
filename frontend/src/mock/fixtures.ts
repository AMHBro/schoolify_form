import type { AssignmentSchema, SubmissionRecord } from '../types/assignment'

/** Demo كود مشاركة — جرّب: /s/DEMO2024 */
export const DEMO_ASSIGNMENT: AssignmentSchema = {
  id: 'asg_demo_1',
  title: 'واجب الرياضيات — الفصل الثاني',
  description: 'ارفع صوراً واضحة للحل، ويمكنك إضافة ملاحظة نصية قصيرة.',
  deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  shareCode: 'DEMO2024',
  publicUrl: '/s/DEMO2024',
  fields: [
    {
      id: 'student_name',
      type: 'text',
      label: 'اسم الطالب',
      required: true,
    },
    {
      id: 'answer_text',
      type: 'text',
      label: 'ملاحظات على الحل (اختياري)',
      required: false,
    },
    {
      id: 'solution_images',
      type: 'images',
      label: 'صور الحل',
      required: true,
      accept: 'image/jpeg,image/png,image/webp',
      maxFiles: 8,
    },
    {
      id: 'extra_pdf',
      type: 'files',
      label: 'ملف PDF إضافي (اختياري)',
      required: false,
      accept: 'application/pdf',
      maxFiles: 1,
    },
  ],
}

const placeholderImg = (seed: string, w = 480, h = 360) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`

export const DEMO_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 'sub_1',
    studentName: 'آمنة الخالد',
    submittedAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
    textAnswer: 'أرفقت صفحتَي الحل بالكامل.',
    files: [
      {
        name: 'page1.jpg',
        url: placeholderImg('amina-1'),
        isImage: true,
      },
      {
        name: 'page2.jpg',
        url: placeholderImg('amina-2'),
        isImage: true,
      },
    ],
  },
  {
    id: 'sub_2',
    studentName: 'بدر السعيد',
    submittedAt: new Date(Date.now() - 3600_000 * 28).toISOString(),
    files: [
      {
        name: 'scan.jpg',
        url: placeholderImg('bader-1'),
        isImage: true,
      },
    ],
  },
  {
    id: 'sub_3',
    studentName: 'جمانة الفهد',
    submittedAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    textAnswer: 'السؤال الثالث في الصفحة الثانية.',
    files: [
      {
        name: 'hw.jpg',
        url: placeholderImg('jumana-1'),
        isImage: true,
      },
      {
        name: 'notes.pdf',
        url: '#',
        isImage: false,
      },
    ],
  },
]
