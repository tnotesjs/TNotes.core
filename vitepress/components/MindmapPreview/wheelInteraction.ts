/**
 * CanvasViewer 会在自身 wheel 监听器中阻止默认事件并移动画布。
 * 未激活时先在捕获阶段终止分发，但不 preventDefault，让滚轮继续交给文档页面。
 */
export function gateMindmapWheel(event: WheelEvent, active: boolean): void {
  if (!active) event.stopImmediatePropagation()
}
