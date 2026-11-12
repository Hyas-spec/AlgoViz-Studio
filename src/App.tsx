import { useEffect, useMemo, useState } from 'react';
import { Figure } from './components/Figure';
import { buildSteps, DEFAULT_ARRAY } from './lib/engine';

const CODE_LINES = [
  'function quickSort(a, l, r):',
  '  if l >= r return',
  '  p = partition(a, l, r)',
  '  swap(a[p], a[r])   // 基准归位',
  '  quickSort(a, l, p - 1)',
  '  quickSort(a, p + 1, r)',
];

export default function App() {
  const steps = useMemo(() => buildSteps(DEFAULT_ARRAY), []);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [question, setQuestion] = useState('');

  const step = steps[index];
  const last = steps.length - 1;
  const progress = last > 0 ? index / last : 0;

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
          <div className="chapter">CH.03 / SORTING — QUICKSORT</div>
          <h1>分区</h1>
          <p className="dek">
            把小于基准的放左边，大于的放右边，再对两侧递归。
            <b>整个快速排序，本质上就是这一件事。</b>
          </p>

          <div className="body">
            <div className="bcol">
              <p>
                分区结束后，基准落在它的最终位置：左区每个元素都不大于它，右区每个元素都大于它。接下来对两侧递归；区间缩到 1 或 0 时自然结束。
              </p>
            </div>
            <div className="bcol">
              <p>
                这就是分治：一次划分把问题切成两个更小的同类问题，而基准本身再也不需要移动。
              </p>
            </div>
          </div>

          <div className="formula">
            T(n) = 2T(n/2) + O(n)
            <span>平均 O(n log n) · 最坏 O(n²) · 空间 O(log n)</span>
          </div>

          <div className="code">
            {CODE_LINES.map((line, i) => (
              <div key={line} className={step.codeLine === i + 1 ? 'line active' : 'line'}>
                <span className="ln">{i + 1}</span>
                {line}
              </div>
            ))}
          </div>

          <div className="facts">
            <div>稳定性<b>否</b></div>
            <div>原地排序<b>是</b></div>
            <div>最坏情况<b>O(n²)</b></div>
          </div>

          <div className="margin-note">
            <b>为什么取末元素？</b>
            随机数据下平均性能最好；但面对有序数组会退化成 O(n²)，所以工程里常用随机基准或三数取中。
          </div>

          <form
            className="ask"
            onSubmit={(e) => {
              e.preventDefault();
              setPlaying(false);
              setIndex(0);
              setPlaying(true);
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="追问一句：为什么不选第一个元素当基准？"
              aria-label="追问"
            />
            <button type="submit" aria-label="重新播放">→</button>
          </form>

          <div className="pgl">12</div>
        </section>

        <section className="page right">
          <div className="fig-head">
            <span><b>FIG. 3.2</b> — PARTITION</span>
            <span className="orange">第 {index + 1} 帧 / {steps.length}</span>
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
            aria-valuenow={index + 1}
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
              <b>{String(index + 1).padStart(3, '0')}</b> / {String(steps.length).padStart(3, '0')}
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
