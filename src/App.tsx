import { useEffect, useMemo, useState } from 'react';
import { Figure } from './components/Figure';
import { SCENES, SCENE_LABEL, SCENE_ORDER, routeScene, type SceneId } from './lib/engines';

export default function App() {
  const [sceneId, setSceneId] = useState<SceneId>(() => {
    const q = new URLSearchParams(window.location.search).get('scene');
    return q && q in SCENES ? (q as SceneId) : 'quick';
  });
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [question, setQuestion] = useState('');

  const scene = SCENES[sceneId];
  const steps = scene.steps;
  const last = steps.length - 1;
  const safeIndex = Math.min(index, last);
  const step = steps[safeIndex];
  const progress = last > 0 ? safeIndex / last : 0;

  const noteTitle = useMemo(() => {
    const i = scene.note.indexOf('？');
    return i >= 0 ? scene.note.slice(0, i + 1) : scene.note;
  }, [scene.note]);
  const noteBody = useMemo(() => {
    const i = scene.note.indexOf('？');
    return i >= 0 ? scene.note.slice(i + 1) : '';
  }, [scene.note]);

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [sceneId]);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, last));
    }, 900 / speed);
    return () => window.clearTimeout(id);
  }, [playing, index, speed, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPlaying(false);
        setIndex((i) => Math.min(i + 1, last));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPlaying(false);
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Home') {
        setPlaying(false);
        setIndex(0);
      } else if (e.key === 'End') {
        setPlaying(false);
        setIndex(last);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  return (
    <div className="app">
      <header className="mast">
        <div className="brand">ALGOVIZ</div>
        <div className="mid">第三讲 · <b>排序与选择</b></div>
        <div className="pg">12 — 13</div>
      </header>

      <main className="spread">
        <section className="page left">
          <div className="chapter">{scene.chapter}</div>
          <div className="scene-switch" role="tablist" aria-label="选择排序算法">
            {SCENE_ORDER.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={id === sceneId}
                className={id === sceneId ? 'on' : ''}
                onClick={() => {
                  setSceneId(id);
                  setIndex(0);
                }}
              >
                {SCENE_LABEL[id]}
              </button>
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
            {scene.formula}
            <span>平均 {scene.complexity.time} · 空间 {scene.complexity.space}</span>
          </div>

          <div className="code">
            {scene.code.map((line, i) => (
              <div key={line} className={step.codeLine === i + 1 ? 'line active' : 'line'}>
                <span className="ln">{i + 1}</span>
                {line}
              </div>
            ))}
          </div>

          <div className="facts">
            {scene.facts.map((fact) => (
              <div key={fact.label}>
                {fact.label}
                <b>{fact.value}</b>
              </div>
            ))}
          </div>

          <div className="margin-note">
            <b>{noteTitle}</b>
            {noteBody}
          </div>

          <div className="step-index">
            <div className="si-title">
              <span>本节步骤</span>
              <span>{String(steps.length).padStart(2, '0')} STEPS</span>
            </div>
            {scene.outline.map((item, i) => (
              <div className="si-row" key={item.label}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                <span>{item.label}</span>
                <i />
                <em>{item.value}</em>
              </div>
            ))}
          </div>

          <form
            className="ask"
            onSubmit={(e) => {
              e.preventDefault();
              const next = routeScene(question);
              if (next) {
                setSceneId(next);
                setQuestion('');
              } else {
                setIndex(0);
                setPlaying(false);
                setPlaying(true);
              }
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={scene.question}
              aria-label="追问"
            />
            <button type="submit" aria-label="提交追问">→</button>
          </form>

          <div className="pgl">12</div>
        </section>

        <section className="page right">
          <div className="fig-head">
            <span><b>FIG. 3.2</b> — {scene.figure}</span>
            <span className="orange">第 {safeIndex + 1} 帧 / {steps.length}</span>
          </div>

          <div className="figure">
            <Figure step={step} />
          </div>

          <div className="caption">
            <b>图 3.2</b> · {step.caption}
          </div>

          <div
            className="ruler"
            role="slider"
            aria-label="时间轴"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={safeIndex + 1}
            tabIndex={0}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              setPlaying(false);
              setIndex(Math.round(ratio * last));
            }}
          >
            <div className="marker" style={{ left: `${progress * 100}%` }} />
          </div>

          <div className="transport">
            <button
              className="pl"
              aria-label="上一步"
              onClick={() => {
                setPlaying(false);
                setIndex((i) => Math.max(0, i - 1));
              }}
            >
              ◁
            </button>
            <button
              className="pl play"
              aria-label={playing ? '暂停' : '播放'}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? 'II' : '▶'}
            </button>
            <button
              className="pl"
              aria-label="下一步"
              onClick={() => {
                setPlaying(false);
                setIndex((i) => Math.min(last, i + 1));
              }}
            >
              ▷
            </button>
            <span>
              <b>{String(safeIndex + 1).padStart(3, '0')}</b> / {String(steps.length).padStart(3, '0')}
            </span>
            <button
              className="speed"
              aria-label="切换速度"
              onClick={() => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))}
            >
              {speed.toFixed(1)}×
            </button>
            <span className="hint">← → 单步 · SPACE 播放</span>
          </div>

          <div className="pgr">13</div>
        </section>
      </main>
    </div>
  );
}
