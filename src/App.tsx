import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnswerCard } from './components/AnswerCard';
import { Figure } from './components/Figure';
import { Formula } from './components/Formula';
import { JsonDrawer } from './components/JsonDrawer';
import type { Scene } from './lib/dsl';
import { generateScene, AiGenerationError, AI_MAX_REPAIRS, type AiPhase } from './lib/ai/generate';
import { answerToScene, generateAnswer, AnswerGenerationError, type AnswerPayload } from './lib/ai/answer';
import {
  clearAiHistory,
  findAiHistory,
  loadAiHistory,
  newAiHistoryId,
  removeAiHistoryEntry,
  saveAiHistoryEntry,
  type AiHistoryEntry,
  type AiMode,
} from './lib/ai/history';
import { describeState } from './lib/describe';
import {
  createScene,
  isSceneId,
  routeScene,
  SCENE_GROUPS,
  SCENE_LABEL,
  sceneDefaults,
  type SceneId,
} from './lib/engines';
import { loadRecent, paramsSummary, saveRecent, timeAgo, type RecentEntry } from './lib/recent';

type Params = Record<string, number>;
type AiStatus = 'idle' | AiPhase | 'done' | 'error';
type SceneSource = 'builtin' | 'ai' | 'ai-repaired' | 'answer';

/** 投影字号档位；0 为默认。 */
const TYPE_SCALES = [1, 1.12, 1.26, 1.42] as const;

/** 图例：四类图版各一行，解释颜色/线型/小字的含义。 */
const LEGENDS = {
  array: '橙=基准/当前来源 · 蓝斜纹=比较 · 蓝=已就位/已排序',
  tree: '黑=已访问 · 蓝虚线=队列/栈 · 橙圈=当前',
  graph: '黑=已确定/已访问 · 蓝虚线=待访问 · 橙圈=当前 · 节点下=暂定距离',
  sequence: '蓝=SYN · 黑=ACK · 橙=FIN · 虚线=丢包',
} as const;

function readInitial(): { sceneId: SceneId; params: Params; index: number; aiEntry?: AiHistoryEntry } {
  const query = new URLSearchParams(window.location.search);
  const rawStep = Number.parseInt(query.get('step') ?? '', 10);
  const index = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 0;
  const rawScene = query.get('scene');

  let base: { sceneId: SceneId; params: Params; index: number };
  if (isSceneId(rawScene)) {
    const params = sceneDefaults(rawScene);
    for (const key of Object.keys(params)) {
      const value = Number.parseInt(query.get(key) ?? '', 10);
      if (Number.isFinite(value)) params[key] = value;
    }
    base = { sceneId: rawScene, params, index };
  } else {
    const recent = loadRecent();
    if (recent.length > 0) {
      base = { sceneId: recent[0].id, params: { ...sceneDefaults(recent[0].id), ...recent[0].params }, index };
    } else {
      base = { sceneId: 'quick', params: sceneDefaults('quick'), index };
    }
  }

  // #ai=<id>：从本地历史恢复刚才的 AI 场景 / 讲解，刷新与分享链接都能用
  const hash = window.location.hash.match(/^#ai=(.+)$/);
  if (hash?.[1]) {
    const entry = findAiHistory(decodeURIComponent(hash[1]));
    if (entry) return { ...base, index: 0, aiEntry: entry };
  }
  return base;
}

export default function App() {
  const initial = useMemo(readInitial, []);
  const [sceneId, setSceneId] = useState<SceneId>(initial.sceneId);
  const [params, setParams] = useState<Params>(initial.params);
  const [index, setIndex] = useState(initial.index);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [question, setQuestion] = useState(initial.aiEntry?.prompt ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [typeLevel, setTypeLevel] = useState(0);
  const [recent, setRecent] = useState<RecentEntry[]>(() => loadRecent());
  const [recentOpen, setRecentOpen] = useState(false);
  const [aiScene, setAiScene] = useState<Scene | null>(initial.aiEntry?.scene ?? null);
  const [aiAnswer, setAiAnswer] = useState<AnswerPayload | null>(initial.aiEntry?.answer ?? null);
  const [answerPrompt, setAnswerPrompt] = useState(initial.aiEntry?.prompt ?? '');
  const [aiSource, setAiSource] = useState<'ai' | 'ai-repaired' | null>(initial.aiEntry?.source ?? null);
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle');
  const [aiStream, setAiStream] = useState('');
  const [aiRound, setAiRound] = useState(0);
  const [aiMode, setAiMode] = useState<AiMode>(initial.aiEntry?.mode ?? 'scene');
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(initial.aiEntry?.id ?? null);
  const [aiHistory, setAiHistory] = useState<AiHistoryEntry[]>(() => loadAiHistory());
  const [aiHistoryOpen, setAiHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');

  const sceneRef = useRef(sceneId);
  const pendingParams = useRef<Params | null>(null);
  const paramsKey = JSON.stringify(params);
  const paramsRef = useRef(paramsKey);
  const recentPanelRef = useRef<HTMLDivElement>(null);
  const recentToggleRef = useRef<HTMLButtonElement>(null);
  const aiHistoryPanelRef = useRef<HTMLDivElement>(null);
  const aiHistoryToggleRef = useRef<HTMLButtonElement>(null);
  const aiAbort = useRef<AbortController | null>(null);

  const answerScene = useMemo(() => (aiAnswer ? answerToScene(aiAnswer, answerPrompt) : null), [aiAnswer, answerPrompt]);
  const scene = useMemo(
    () => answerScene ?? aiScene ?? createScene(sceneId, params),
    [answerScene, aiScene, sceneId, paramsKey],
  );
  const isAnswer = Boolean(aiAnswer);
  const steps = scene.steps;
  const last = steps.length - 1;
  const safeIndex = Math.min(index, last);
  const step = steps[safeIndex];
  const progress = last > 0 ? safeIndex / last : 0;
  const sizeParam = aiScene || isAnswer ? undefined : scene.params.find((param) => param.key === 'size');
  const codeLines = useMemo(() => new Set(steps.map((item) => item.codeLine)), [steps]);
  const sceneSource: SceneSource = isAnswer ? 'answer' : aiScene ? (aiSource ?? 'ai') : 'builtin';
  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return aiHistory;
    return aiHistory.filter(
      (entry) =>
        entry.prompt.toLowerCase().includes(query) ||
        entry.title.toLowerCase().includes(query),
    );
  }, [aiHistory, historyQuery]);
  const aiBusy = aiStatus === 'streaming' || aiStatus === 'validating' || aiStatus === 'repairing';
  const aiStatusText =
    aiStatus === 'streaming'
      ? (aiMode === 'answer' ? 'AI 正在讲解' : 'AI 正在生成')
      : aiStatus === 'validating'
        ? (aiMode === 'answer' ? '校验讲解结构' : '校验 Scene DSL')
        : aiStatus === 'repairing'
          ? `修复第 ${Math.max(1, aiRound)}/${AI_MAX_REPAIRS} 轮`
          : aiStatus === 'error'
            ? '生成失败'
            : '生成完成';
  const typeScale = TYPE_SCALES[typeLevel] ?? 1;
  const bigType = typeLevel > 0;
  /** 画布只跟随约七成，避免节点/边权在窄屏上互相压住。 */
  const canvasScale = 1 + (typeScale - 1) * 0.7;

  const noteTitle = useMemo(() => {
    const i = scene.note.indexOf('？');
    return i >= 0 ? scene.note.slice(0, i + 1) : scene.note;
  }, [scene.note]);
  const noteBody = useMemo(() => {
    const i = scene.note.indexOf('？');
    return i >= 0 ? scene.note.slice(i + 1) : '';
  }, [scene.note]);

  const goTo = (next: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(last, next)));
  };

  /** 播放键：到最后一帧时从头重播，而不是按了没反应。 */
  const togglePlay = () => {
    if (safeIndex >= last) {
      if (last > 0) {
        setIndex(0);
        setPlaying(true);
      }
      return;
    }
    setPlaying((value) => !value);
  };

  const jumpToLine = (line: number) => {
    for (let offset = 1; offset <= steps.length; offset += 1) {
      const candidate = (safeIndex + offset) % steps.length;
      if (steps[candidate].codeLine === line) {
        goTo(candidate);
        return;
      }
    }
  };

  const resetAi = () => {
    aiAbort.current?.abort();
    aiAbort.current = null;
    setAiScene(null);
    setAiAnswer(null);
    setAnswerPrompt('');
    setAiSource(null);
    setAiStatus('idle');
    setAiStream('');
    setAiRound(0);
    setAiMode('scene');
    setActiveHistoryId(null);
    setAiHistoryOpen(false);
  };

  const runAi = async (prompt: string) => {
    aiAbort.current?.abort();
    const controller = new AbortController();
    aiAbort.current = controller;
    setAiMode('scene');
    setAiStatus('streaming');
    setAiStream('');
    setAiRound(0);
    setNotice(null);
    setPlaying(false);

    try {
      const result = await generateScene(prompt, {
        signal: controller.signal,
        onStatus: (phase, round) => {
          setAiStatus(phase);
          if (phase === 'repairing') {
            setAiRound(round ?? 1);
            setAiStream('');
          }
        },
        onDelta: (delta) => setAiStream((previous) => previous + delta),
      });
      if (controller.signal.aborted) return;
      setAiScene(result.scene);
      setAiAnswer(null);
      setAnswerPrompt('');
      setAiSource(result.repaired ? 'ai-repaired' : 'ai');
      setAiStatus('done');
      setAiStream('');
      setAiRound(0);
      setQuestion('');
      setIndex(0);
      setPlaying(false);
      setNotice(
        result.repaired ? `AI 修复 ${result.attempts - 1} 轮后生成完成` : 'AI 生成完成',
      );

      const now = Date.now();
      const entry: AiHistoryEntry = {
        id: newAiHistoryId(),
        prompt,
        createdAt: now,
        updatedAt: now,
        mode: 'scene',
        title: result.scene.title,
        source: result.repaired ? 'ai-repaired' : 'ai',
        layout: result.scene.layout,
        stepCount: result.scene.steps.length,
        scene: result.scene,
      };
      setAiHistory(saveAiHistoryEntry(entry));
      setActiveHistoryId(entry.id);
    } catch (error) {
      if (controller.signal.aborted) {
        setAiStatus('idle');
        return;
      }
      setAiStatus('error');
      setNotice(
        error instanceof AiGenerationError
          ? `AI 生成失败：${error.issues
              .slice(0, 2)
              .map((issue) => `${issue.path || '$'} ${issue.message}`)
              .join('；')}`
          : error instanceof Error
            ? error.message
            : 'AI 生成失败',
      );
    } finally {
      if (aiAbort.current === controller) aiAbort.current = null;
    }
  };

  const runAnswer = async (prompt: string) => {
    aiAbort.current?.abort();
    const controller = new AbortController();
    aiAbort.current = controller;
    setAiMode('answer');
    setAiStatus('streaming');
    setAiStream('');
    setAiRound(0);
    setNotice(null);
    setPlaying(false);

    try {
      const result = await generateAnswer(prompt, {
        signal: controller.signal,
        onStatus: (phase, round) => {
          setAiStatus(phase);
          if (phase === 'repairing') {
            setAiRound(round ?? 1);
            setAiStream('');
          }
        },
        onDelta: (delta) => setAiStream((previous) => previous + delta),
      });
      if (controller.signal.aborted) return;
      setAiAnswer(result.answer);
      setAnswerPrompt(prompt);
      setAiScene(null);
      setAiSource(result.repaired ? 'ai-repaired' : 'ai');
      setAiStatus('done');
      setAiStream('');
      setAiRound(0);
      setQuestion('');
      setIndex(0);
      setPlaying(false);
      setNotice(result.repaired ? 'AI 讲解修复后完成' : 'AI 讲解完成');

      const now = Date.now();
      const entry: AiHistoryEntry = {
        id: newAiHistoryId(),
        prompt,
        createdAt: now,
        updatedAt: now,
        mode: 'answer',
        title: result.answer.title,
        source: result.repaired ? 'ai-repaired' : 'ai',
        answer: result.answer,
      };
      setAiHistory(saveAiHistoryEntry(entry));
      setActiveHistoryId(entry.id);
    } catch (error) {
      if (controller.signal.aborted) {
        setAiStatus('idle');
        return;
      }
      setAiStatus('error');
      setNotice(
        error instanceof AnswerGenerationError
          ? `AI 讲解失败：${error.issues
              .slice(0, 2)
              .map((issue) => `${issue.path || '$'} ${issue.message}`)
              .join('；')}`
          : error instanceof Error
            ? error.message
            : 'AI 讲解失败',
      );
    } finally {
      if (aiAbort.current === controller) aiAbort.current = null;
    }
  };

  const restoreAiEntry = (entry: AiHistoryEntry) => {
    aiAbort.current?.abort();
    aiAbort.current = null;
    setAiMode(entry.mode);
    setAiScene(entry.mode === 'scene' ? entry.scene ?? null : null);
    setAiAnswer(entry.mode === 'answer' ? entry.answer ?? null : null);
    setAnswerPrompt(entry.prompt);
    setAiSource(entry.source);
    setAiStatus('done');
    setAiStream('');
    setAiRound(0);
    setQuestion(entry.prompt);
    setActiveHistoryId(entry.id);
    setIndex(0);
    setPlaying(false);
    setAiHistoryOpen(false);
    setNotice('已从 AI 历史恢复');
  };

  const deleteAiHistory = (id: string) => {
    const next = removeAiHistoryEntry(id);
    setAiHistory(next);
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
      setNotice('已删除当前 AI 历史');
    }
  };

  const clearHistory = () => {
    clearAiHistory();
    setAiHistory([]);
    setActiveHistoryId(null);
    setNotice('AI 历史已清空');
  };

  const cancelAi = () => {
    aiAbort.current?.abort();
    aiAbort.current = null;
    setAiStatus('idle');
    setAiStream('');
    setAiRound(0);
    setNotice('已停止生成');
  };

  const switchScene = (id: SceneId) => {
    resetAi();
    setSceneId(id);
    setIndex(0);
  };

  const restoreRecent = (entry: RecentEntry) => {
    resetAi();
    const next = { ...sceneDefaults(entry.id), ...entry.params };
    if (entry.id === sceneId) {
      setParams(next);
    } else {
      pendingParams.current = next;
      setSceneId(entry.id);
    }
    setIndex(0);
    setRecentOpen(false);
  };

  // 切换场景：重置参数与播放状态
  useEffect(() => {
    if (sceneRef.current === sceneId) return;
    sceneRef.current = sceneId;
    setParams(pendingParams.current ?? sceneDefaults(sceneId));
    pendingParams.current = null;
    setIndex(0);
    setPlaying(false);
    setNotice(null);
    setRecentOpen(false);
  }, [sceneId]);

  // 参数变化：重算后回到第 1 帧。
  // 用「上一次的参数键」判断，而不是 mounted 标记：StrictMode 会把挂载 effect 跑两遍，
  // 用 mounted 标记会在第二次运行时把 &step 深链重置回第 1 帧。
  useEffect(() => {
    if (paramsRef.current === paramsKey) return;
    paramsRef.current = paramsKey;
    setIndex(0);
    setPlaying(false);
  }, [paramsKey]);

  // 地址栏：场景、参数与当前帧都可复现；step 用 0 基下标。
  useEffect(() => {
    if (aiScene || aiAnswer) return;
    const url = new URL(window.location.href);
    url.searchParams.set('scene', sceneId);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    for (const key of [...url.searchParams.keys()]) {
      if (key !== 'scene' && key !== 'step' && !(key in params)) url.searchParams.delete(key);
    }
    if (safeIndex > 0) {
      url.searchParams.set('step', String(safeIndex));
    } else {
      url.searchParams.delete('step');
    }
    window.history.replaceState(null, '', url);
  }, [sceneId, paramsKey, safeIndex, aiScene, aiAnswer]);

  // AI 历史深链：恢复后 URL 带 #ai=<id>；切回内置场景时移除
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeHistoryId && (aiScene || aiAnswer)) {
      url.hash = `ai=${encodeURIComponent(activeHistoryId)}`;
    } else if (url.hash.startsWith('#ai=')) {
      url.hash = '';
    }
    window.history.replaceState(null, '', url);
  }, [activeHistoryId, aiScene, aiAnswer]);

  // 地址栏可能带来越界参数：按场景规格钳制，保证滑块与画面一致
  useEffect(() => {
    if (aiScene || aiAnswer) return;
    let changed = false;
    const next = { ...params };
    for (const spec of scene.params) {
      const value = next[spec.key];
      if (value === undefined) continue;
      const clamped = Math.min(spec.max, Math.max(spec.min, Math.round(value)));
      if (clamped !== value) {
        next[spec.key] = clamped;
        changed = true;
      }
    }
    if (changed) setParams(next);
  }, [scene, aiScene, aiAnswer]);

  // 最近打开（防抖，避免拖滑块时刷屏）；AI 场景/讲解不写内置场景的往期
  useEffect(() => {
    if (aiScene || aiAnswer) return;
    const timer = window.setTimeout(() => {
      setRecent(saveRecent({ id: sceneId, params, at: Date.now() }));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [sceneId, paramsKey, aiScene, aiAnswer]);

  // AI 历史打开：焦点移入搜索框；点面板外关闭；Esc 由全局键盘处理
  useEffect(() => {
    if (!aiHistoryOpen) return;
    const panel = aiHistoryPanelRef.current;
    panel?.querySelector<HTMLInputElement>('input')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panel?.contains(target)) return;
      if (aiHistoryToggleRef.current?.contains(target)) return;
      setAiHistoryOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [aiHistoryOpen]);

  // 往期打开：把焦点移进面板；点面板外关闭；Esc 由全局键盘处理
  useEffect(() => {
    if (!recentOpen) return;
    const panel = recentPanelRef.current;
    const first = panel?.querySelector<HTMLElement>('button');
    (first ?? panel)?.focus();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panel?.contains(target) || recentToggleRef.current?.contains(target)) return;
      setRecentOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [recentOpen]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const duration = steps[safeIndex]?.durationMs ?? 900;
    const id = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, last));
    }, duration / speed);
    return () => window.clearTimeout(id);
  }, [playing, index, speed, last, safeIndex, steps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;

      // Esc 先处理：即使焦点在输入框里，也能退出演示 / 收起往期/AI 历史
      if (e.key === 'Escape') {
        setFocus(false);
        setRecentOpen(false);
        setAiHistoryOpen(false);
        return;
      }

      // 输入框、文本域、下拉框、contenteditable 不抢快捷键
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Space / Enter 属于按钮的默认激活键，不能被全局播放快捷键劫持
      const interactive = target?.closest('button, a, summary, [role="button"], [role="slider"]');
      if (interactive && (e.code === 'Space' || e.key === 'Enter')) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(safeIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(safeIndex - 1);
      } else if (e.key === 'Home') {
        goTo(0);
      } else if (e.key === 'End') {
        goTo(last);
      } else if (e.key === 'f' || e.key === 'F') {
        setFocus((value) => !value);
      } else if (e.key.toLowerCase() === 't') {
        setTypeLevel((value) =>
          e.shiftKey ? Math.max(0, value - 1) : Math.min(TYPE_SCALES.length - 1, value + 1),
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, safeIndex]);

  const submitAsk = () => {
    if (aiBusy) return;
    const prompt = question.trim();
    if (!prompt) {
      setNotice('先写一句想看什么，例如「二分查找」。');
      return;
    }
    if (aiMode === 'answer') {
      void runAnswer(prompt);
      return;
    }
    const next = routeScene(prompt);
    if (next) {
      switchScene(next);
      setQuestion('');
      setNotice(null);
      return;
    }
    void runAi(prompt);
  };

  return (
    <div
      className={`app${focus ? ' focus' : ''}${bigType ? ' big-type' : ''}`}
      style={bigType ? ({ '--type-scale': typeScale } as CSSProperties) : undefined}
    >
      <header className="mast">
        <div className="brand">ALGOVIZ</div>
        <div className="mid" aria-live="polite">
          {aiBusy ? aiStatusText : scene.section}
        </div>
        <div className="type-controls" role="group" aria-label="投影字号">
          <button
            className="type-step"
            type="button"
            aria-label="缩小讲义字号"
            title="缩小（Shift + T）"
            disabled={typeLevel === 0}
            onClick={() => setTypeLevel((value) => Math.max(0, value - 1))}
          >
            A−
          </button>
          <span className="type-value" aria-live="polite">
            {Math.round(typeScale * 100)}%
          </span>
          <button
            className="type-step"
            type="button"
            aria-label="放大讲义字号"
            title="放大（T）"
            disabled={typeLevel === TYPE_SCALES.length - 1}
            onClick={() => setTypeLevel((value) => Math.min(TYPE_SCALES.length - 1, value + 1))}
          >
            A+
          </button>
        </div>
        <button
          className="focus-toggle"
          type="button"
          aria-pressed={focus}
          title="板书模式：隐藏左页，把图版放大（F / Esc）"
          onClick={() => setFocus((value) => !value)}
        >
          {focus ? '退出演示' : '演示'}
        </button>
        <div className="pg">
          {scene.pages[0]} — {scene.pages[1]}
        </div>
      </header>

      <main className="spread">
        <section className="page left">
          <div className="left-scroll">
            <div className="chapter">{scene.chapter}</div>
            <div className="scene-switch" role="group" aria-label="选择场景">
              {SCENE_GROUPS.map((group) => (
                <div className="scene-group" key={group.id}>
                  <span>{group.label}</span>
                  {group.scenes.map((id) => (
                    <button
                      key={id}
                      aria-pressed={!aiScene && id === sceneId}
                      className={!aiScene && id === sceneId ? 'on' : ''}
                      onClick={() => switchScene(id)}
                    >
                      {SCENE_LABEL[id]}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <h1>{scene.title}</h1>
            <p className="dek">{scene.summary}</p>

            <div className="body">
              {scene.body.map((paragraph, i) => (
                <div className="bcol" key={i}>
                  <p>{paragraph}</p>
                </div>
              ))}
            </div>

            <div className="formula">
              <Formula tex={scene.formula} />
              <span>
                平均 {scene.complexity.time} · 空间 {scene.complexity.space}
                {sizeParam ? ` · n = ${params.size ?? sizeParam.default}` : ''}
              </span>
            </div>

            <div className="code">
              {scene.code.map((line, i) => {
                const hasStep = codeLines.has(i + 1);
                return (
                  <button
                    key={`${i}-${line}`}
                    type="button"
                    disabled={!hasStep}
                    className={`${step.codeLine === i + 1 ? 'line active' : 'line'}${hasStep ? '' : ' muted'}`}
                    aria-label={
                      hasStep
                        ? `跳到伪代码第 ${i + 1} 行对应的步骤`
                        : `伪代码第 ${i + 1} 行没有对应的动画步骤`
                    }
                    title={hasStep ? undefined : '这一行没有对应的动画步骤'}
                    onClick={hasStep ? () => jumpToLine(i + 1) : undefined}
                  >
                    <span className="ln">{i + 1}</span>
                    {line}
                  </button>
                );
              })}
            </div>

            <div className="facts">
              {scene.facts.map((fact) => (
                <div key={fact.label}>
                  {fact.label}
                  <b>{fact.value}</b>
                </div>
              ))}
            </div>

            {!isAnswer ? (
              <div className="step-index">
                <div className="si-title">
                  <span>本节步骤</span>
                  <span>{String(steps.length).padStart(2, '0')} STEPS</span>
                </div>
                {scene.outline.map((item, i) => (
                  <button className="si-row" key={item.label} type="button" onClick={() => goTo(item.step ?? 0)}>
                    <b>{String(i + 1).padStart(2, '0')}</b>
                    <span>{item.label}</span>
                    <i />
                    <em>{item.value}</em>
                  </button>
                ))}
              </div>
            ) : null}

            {scene.glossary && scene.glossary.length > 0 ? (
              <div className="glossary" aria-label="缩写与字段">
                <div className="glossary-title">缩写与字段</div>
                <dl>
                  {scene.glossary.map((item) => (
                    <div className="glossary-item" key={item.term}>
                      <dt>{item.term}</dt>
                      <dd>{item.text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {!aiScene && !aiAnswer && scene.params.length > 0 ? (
              <div className="params" role="group" aria-label="参数">
                <div className="params-title">参数</div>
                {scene.params.map((spec) => {
                  const value = params[spec.key] ?? spec.default;
                  return (
                    <div className="param" key={spec.key}>
                      <span className="param-label">{spec.label}</span>
                      {spec.kind === 'int' ? (
                        <>
                          <input
                            type="range"
                            min={spec.min}
                            max={spec.max}
                            step={1}
                            value={value}
                            aria-label={spec.label}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              setParams((prev) => ({ ...prev, [spec.key]: next }));
                            }}
                          />
                          <b>{value}</b>
                        </>
                      ) : (
                        <div className="seg" role="group" aria-label={spec.label}>
                          {spec.options?.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={value === option.value}
                              onClick={() => setParams((prev) => ({ ...prev, [spec.key]: option.value }))}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="margin-note">
              <b>{noteTitle}</b>
              {noteBody}
            </div>

            {!isAnswer ? (
              <details className="step-list">
                <summary>全部 {steps.length} 步</summary>
                <ol>
                  {steps.map((item, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        aria-current={i === safeIndex ? 'step' : undefined}
                        onClick={() => goTo(i)}
                      >
                        <b>{String(i + 1).padStart(2, '0')}</b>
                        <span>{item.caption}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}

            <JsonDrawer scene={scene} />

            {notice ? (
              <p className="ask-notice" role="status">
                {notice}
              </p>
            ) : null}

            {aiStatus !== 'idle' && aiStatus !== 'done' ? (
              <div className={`ai-trace ai-trace-${aiStatus}`}>
                <div className="ai-trace-head">
                  <span role="status" aria-live="polite">
                    {aiStatusText}
                  </span>
                  <span>{aiStream.length} 字</span>
                  {aiBusy ? (
                    <button type="button" onClick={cancelAi}>
                      停止
                    </button>
                  ) : null}
                </div>
                {aiStream ? (
                  <pre>{aiStream.slice(-1800)}</pre>
                ) : (
                  <p>{aiStatus === 'streaming' ? '等待第一个 token…' : '正在校验结构…'}</p>
                )}
              </div>
            ) : null}

            <div className="ask-mode" role="group" aria-label="回答方式">
              <span>方式</span>
              <button
                type="button"
                aria-pressed={aiMode === 'scene'}
                disabled={aiBusy}
                onClick={() => setAiMode('scene')}
              >
                生成图解
              </button>
              <button
                type="button"
                aria-pressed={aiMode === 'answer'}
                disabled={aiBusy}
                onClick={() => setAiMode('answer')}
              >
                直接讲解
              </button>
            </div>

            <form
              className="ask"
              onSubmit={(e) => {
                e.preventDefault();
                submitAsk();
              }}
            >
              <input
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setNotice(null);
                  if (aiStatus === 'error') {
                    setAiStatus('idle');
                    setAiStream('');
                  }
                }}
                maxLength={200}
                disabled={aiBusy}
                placeholder={
                  aiMode === 'answer'
                    ? '问一个算法概念，例如「为什么快排最坏是 O(n²)？」'
                    : scene.question
                }
                title={
                  aiMode === 'answer'
                    ? '直接讲解：返回结构化文字回答，不生成动画'
                    : '生成图解：命中内置场景直接切换，其他主题用 AI 生成'
                }
                aria-label="追问"
              />
              <button
                type="submit"
                aria-label={aiBusy ? (aiMode === 'answer' ? 'AI 讲解中' : 'AI 生成中') : '提交追问'}
                disabled={aiBusy || !question.trim()}
              >
                {aiBusy ? '…' : '→'}
              </button>
            </form>
          </div>

          <div className="pgl-row">
            <span className="pgl">{scene.pages[0]}</span>
            <div className="history-actions">
              <button
                ref={aiHistoryToggleRef}
                className="recent-toggle"
                type="button"
                aria-expanded={aiHistoryOpen}
                onClick={() => {
                  setAiHistoryOpen((value) => !value);
                  setRecentOpen(false);
                }}
              >
                AI 历史{aiHistory.length > 0 ? ` · ${aiHistory.length}` : ''}
              </button>
              <button
                ref={recentToggleRef}
                className="recent-toggle"
                type="button"
                aria-expanded={recentOpen}
                onClick={() => {
                  setRecentOpen((value) => !value);
                  setAiHistoryOpen(false);
                }}
              >
                往期{recent.length > 0 ? ` · ${recent.length}` : ''}
              </button>
            </div>
          </div>

          {aiHistoryOpen ? (
            <div
              ref={aiHistoryPanelRef}
              className="ai-history-panel"
              role="dialog"
              aria-modal="true"
              aria-label="AI 历史"
              tabIndex={-1}
            >
              <div className="ai-history-head">
                <b>AI 历史 · {aiHistory.length}/20</b>
                <span>
                  {aiHistory.length > 0 ? (
                    <button type="button" onClick={clearHistory}>
                      清空
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setAiHistoryOpen(false)}>
                    关闭
                  </button>
                </span>
              </div>
              <input
                className="ai-history-search"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="搜索问题或标题"
                aria-label="搜索 AI 历史"
              />
              {filteredHistory.length === 0 ? (
                <p className="ai-history-empty">
                  {aiHistory.length === 0 ? '还没有 AI 记录；生成一次后会自动保存。' : '没有匹配的问题。'}
                </p>
              ) : (
                <div className="ai-history-list">
                  {filteredHistory.map((entry) => (
                    <div className="ai-history-item" key={entry.id}>
                      <button
                        className="ai-history-main"
                        type="button"
                        onClick={() => restoreAiEntry(entry)}
                      >
                        <span className="ai-history-mode">
                          {entry.mode === 'answer' ? '讲解' : '图解'}
                        </span>
                        <b>{entry.title}</b>
                        <span>{timeAgo(entry.updatedAt)}</span>
                      </button>
                      <button
                        className="ai-history-del"
                        type="button"
                        aria-label={`删除 ${entry.title}`}
                        title="删除这条历史"
                        onClick={() => deleteAiHistory(entry.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {recentOpen ? (
            <div
              ref={recentPanelRef}
              className="recent-panel"
              role="dialog"
              aria-modal="true"
              aria-label="往期讲义"
              tabIndex={-1}
            >
              {recent.length === 0 ? (
                <p>还没有记录，切换一个场景就会留下痕迹。</p>
              ) : (
                recent.map((entry) => (
                  <button key={`${entry.id}-${entry.at}`} type="button" onClick={() => restoreRecent(entry)}>
                    <b>{SCENE_LABEL[entry.id]}</b>
                    <span>{paramsSummary(entry.params, entry.id)}</span>
                    <em>{timeAgo(entry.at)}</em>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </section>

        <section className="page right">
          <div className="fig-head">
            <span>
              <b>{isAnswer ? 'NOTE' : 'FIG'}. {scene.figNo}</b> — {scene.figure}
            </span>
            <span className={`source-badge ${sceneSource}`}>
              {isAnswer
                ? aiSource === 'ai-repaired'
                  ? 'AI 修复后'
                  : 'AI 讲解'
                : sceneSource === 'builtin'
                  ? '本地引擎'
                  : sceneSource === 'ai-repaired'
                    ? 'AI 修复后'
                    : 'AI 生成'}
            </span>
            {!isAnswer ? (
              <span className="orange">
                第 {safeIndex + 1} 帧 / {steps.length}
              </span>
            ) : null}
          </div>

          {isAnswer ? (
            <div className="figure answer-figure">
              <AnswerCard
                answer={aiAnswer!}
                onFollowup={(text) => {
                  setQuestion(text);
                  setAiMode('answer');
                }}
              />
            </div>
          ) : (
            <>
              <div className="figure">
                <Figure step={step} typeScale={canvasScale} />
              </div>

              <div className="caption">
                <b>图 {scene.figNo}</b> · {step.caption}
              </div>

              <div className="figure-key" aria-label="图例">
                {LEGENDS[scene.layout]}
              </div>

              {step.metrics && step.metrics.length > 0 ? (
                <div className="metrics" aria-label="过程量">
                  {step.metrics.map((metric) => (
                    <span key={metric.label}>
                      {metric.label}
                      <b>{metric.value}</b>
                    </span>
                  ))}
                </div>
              ) : null}

              <p className="sr-only" aria-live={playing ? 'off' : 'polite'}>
                {describeState(step.state)}
              </p>

              <ol className="sr-only" aria-label="本场景全部步骤">
                {steps.map((item, i) => (
                  <li key={i}>{`第 ${i + 1} 步：${item.caption}`}</li>
                ))}
              </ol>

              <div
                className="ruler"
                role="slider"
                aria-label="时间轴"
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={safeIndex + 1}
                aria-valuetext={`第 ${safeIndex + 1} 步，共 ${steps.length} 步`}
                tabIndex={0}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.focus();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                  goTo(Math.round(ratio * last));
                }}
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                  goTo(Math.round(ratio * last));
                }}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                }}
                onPointerCancel={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                }}
              >
                <div className="marker" style={{ left: `${progress * 100}%` }} />
              </div>

              <div className="transport">
                <button className="pl" aria-label="回到开头" title="回到第 1 帧（Home）" onClick={() => goTo(0)}>
                  ↺
                </button>
                <button className="pl" aria-label="上一步" onClick={() => goTo(safeIndex - 1)}>
                  ◁
                </button>
                <button
                  className="pl play"
                  aria-label={safeIndex >= last ? '从头播放' : playing ? '暂停' : '播放'}
                  onClick={togglePlay}
                >
                  {playing ? 'II' : '▶'}
                </button>
                <button className="pl" aria-label="下一步" onClick={() => goTo(safeIndex + 1)}>
                  ▷
                </button>
                <span>
                  <b>{String(safeIndex + 1).padStart(3, '0')}</b> / {String(steps.length).padStart(3, '0')}
                </span>
                <button
                  className="speed"
                  aria-label={`播放速度，当前 ${speed} 倍`}
                  title="0.5× / 1× / 1.5× / 2×"
                  onClick={() => setSpeed((s) => (s === 0.5 ? 1 : s === 1 ? 1.5 : s === 1.5 ? 2 : 0.5))}
                >
                  {speed.toFixed(1)}×
                </button>
                <span className="hint">{focus ? 'F / Esc 退出演示' : '← → 单步 · SPACE 播放 · F 演示'}</span>
              </div>
            </>
          )}

          <div className="pgr">{scene.pages[1]}</div>
        </section>
      </main>
    </div>
  );
}
