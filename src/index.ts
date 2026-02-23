import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, RecognizeRequest, InsightsRequest, FlowAnalyzeRequest, KVLayoutMeta } from './types';
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

// ── 클라우드 도면 저장 ──

// 도면 목록
app.get('/api/layouts', async (c) => {
  try {
    const kv = c.env.LAYOUTS_KV;
    const list = await kv.list<KVLayoutMeta>({ prefix: 'layout:' });
    const items = list.keys.map((k) => ({
      id: k.name.replace('layout:', ''),
      name: k.metadata?.name ?? '(이름 없음)',
      savedAt: k.metadata?.savedAt ?? '',
    }));
    return c.json({ layouts: items });
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to list layouts' }, 500);
  }
});

// 도면 저장
app.post('/api/layouts', async (c) => {
  try {
    const body = await c.req.json<{ name: string; layout: any }>();
    if (!body.name || !body.layout) return c.json({ error: 'name, layout 필드가 필요합니다' }, 400);

    const id = crypto.randomUUID();
    const savedAt = new Date().toISOString();
    const kv = c.env.LAYOUTS_KV;

    await kv.put(`layout:${id}`, JSON.stringify(body.layout), {
      metadata: { name: body.name, savedAt } as KVLayoutMeta,
    });

    return c.json({ id, name: body.name, savedAt });
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to save layout' }, 500);
  }
});

// 도면 불러오기
app.get('/api/layouts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const kv = c.env.LAYOUTS_KV;
    const { value, metadata } = await kv.getWithMetadata<KVLayoutMeta>(`layout:${id}`);

    if (!value) return c.json({ error: '도면을 찾을 수 없습니다' }, 404);

    const layout = JSON.parse(value);
    return c.json({
      id,
      name: metadata?.name ?? '(이름 없음)',
      savedAt: metadata?.savedAt ?? '',
      layout,
    });
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to load layout' }, 500);
  }
});

// 도면 삭제
app.delete('/api/layouts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const kv = c.env.LAYOUTS_KV;
    await kv.delete(`layout:${id}`);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to delete layout' }, 500);
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
