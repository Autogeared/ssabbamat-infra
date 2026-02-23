// ── 도면 객체 타입 ──
export type ObjectType =
  | 'wall' | 'door' | 'window'
  | 'counter' | 'gas-range' | 'sink' | 'prep-table'
  | 'fridge' | 'storage' | 'station';

export interface FloorObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
  color?: string;
  // 벽 전용
  points?: number[];
  // 스테이션 전용
  stationRole?: StationRole;
  processingTime?: number; // 초
}

// ── 공정 스테이션 ──
export type StationRole =
  | 'order-receive'   // 주문접수
  | 'prep'            // 준비
  | 'cook'            // 조리
  | 'plate'           // 플레이팅
  | 'pack'            // 포장
  | 'pickup'          // 픽업/수거
  | 'delivery-out';   // 배달출고

export const STATION_META: Record<StationRole, { label: string; color: string; defaultTime: number }> = {
  'order-receive':  { label: '주문접수', color: '#3B82F6', defaultTime: 30 },
  'prep':           { label: '준비',     color: '#8B5CF6', defaultTime: 60 },
  'cook':           { label: '조리',     color: '#EF4444', defaultTime: 120 },
  'plate':          { label: '플레이팅', color: '#F59E0B', defaultTime: 45 },
  'pack':           { label: '포장',     color: '#10B981', defaultTime: 30 },
  'pickup':         { label: '픽업',     color: '#06B6D4', defaultTime: 15 },
  'delivery-out':   { label: '배달출고', color: '#6366F1', defaultTime: 20 },
};

// ── 동선 경로 ──
export interface FlowPath {
  id: string;
  fromStationId: string;
  toStationId: string;
  waypoints: { x: number; y: number }[];
}

// ── 레이아웃 전체 ──
export interface Layout {
  objects: FloorObject[];
  flowPaths: FlowPath[];
  canvasWidth: number;
  canvasHeight: number;
  pixelsPerMeter: number; // 기본 50px = 1m
}

// ── 동선 메트릭 ──
export interface FlowMetrics {
  totalDistance: number;      // 미터
  totalWalkTime: number;     // 초
  totalCycleTime: number;    // 초 (이동+처리)
  complexityScore: number;   // 0~100
  directionChanges: number;
  crossings: number;
  bottleneck: {
    stationId: string;
    stationLabel: string;
    time: number;
  } | null;
  segments: {
    from: string;
    to: string;
    distance: number;
    walkTime: number;
  }[];
}

// ── API 요청/응답 ──
export interface RecognizeRequest {
  image: string; // base64 data URL
}

export interface RecognizeResponse {
  objects: FloorObject[];
  confidence: number;
  message: string;
}

export interface InsightsRequest {
  layout: Layout;
  metrics: FlowMetrics;
}

export interface InsightsResponse {
  insights: string;
}

export interface FlowAnalyzeRequest {
  layout: Layout;
}

export interface FlowAnalyzeResponse {
  metrics: FlowMetrics;
}

// ── Cloudflare Workers 환경 ──
export interface Env {
  ANTHROPIC_API_KEY: string;
}
