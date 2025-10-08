
export interface Point {
  x: number;
  y: number;
}

export interface ShadowPoint {
  x: number;
  y: number;
}

export enum GameStatus {
  READY = 'READY',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export interface GameState {
  snake: Point[];
  shadowSnake: ShadowPoint[];
  food: Point;
  direction: Point;
  shadowDirection: Point;
  score: number;
  speed: number; // Ticks per second
  status: GameStatus;
  ticks: number;
  gameTime: number; // in seconds
}

export interface DataPoint {
  timestamp: number;
  head_x: number;
  head_y: number;
  speed: number;
  direction: number; // angle
  score: number;
  food_x: number;
  food_y: number;
  lyapunov_estimate: number;
}
