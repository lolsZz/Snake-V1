
export const GRID_SIZE = 20;
export const CELL_SIZE = 20; // in pixels
export const CANVAS_WIDTH = GRID_SIZE * CELL_SIZE;
export const CANVAS_HEIGHT = GRID_SIZE * CELL_SIZE;

// Initial snake setup
export const SNAKE_INITIAL_LENGTH = 3;
export const SNAKE_INITIAL_POSITION = {
  x: Math.floor(GRID_SIZE / 2),
  y: Math.floor(GRID_SIZE / 2),
};

// Chaos Mechanics Parameters
export const BASE_SPEED = 5; // Ticks per second
export const SPEED_SCORE_EXPONENT = 1.3;
export const SPEED_SCORE_FACTOR = 0.1;

export const FOOD_ATTRACTOR_BIAS = 0.5;

export const MOMENTUM_FACTOR = 0.015; // scales with speed

// Instrumentation Parameters
export const DATA_COLLECTION_INTERVAL_MS = 10;
export const LYAPUNOV_UPDATE_TICKS = 100;
export const LYAPUNOV_INITIAL_PERTURBATION = 0.001; // small offset for shadow snake
export const PHASE_SPACE_UPDATE_MS = 50;

// Directions (as vectors)
export const DIRECTIONS: { [key: string]: { x: number; y: number } } = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};
