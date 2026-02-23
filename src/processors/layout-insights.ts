import Anthropic from '@anthropic-ai/sdk';
import type { Layout, FlowMetrics, InsightsResponse } from '../types';
import { STATION_META } from '../types';
import { buildInsightsPrompt } from '../prompts/insights-prompt';

export async function generateInsights(
  layout: Layout,
  metrics: FlowMetrics,
  apiKey: string
): Promise<InsightsResponse> {
  const client = new Anthropic({ apiKey });

  const layoutSummary = summarizeLayout(layout);
  const metricsSummary = summarizeMetrics(metrics);
  const prompt = buildInsightsPrompt(layoutSummary, metricsSummary);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  return { insights: text };
}

function summarizeLayout(layout: Layout): string {
  const lines: string[] = [];
  const ppm = layout.pixelsPerMeter || 50;
  lines.push(`캔버스 크기: ${layout.canvasWidth}x${layout.canvasHeight}px (${layout.canvasWidth / ppm}x${layout.canvasHeight / ppm}m)`);
  lines.push(`객체 수: ${layout.objects.length}개`);

  for (const obj of layout.objects) {
    if (obj.type === 'station' && obj.stationRole) {
      const meta = STATION_META[obj.stationRole];
      lines.push(`- [${meta?.label || obj.stationRole}] 위치: (${Math.round(obj.x / ppm)}m, ${Math.round(obj.y / ppm)}m), 처리시간: ${obj.processingTime || 0}초`);
    } else {
      lines.push(`- [${obj.type}] "${obj.label || ''}" 위치: (${Math.round(obj.x / ppm)}m, ${Math.round(obj.y / ppm)}m)`);
    }
  }

  lines.push(`동선 경로 수: ${layout.flowPaths.length}개`);
  return lines.join('\n');
}

function summarizeMetrics(m: FlowMetrics): string {
  const lines: string[] = [
    `총 이동거리: ${m.totalDistance}m`,
    `총 보행시간: ${m.totalWalkTime}초`,
    `총 사이클시간: ${m.totalCycleTime}초 (보행 + 처리)`,
    `복잡도 점수: ${m.complexityScore}/100`,
    `방향전환: ${m.directionChanges}회`,
    `동선 교차: ${m.crossings}회`,
  ];
  if (m.bottleneck) {
    lines.push(`병목 스테이션: ${m.bottleneck.stationLabel} (${m.bottleneck.time}초)`);
  }
  if (m.segments.length > 0) {
    lines.push(`\n구간별:`);
    for (const seg of m.segments) {
      lines.push(`  ${seg.from} → ${seg.to}: ${seg.distance}m, ${seg.walkTime}초`);
    }
  }
  return lines.join('\n');
}
