import { useEffect, useMemo, useState } from 'react';
import type { Scene } from '../lib/dsl';

/** 只读 DSL 抽屉：把当前这一页的 Scene 原样摊开，证明图版不是黑盒。 */
export function JsonDrawer({ scene }: { scene: Scene }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => JSON.stringify(scene, null, 2), [scene]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <details className="json-drawer">
      <summary>Scene DSL · 只读 JSON</summary>
      <div className="json-actions">
        <span>
          {scene.steps.length} 帧 · {text.length} 字符
        </span>
        <button type="button" onClick={copy} aria-label="复制当前场景的 JSON">
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre>{text}</pre>
    </details>
  );
}
