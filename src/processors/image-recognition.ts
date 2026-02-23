import Anthropic from '@anthropic-ai/sdk';
import type { RecognizeResponse, FloorObject } from '../types';
import { RECOGNITION_SYSTEM, RECOGNITION_USER } from '../prompts/recognition-prompt';

export async function recognizeImage(
  base64Image: string,
  apiKey: string
): Promise<RecognizeResponse> {
  const client = new Anthropic({ apiKey });

  // data URL에서 미디어타입과 base64 추출
  const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data URL');

  const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const data = match[2];

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: RECOGNITION_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data },
        },
        { type: 'text', text: RECOGNITION_USER },
      ],
    }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  const parsed = JSON.parse(text);

  // ID 부여 + 좌표 스케일링 (1000→실제 캔버스)
  const objects: FloorObject[] = (parsed.objects || []).map((obj: any, i: number) => ({
    id: `recognized-${i}-${Date.now()}`,
    type: obj.type || 'counter',
    x: obj.x || 0,
    y: obj.y || 0,
    width: obj.width || 100,
    height: obj.height || 50,
    rotation: obj.rotation || 0,
    label: obj.label || '',
  }));

  return {
    objects,
    confidence: parsed.confidence || 0.5,
    message: parsed.message || '인식 완료',
  };
}
