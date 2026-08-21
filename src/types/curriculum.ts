import { z } from "zod";

/* curriculum.json のスキーマ。教材は完成済みデータなので、
   読み込み時に一度だけ検証し、想定外の形はその場で落とす。 */

export const TaskSchema = z.object({
  q: z.string(),
  a: z.array(z.string()).optional(),
  ok: z.number().int().optional(),
  type: z.string().optional(), // findfault の "multi"
});

export const FigurePartSchema = z.object({ n: z.string(), d: z.string() });
export const DimSchema = z.object({ label: z.string(), v: z.string() });

export const FigureSchema = z.object({
  id: z.string(),
  t: z.string(),
  min: z.number(),
  type: z.enum(["tree", "hotspot", "dimension", "findfault", "drawing", "list", "flow", "compare"]),
  lead: z.string(),
  parts: z.array(FigurePartSchema).optional(),
  faults: z.array(FigurePartSchema).optional(),
  points: z.array(FigurePartSchema).optional(),
  dims: z.array(DimSchema).optional(),
  content: z.record(z.string(), z.array(z.string())).optional().nullable(),
  task: TaskSchema,
});

export const CaseOptionSchema = z.object({ t: z.string(), ok: z.boolean(), fb: z.string() });

export const CaseSchema = z.object({
  id: z.string(),
  t: z.string(),
  min: z.number(),
  meta: z.record(z.string(), z.string()),
  situation: z.array(z.string()),
  ask: z.string(),
  options: z.array(CaseOptionSchema),
  causes: z.array(z.string()),
  prevention: z.array(z.string()),
  lesson: z.string(),
});

export const QuizSchema = z.object({
  q: z.string(),
  a: z.array(z.string()),
  ok: z.number().int(),
  why: z.string(),
});

export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  legal_scope: z.string(),
  legal_min: z.number(),
  scene: z.string(),
  budget: z.object({
    narration_min: z.number(),
    narration_chars: z.number(),
    figures_min: z.number(),
    cases_min: z.number(),
    quiz_min: z.number(),
    total_min: z.number(),
  }),
  script: z.array(z.string()),
  figures: z.array(FigureSchema),
  cases: z.array(CaseSchema),
  quiz: z.array(QuizSchema),
});

export const SubjectSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  legal_min: z.number(),
  lessons: z.array(LessonSchema),
});

export const CurriculumSchema = z.object({
  meta: z.object({
    title: z.string(),
    basis: z.string(),
    total_min: z.number(),
    generated: z.string(),
    stats: z.record(z.string(), z.number()),
  }),
  subjects: z.array(SubjectSchema),
});

export type Task = z.infer<typeof TaskSchema>;
export type Figure = z.infer<typeof FigureSchema>;
export type CaseStudy = z.infer<typeof CaseSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type Curriculum = z.infer<typeof CurriculumSchema>;
