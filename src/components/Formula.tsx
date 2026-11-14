import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** 公式渲染：Scene DSL 里的 formula 是 LaTeX，渲染失败时退回原文，绝不空白。 */
export function Formula({ tex }: { tex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        throwOnError: false,
        displayMode: false,
        strict: 'ignore',
        output: 'html',
      });
    } catch {
      return '';
    }
  }, [tex]);

  if (!html) return <div className="formula-tex">{tex}</div>;
  return <div className="formula-tex" dangerouslySetInnerHTML={{ __html: html }} />;
}
