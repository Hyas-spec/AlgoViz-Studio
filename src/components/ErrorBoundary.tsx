import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * 渲染兜底：任何场景数据/渲染异常都不该把整页打成白屏。
 * 保留纸面视觉，给「回到快速排序」和「刷新」两个出口。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AlgoViz scene failed to render', error, info);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <div className="eb-card">
          <div className="eb-kicker">SCENE FAILED</div>
          <h1>这一页没有排好</h1>
          <p>场景数据在渲染时出错了，讲义没有丢。可以回到快速排序，或者刷新重试。</p>
          <pre>{this.state.error.message}</pre>
          <div className="eb-actions">
            <a href="/?scene=quick">回到快速排序</a>
            <button type="button" onClick={() => window.location.reload()}>
              刷新
            </button>
          </div>
        </div>
      </div>
    );
  }
}
