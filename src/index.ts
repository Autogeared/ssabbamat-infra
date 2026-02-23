import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, RecognizeRequest, InsightsRequest, FlowAnalyzeRequest } from './types';
import { recognizeImage } from './processors/image-recognition';
import { generateInsights } from './processors/layout-insights';
import { analyzeFlow } from './processors/flow-analyzer';

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors());

// ── Health ──
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'ssabbamat-infra' }));

// ── 이미지 인식 ──
app.post('/api/recognize', async (c) => {
  try {
    const body = await c.req.json<RecognizeRequest>();
    if (!body.image) return c.json({ error: 'image 필드가 필요합니다' }, 400);

    const apiKey = c.env.ANTHROPIC_API_KEY;
    if (!apiKey) return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    const result = await recognizeImage(body.image, apiKey);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message || 'Recognition failed' }, 500);
  }
});

// ── AI 인사이트 ──
app.post('/api/insights', async (c) => {
  try {
    const body = await c.req.json<InsightsRequest>();
    if (!body.layout || !body.metrics) return c.json({ error: 'layout, metrics 필드가 필요합니다' }, 400);

    const apiKey = c.env.ANTHROPIC_API_KEY;
    if (!apiKey) return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    const result = await generateInsights(body.layout, body.metrics, apiKey);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message || 'Insights generation failed' }, 500);
  }
});

// ── 동선 분석 (서버 사이드, AI 불필요) ──
app.post('/api/flow-analyze', async (c) => {
  try {
    const body = await c.req.json<FlowAnalyzeRequest>();
    if (!body.layout) return c.json({ error: 'layout 필드가 필요합니다' }, 400);

    const metrics = analyzeFlow(body.layout);
    return c.json({ metrics });
  } catch (e: any) {
    return c.json({ error: e.message || 'Flow analysis failed' }, 500);
  }
});

export default app;
