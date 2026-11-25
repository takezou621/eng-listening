import { LINKING_LABELS, LINKING_SYMBOLS } from '@/features/lesson/linkingViz';
import type { LessonBundle } from '@/features/lesson/registry';
import type { LessonData, LessonLinkingNote, LessonSentence } from '@/features/lesson/types';

/**
 * 診断結果に基づく「あなた向けカリキュラム」生成と、
 * 各レッスン冒頭の「今日のキーフレーズ (音変化)」抽出ロジック。
 *
 * 既存 12 レッスンと既存の linking 注釈のみを使用し、新規 TTS や生成物改変は行わない。
 */

export type LinkingNoteType = LessonLinkingNote['type'];

const DEFAULT_FOCUS_ORDER: readonly LinkingNoteType[] = [
  'linking',
  'flapping',
  'palatalization',
  'reduction',
  'elision',
  'weak-form',
  'assimilation',
  'intrusion',
];

/** 手動カスタマイズ UI で選べる音変化タイプ (DEFAULT_FOCUS_ORDER と同一・表示順) */
export const CURRICULUM_FOCUS_TYPES: readonly LinkingNoteType[] = DEFAULT_FOCUS_ORDER;

/** 手動で重点選択できる音変化タイプの上限 (= ステップ数。UI・保存検証・ビルダーで共有) */
export const MAX_CURRICULUM_FOCUS_TYPES = 3;

/** 手動カスタマイズで指定できる難易度。'all' は制限なし (自動おすすめと同じ候補プール) */
export type CurriculumLevelFilter = 'all' | 'beginner' | 'intermediate';

export interface CurriculumCustomization {
  /** 手動で重点選択した音変化タイプ (最大 3・選択順を保持)。空 = おまかせ */
  focusTypes: LinkingNoteType[];
  /** 対象レッスンの難易度。'all' = 制限なし */
  levelFilter: CurriculumLevelFilter;
}

/** 手動カスタマイズが有効か (タイプ 1 つ以上の選択、または難易度の制限がある) */
export function isCurriculumCustomizationActive(
  custom?: CurriculumCustomization | null
): boolean {
  if (!custom) return false;
  return custom.focusTypes.length > 0 || custom.levelFilter !== 'all';
}

/** 今日のキーフレーズで優先する特徴的音変化タイプ (高頻度すぎる linking より学習価値が高いものを優先) */
const KEY_PHRASE_TYPE_PRIORITY: readonly LinkingNoteType[] = [
  'palatalization',
  'flapping',
  'reduction',
  'elision',
  'assimilation',
  'intrusion',
  'weak-form',
  'linking',
];

export interface CurriculumLessonItem {
  lessonId: string;
  titleJa: string;
  title: string;
  level: 'beginner' | 'intermediate';
  noteCount: number;
  durationSec: number;
  completed: boolean;
}

export interface CurriculumStep {
  stepNumber: 1 | 2 | 3;
  type: LinkingNoteType;
  label: string;
  symbol: string;
  isWeakTarget: boolean;
  focusReason: string;
  lessons: CurriculumLessonItem[];
}

export interface PersonalCurriculum {
  steps: CurriculumStep[];
  nextLessonId: string | null;
  nextLessonTitleJa: string | null;
  nextStepLabel: string | null;
  isCustomizedByDiagnostic: boolean;
  /** 手動カスタマイズ (重点タイプ・難易度) が適用されているか */
  isCustomizedManually: boolean;
}

function countTypeInLesson(lesson: LessonData, type: LinkingNoteType): number {
  let count = 0;
  for (const s of lesson.sentences) {
    for (const n of s.linking) {
      if (n.type === type) count += 1;
    }
  }
  return count;
}

/**
 * 診断結果 (missedTypes) と完了済みレッスン集合から、
 * 3 ステップの「あなた向けカリキュラム」を組み立てる。
 * - 弱点タイプが多い順にステップ 1〜3 を構成し、足りない場合は基礎頻出タイプで補う。
 * - 各ステップ内の対象レッスンは初級 → 中級の階段順、同レベル内では該当注釈数降順。
 * - ホーム「今日の1本」はこのカリキュラム先頭から最初の未完了レッスンと一致させる。
 * - custom が指定され有効な場合は手動モード: 重点タイプと難易度はユーザー指定を優先する
 *   (第 4 引数を省略した場合の出力は従来ロジックと完全同一)。
 */
export function buildPersonalCurriculum(
  missedTypes: Record<string, number> | undefined | null,
  completedLessonIds: Set<string>,
  bundles: LessonBundle[],
  custom?: CurriculumCustomization | null
): PersonalCurriculum {
  // 手動モードかどうか。activeCustom は検証済みの non-null 値 (無効内容は undefined = 自動おすすめ)
  const activeCustom =
    custom !== null && custom !== undefined && isCurriculumCustomizationActive(custom)
      ? custom
      : undefined;
  const isCustomizedManually = activeCustom !== undefined;
  const validTypes = new Set<LinkingNoteType>(DEFAULT_FOCUS_ORDER);
  const weakEntries = Object.entries(missedTypes ?? {})
    .filter(([type, count]) => validTypes.has(type as LinkingNoteType) && count > 0)
    .sort((a, b) => b[1] - a[1]);

  const isCustomizedByDiagnostic = weakEntries.length > 0;
  const weakTypeSet = new Set<LinkingNoteType>(
    weakEntries.map(([t]) => t as LinkingNoteType)
  );

  let selectedTypes: LinkingNoteType[];
  let manuallySelectedTypes: readonly LinkingNoteType[] = [];
  if (activeCustom) {
    // store で検証済みだが二重防御: 有効タイプのみ・重複排除・最大 3 に制限 (選択順は保持)
    const seen = new Set<LinkingNoteType>();
    manuallySelectedTypes = activeCustom.focusTypes
      .filter((t) => {
        if (!validTypes.has(t) || seen.has(t)) return false;
        seen.add(t);
        return true;
      })
      .slice(0, MAX_CURRICULUM_FOCUS_TYPES);
    // 重点タイプ未指定 (おまかせ) では診断上位タイプを使う (自動おすすめと同じ選び方)。
    // 難易度だけ変更した場合も診断由来の重点タイプが失われないようにする。
    selectedTypes =
      manuallySelectedTypes.length > 0
        ? [...manuallySelectedTypes]
        : weakEntries
            .slice(0, MAX_CURRICULUM_FOCUS_TYPES)
            .map(([t]) => t as LinkingNoteType);
  } else {
    selectedTypes = weakEntries
      .slice(0, 3)
      .map(([t]) => t as LinkingNoteType);
  }

  for (const fallback of DEFAULT_FOCUS_ORDER) {
    if (selectedTypes.length >= MAX_CURRICULUM_FOCUS_TYPES) break;
    if (!selectedTypes.includes(fallback)) {
      selectedTypes.push(fallback);
    }
  }

  // 手動モードでは候補プールを難易度で絞る。絞り込みで候補 0 件のステップだけ
  // 全プールへフォールバックし、全ステップでレッスンを必ず 1 本以上出す。
  const levelPool =
    activeCustom && activeCustom.levelFilter !== 'all'
      ? bundles.filter((b) => b.data.level === activeCustom.levelFilter)
      : bundles;

  const usedPrimaryIds = new Set<string>();
  const pickCandidates = (pool: LessonBundle[], type: LinkingNoteType) =>
    pool
      .map((b) => ({
        bundle: b,
        noteCount: countTypeInLesson(b.data, type),
      }))
      .filter((entry) => entry.noteCount > 0)
      .sort((a, b) => {
        // 未重複かつ未完了のレッスンを同レベル帯内で少し優先しつつ、初級→中級の段階性を維持
        const levelDiff =
          (a.bundle.data.level === 'beginner' ? 0 : 1) -
          (b.bundle.data.level === 'beginner' ? 0 : 1);
        if (levelDiff !== 0) return levelDiff;
        const aUsed = usedPrimaryIds.has(a.bundle.data.id) ? 1 : 0;
        const bUsed = usedPrimaryIds.has(b.bundle.data.id) ? 1 : 0;
        if (aUsed !== bUsed) return aUsed - bUsed;
        if (b.noteCount !== a.noteCount) return b.noteCount - a.noteCount;
        return a.bundle.data.id.localeCompare(b.bundle.data.id);
      });

  const steps: CurriculumStep[] = selectedTypes.map((type, idx) => {
    const stepNumber = (idx + 1) as 1 | 2 | 3;
    let candidates = pickCandidates(levelPool, type);
    if (activeCustom && candidates.length === 0 && levelPool.length !== bundles.length) {
      candidates = pickCandidates(bundles, type);
    }

    // 初級・中級がバランスよく入るよう最大 2 本を選出
    const picked: { bundle: LessonBundle; noteCount: number }[] = [];
    const beginnerFirst = candidates.find((c) => c.bundle.data.level === 'beginner');
    const intermediateFirst = candidates.find((c) => c.bundle.data.level === 'intermediate');
    if (beginnerFirst) picked.push(beginnerFirst);
    if (intermediateFirst && picked.length < 2) picked.push(intermediateFirst);
    for (const c of candidates) {
      if (picked.length >= 2) break;
      if (!picked.some((p) => p.bundle.data.id === c.bundle.data.id)) {
        picked.push(c);
      }
    }
    if (picked[0]) {
      usedPrimaryIds.add(picked[0].bundle.data.id);
    }

    const label = LINKING_LABELS[type];
    const isWeak = weakTypeSet.has(type);
    let focusReason: string;
    if (isWeak) {
      focusReason = `診断でつまずいた「${label}」を集中的に聞き取れるようにします。`;
    } else if (manuallySelectedTypes.includes(type)) {
      focusReason = `あなたが選んだ「${label}」を集中して聞き取れるようにします。`;
    } else {
      focusReason = `会話で頻出する「${label}」の感覚を自然な速さで定着させます。`;
    }

    return {
      stepNumber,
      type,
      label,
      symbol: LINKING_SYMBOLS[type],
      isWeakTarget: isWeak,
      focusReason,
      lessons: picked.map(({ bundle, noteCount }) => ({
        lessonId: bundle.data.id,
        titleJa: bundle.data.titleJa,
        title: bundle.data.title,
        level: bundle.data.level,
        noteCount,
        durationSec: bundle.data.durationSec,
        completed: completedLessonIds.has(bundle.data.id),
      })),
    };
  });

  // カリキュラムの先頭ステップから最初の未完了レッスンを「次の1本」にする
  let nextLessonId: string | null = null;
  let nextLessonTitleJa: string | null = null;
  let nextStepLabel: string | null = null;

  for (const step of steps) {
    const incomplete = step.lessons.find((l) => !l.completed);
    if (incomplete) {
      nextLessonId = incomplete.lessonId;
      nextLessonTitleJa = incomplete.titleJa;
      nextStepLabel = step.isWeakTarget
        ? `${step.label}強化・ステップ${step.stepNumber}`
        : `ステップ${step.stepNumber}・${step.label}`;
      break;
    }
  }

  if (!nextLessonId && steps[0]?.lessons[0]) {
    nextLessonId = steps[0].lessons[0].lessonId;
    nextLessonTitleJa = steps[0].lessons[0].titleJa;
    nextStepLabel = `復習・${steps[0].label}`;
  }

  return {
    steps,
    nextLessonId,
    nextLessonTitleJa,
    nextStepLabel,
    isCustomizedByDiagnostic,
    isCustomizedManually,
  };
}

export interface KeyPhraseInfo {
  sentenceIndex: number;
  sentence: LessonSentence;
  note: LessonLinkingNote;
}

/**
 * 各レッスンから「今日のキーフレーズ (音変化)」を 1 つ決定的に選出する。
 * 全 12 レッスンすべてに linking 注釈が存在するため、必ず代表キーフレーズが返る。
 */
export function getLessonKeyPhrase(lesson: LessonData): KeyPhraseInfo | null {
  for (const preferredType of KEY_PHRASE_TYPE_PRIORITY) {
    for (const sentence of lesson.sentences) {
      const note = sentence.linking.find((n) => n.type === preferredType);
      if (note) {
        return {
          sentenceIndex: sentence.index,
          sentence,
          note,
        };
      }
    }
  }
  for (const sentence of lesson.sentences) {
    if (sentence.linking.length > 0) {
      return {
        sentenceIndex: sentence.index,
        sentence,
        note: sentence.linking[0],
      };
    }
  }
  return null;
}
