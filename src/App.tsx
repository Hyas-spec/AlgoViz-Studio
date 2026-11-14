import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Figure } from './components/Figure';
import { Formula } from './components/Formula';
import { JsonDrawer } from './components/JsonDrawer';
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

/** 投影字号档位；0 为默认。 */
const TYPE_SCALES = [1, 1.12, 1.26, 1.42] as const;

/** 图例：四类图版各一行，解释颜色/线型/小字的含义。 */
const LEGENDS = {
  array: '橙=基准/当前来源 · 蓝斜纹=比较 · 蓝=已就位/已排序',
  tree: '黑=已访问 · 蓝虚线=队列/栈 · 橙圈=当前',
  graph: '黑=已确定/已访问 · 蓝虚线=待访问 · 橙圈=当前 · 节点下=暂定距离',
  sequence: '蓝=SYN · 黑=ACK · 橙=FIN · 虚线=丢包',
} as const;

function readInitial(): { sceneId: SceneId; params: Params; index: number } {
  const query = new URLSearchParams(window.location.search);
  const rawStep = Number.parseInt(query.get('step') ?? '', 10);
  const index = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 0;
  const rawScene = query.get('scene');

  if (isSceneId(rawScene)) {
    const params = sceneDefaults(rawScene);
    for (const key of Object.keys(params)) {
      const value = Number.parseInt(query.get(key) ?? '', 10);
      if (Number.isFinite(value)) params[key] = value;
    }
    return { sceneId: rawScene, params, index };
  }

  const recent = loadRecent();
  if (recent.length > 0) {
    return { sceneId: recent[0].id, params: { ...sceneDefaults(recent[0].id), ...recent[0].params }, index: 0 };
  }
  return { sceneId: 'quick', params: sceneDefaults('quick'), index };
}

export default function App() {
  const initial = useMemo(readInitial, []);
  const [sceneId, setSceneId] = useState<SceneId>(initial.sceneId);
  const [params, setParams] = useState<Params>(initial.params);
  const [index, setIndex] = useState(initial.index);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [typeLevel, setTypeLevel] = useState(0);
  const [recent, setRecent] = useState<RecentEntry[]>(() => loadRecent());
  const [recentOpen, setRecentOpen] = useState(false);

  const sceneRef = useRef(sceneId);
  const pendingParams = useRef<Params | null>(null);
  const paramsKey = JSON.stringify(params);
  const paramsRef = useRef(paramsKey);
  const recentPanelRef = useRef<HTMLDivElement>(null);
  const recentToggleRef = useRef<HTMLButtonElement>(null);

  const scene = useMemo(() => createScene(sceneId, params), [sceneId, paramsKey]);
  const steps = scene.steps;
  const last = steps.length - 1;
  const safeIndex = Math.min(index, last);
  const step = steps[safeIndex];
  const progress = last > 0 ? safeIndex / last : 0;
  const sizeParam = scene.params.find((param) => param.key === 'size');
  const codeLines = useMemo(() => new Set(steps.map((item) => item.codeLine)), [steps]);
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

  const switchScene = (id: SceneId) => {
    setSceneId(id);
    setIndex(0);
  };

  const restoreRecent = (entry: RecentEntry) => {
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
  }, [sceneId, paramsKey, safeIndex]);

  // 地址栏可能带来越界参数：按场景规格钳制，保证滑块与画面一致
  useEffect(() => {
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
  }, [scene]);

  // 最近打开（防抖，避免拖滑块时刷屏）
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecent(saveRecent({ id: sceneId, params, at: Date.now() }));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [sceneId, paramsKey]);

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

      // Esc 先处理：即使焦点在输入框里，也能退出演示 / 收起往期
      if (e.key === 'Escape') {
        setFocus(false);
        setRecentOpen(false);
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

  return (
    <div
      className={`app${focus ? ' focus' : ''}${bigType ? ' big-type' : ''}`}
      style={bigType ? ({ '--type-scale': typeScale } as CSSProperties) : undefined}
    >
      <header className="mast">
        <div className="brand">ALGOVIZ</div>
        <div className="mid">{scene.section}</div>
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
                      aria-pressed={id === sceneId}
                      className={id === sceneId ? 'on' : ''}
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

            {scene.params.length > 0 ? (
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

            <JsonDrawer scene={scene} />

            {notice ? (
              <p className="ask-notice" role="status">
                {notice}
              </p>
            ) : null}

            <form
              className="ask"
              onSubmit={(e) => {
                e.preventDefault();
                const next = routeScene(question);
                if (next) {
                  switchScene(next);
                  setQuestion('');
                } else {
                  setNotice(
                    `「${question.trim() || '这句追问'}」没有命中内置场景。AI 生成正在接线（11/15），先试试上方的十个内置场景。`,
                  );
                }
              }}
            >
              <input
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setNotice(null);
                }}
                placeholder={scene.question}
                aria-label="追问"
              />
              <button type="submit" aria-label="提交追问">
                →
              </button>
            </form>
          </div>

          <div className="pgl-row">
            <span className="pgl">{scene.pages[0]}</span>
            <button
              ref={recentToggleRef}
              className="recent-toggle"
              type="button"
              aria-expanded={recentOpen}
              onClick={() => setRecentOpen((value) => !value)}
            >
              往期{recent.length > 0 ? ` · ${recent.length}` : ''}
            </button>
          </div>

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
              <b>FIG. {scene.figNo}</b> — {scene.figure}
            </span>
            <span className="orange">
              第 {safeIndex + 1} 帧 / {steps.length}
            </span>
          </div>

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

          <div className="pgr">{scene.pages[1]}</div>
        </section>
      </main>
    </div>
  );
}
