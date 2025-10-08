
import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { Point, GameStatus, GameState, DataPoint, ShadowPoint } from './types';
import {
  GRID_SIZE,
  CELL_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SNAKE_INITIAL_POSITION,
  SNAKE_INITIAL_LENGTH,
  BASE_SPEED,
  SPEED_SCORE_EXPONENT,
  SPEED_SCORE_FACTOR,
  FOOD_ATTRACTOR_BIAS,
  MOMENTUM_FACTOR,
  DATA_COLLECTION_INTERVAL_MS,
  LYAPUNOV_UPDATE_TICKS,
  LYAPUNOV_INITIAL_PERTURBATION,
  PHASE_SPACE_UPDATE_MS,
  DIRECTIONS,
} from './constants';

// --- UTILITY FUNCTIONS ---
const getRandomCoordinate = () => ({
  x: Math.floor(Math.random() * GRID_SIZE),
  y: Math.floor(Math.random() * GRID_SIZE),
});

const isSamePoint = (p1: Point, p2: Point) => p1.x === p2.x && p1.y === p2.y;

// --- GAME STATE MANAGEMENT ---
type Action =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'GAME_TICK' }
  | { type: 'CHANGE_DIRECTION'; payload: Point };

const generateNewFood = (snake: Point[], lastFood: Point | null): Point => {
    let newFood: Point;
    // --- Chaos Mechanic 2: Stochastic Food Spawning with Attractor Bias ---
    // We use weighted sampling. Each empty cell gets a weight.
    const emptyCells: Point[] = [];
    const weights: number[] = [];
    let totalWeight = 0;

    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            const point = { x, y };
            if (!snake.some(segment => isSamePoint(segment, point))) {
                emptyCells.push(point);
                let weight = 1.0; // base_prob
                if (lastFood) {
                    const distance = Math.sqrt(Math.pow(x - lastFood.x, 2) + Math.pow(y - lastFood.y, 2));
                    // Formula: P(x,y) = base_prob * (1 + bias * e^(-distance/grid_size))
                    weight *= (1 + FOOD_ATTRACTOR_BIAS * Math.exp(-distance / GRID_SIZE));
                }
                weights.push(weight);
                totalWeight += weight;
            }
        }
    }

    if (emptyCells.length === 0) return SNAKE_INITIAL_POSITION; // Should not happen

    let random = Math.random() * totalWeight;
    for (let i = 0; i < emptyCells.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            newFood = emptyCells[i];
            return newFood;
        }
    }

    // Fallback to a completely random position if weighted sampling fails
    do {
        newFood = getRandomCoordinate();
    } while (snake.some(segment => isSamePoint(segment, newFood)));
    return newFood;
};


const createInitialState = (): GameState => {
  const initialSnake: Point[] = [];
  for (let i = 0; i < SNAKE_INITIAL_LENGTH; i++) {
    initialSnake.push({ x: SNAKE_INITIAL_POSITION.x - i, y: SNAKE_INITIAL_POSITION.y });
  }
  
  const initialShadowSnake: ShadowPoint[] = initialSnake.map((p, i) => ({
      x: p.x + (i === 0 ? LYAPUNOV_INITIAL_PERTURBATION : 0),
      y: p.y,
  }));

  return {
    snake: initialSnake,
    shadowSnake: initialShadowSnake,
    food: generateNewFood(initialSnake, null),
    direction: DIRECTIONS.RIGHT,
    shadowDirection: DIRECTIONS.RIGHT,
    score: 0,
    speed: BASE_SPEED,
    status: GameStatus.READY,
    ticks: 0,
    gameTime: 0,
  };
};

const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'START':
      if (state.status === GameStatus.READY || state.status === GameStatus.PAUSED || state.status === GameStatus.GAME_OVER) {
         if(state.status === GameStatus.GAME_OVER) return {...createInitialState(), status: GameStatus.RUNNING};
        return { ...state, status: GameStatus.RUNNING };
      }
      return state;
    case 'PAUSE':
      if (state.status === GameStatus.RUNNING) {
        return { ...state, status: GameStatus.PAUSED };
      }
      return state;
    case 'RESET':
      return createInitialState();
    case 'CHANGE_DIRECTION':
      // Prevent reversing direction
      if (
        (action.payload.x !== 0 && state.direction.x === -action.payload.x) ||
        (action.payload.y !== 0 && state.direction.y === -action.payload.y)
      ) {
        return state;
      }
      return { ...state, direction: action.payload };
    
    case 'GAME_TICK':
      if (state.status !== GameStatus.RUNNING) return state;

      // --- Main Snake Movement ---
      const newSnake = [...state.snake];
      const head = { ...newSnake[0] };
      head.x += state.direction.x;
      head.y += state.direction.y;

      // --- Shadow Snake Movement ---
      const newShadowSnake = [...state.shadowSnake];
      const shadowHead = { ...newShadowSnake[0] };
      shadowHead.x += state.shadowDirection.x;
      shadowHead.y += state.shadowDirection.y;
      
      // Update directions for next tick.
      // Shadow snake perfectly follows the main snake's intended direction.
      const nextShadowDirection = state.direction;

      // --- Collision Detection ---
      // Wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        return { ...state, status: GameStatus.GAME_OVER };
      }
      // Self collision
      if (newSnake.some(segment => isSamePoint(segment, head))) {
        return { ...state, status: GameStatus.GAME_OVER };
      }

      newSnake.unshift(head);
      newShadowSnake.unshift(shadowHead);

      let newScore = state.score;
      let newSpeed = state.speed;
      let newFood = state.food;

      // --- Food Consumption ---
      if (isSamePoint(head, state.food)) {
        newScore += 1;
        newFood = generateNewFood(newSnake, state.food);
        
        // --- Chaos Mechanic 1: Non-Linear Speed Dynamics ---
        // Formula: speed = base_speed * (1 + factor * score^exponent)
        newSpeed = BASE_SPEED * (1 + SPEED_SCORE_FACTOR * Math.pow(newScore, SPEED_SCORE_EXPONENT));
      } else {
        newSnake.pop();
        newShadowSnake.pop();
      }

      return {
        ...state,
        snake: newSnake,
        shadowSnake: newShadowSnake,
        shadowDirection: nextShadowDirection,
        food: newFood,
        score: newScore,
        speed: newSpeed,
        ticks: state.ticks + 1,
        gameTime: state.gameTime + (1 / state.speed)
      };
    default:
      return state;
  }
};

// --- COMPONENTS ---

interface CanvasProps {
  snake: Point[];
  food: Point;
}

const GameCanvas: React.FC<CanvasProps> = ({ snake, food }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#111827'; // bg-gray-900
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw food
    ctx.fillStyle = '#ef4444'; // red-500
    ctx.fillRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    
    // Draw snake
    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#34d399' : '#10b981'; // head: emerald-400, body: emerald-500
      ctx.fillRect(segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });
  }, [snake, food]);

  return <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border-2 border-gray-700 rounded-lg" />;
};

interface MetricsDisplayProps {
    score: number;
    speed: number;
    lyapunov: number;
    gameTime: number;
}

const MetricsDisplay: React.FC<MetricsDisplayProps> = ({ score, speed, lyapunov, gameTime }) => {
    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg w-full">
            <h3 className="text-xl font-bold mb-4 text-emerald-400 border-b border-gray-700 pb-2">Chaos Instrumentation</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-gray-400">Score</p>
                    <p className="text-2xl font-mono">{score}</p>
                </div>
                <div>
                    <p className="text-gray-400">Game Time</p>
                    <p className="text-2xl font-mono">{gameTime.toFixed(1)}s</p>
                </div>
                <div>
                    <p className="text-gray-400">Current Speed (ticks/s)</p>
                    <p className="text-2xl font-mono">{speed.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-gray-400">Lyapunov Exponent (λ)</p>
                    <p className={`text-2xl font-mono ${lyapunov > 0 ? 'text-red-500' : 'text-green-500'}`}>{lyapunov.toFixed(4)}</p>
                </div>
            </div>
        </div>
    );
};

interface PhaseSpaceVisualizationProps {
    data: DataPoint[];
}
const PhaseSpaceVisualization: React.FC<PhaseSpaceVisualizationProps> = ({ data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [lastDrawIndex, setLastDrawIndex] = useState(0);

    useEffect(() => {
        const intervalId = setInterval(() => {
            const canvas = canvasRef.current;
            if (!canvas || !data.length || lastDrawIndex >= data.length) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const maxSpeed = Math.max(...data.map(p => p.speed), BASE_SPEED * 5);
            const maxScore = Math.max(...data.map(p => p.score), 1);

            const pointsToDraw = data.slice(lastDrawIndex);
            
            pointsToDraw.forEach(point => {
                const x = (point.speed / maxSpeed) * canvas.width;
                const y = (point.direction / 360) * canvas.height;
                
                // Color based on score using HSL
                const hue = (point.score / (maxScore + 10)) * 120; // 0 (red) to 120 (green)
                ctx.fillStyle = `hsla(${120 - hue}, 100%, 50%, 0.7)`;
                
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, 2 * Math.PI);
                ctx.fill();
            });

            setLastDrawIndex(data.length);

        }, PHASE_SPACE_UPDATE_MS);

        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, lastDrawIndex]);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#1f2937'; // bg-gray-800
        ctx.fillRect(0,0, canvas.width, canvas.height);
        setLastDrawIndex(0);
    }, [data.length === 0]);


    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg w-full h-full flex flex-col">
            <h3 className="text-xl font-bold mb-2 text-emerald-400 border-b border-gray-700 pb-2">Phase Space</h3>
            <div className="relative flex-grow">
              <canvas ref={canvasRef} width="300" height="200" className="w-full h-full" />
              <span className="absolute bottom-1 left-2 text-xs text-gray-500">X: Speed</span>
              <span className="absolute top-1 left-2 -rotate-90 -translate-y-1/2 origin-top-left text-xs text-gray-500">Y: Direction</span>
            </div>
        </div>
    );
};


interface ControlsProps {
    status: GameStatus;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
    onExport: () => void;
}
const Controls: React.FC<ControlsProps> = ({ status, onStart, onPause, onReset, onExport }) => {
    return (
        <div className="flex flex-wrap gap-2 justify-center mt-4">
            {status !== GameStatus.RUNNING ? (
                <button onClick={onStart} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-semibold w-28">
                    {status === GameStatus.GAME_OVER ? 'Restart' : 'Start'}
                </button>
            ) : (
                <button onClick={onPause} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-semibold w-28">Pause</button>
            )}
            <button onClick={onReset} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold w-28">Reset</button>
            <button onClick={onExport} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold w-28">Export Data</button>
        </div>
    );
};


// --- MAIN APP COMPONENT ---
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const [dataLog, setDataLog] = useState<DataPoint[]>([]);
  const [lyapunov, setLyapunov] = useState(0);
  const lastTickTimeRef = useRef(0);
  const gameLoopRef = useRef<number>();

  // --- Keyboard Input Handler ---
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
      let newDirection: Point | null = null;
      switch (e.key) {
        case 'w':
        case 'ArrowUp':
          newDirection = DIRECTIONS.UP;
          break;
        case 's':
        case 'ArrowDown':
          newDirection = DIRECTIONS.DOWN;
          break;
        case 'a':
        case 'ArrowLeft':
          newDirection = DIRECTIONS.LEFT;
          break;
        case 'd':
        case 'ArrowRight':
          newDirection = DIRECTIONS.RIGHT;
          break;
        default:
          return;
      }
      
      // --- Chaos Mechanic 3: Momentum-Based Direction Changes ---
      // At high speed, there's a chance the turn doesn't register immediately.
      // Formula: success_prob = 1 - momentum_factor * current_speed
      const successProbability = 1 - MOMENTUM_FACTOR * state.speed;
      if (Math.random() < successProbability) {
        dispatch({ type: 'CHANGE_DIRECTION', payload: newDirection });
      } else {
        // Turn failed due to "inertia". The snake continues in its current direction.
        console.log(`Turn failed! Speed: ${state.speed.toFixed(2)}, Success Prob: ${successProbability.toFixed(2)}`);
      }
  }, [state.speed]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // --- Game Loop ---
  const gameTick = useCallback(() => {
      dispatch({ type: 'GAME_TICK' });
  }, []);
  
  useEffect(() => {
    const tick = (timestamp: number) => {
        if (state.status === GameStatus.RUNNING) {
            const timeSinceLastTick = timestamp - lastTickTimeRef.current;
            const tickInterval = 1000 / state.speed;
            
            if(timeSinceLastTick >= tickInterval) {
                lastTickTimeRef.current = timestamp;
                gameTick();
            }
        }
        gameLoopRef.current = requestAnimationFrame(tick);
    }
    
    gameLoopRef.current = requestAnimationFrame(tick);
    
    return () => {
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
        }
    }
  }, [state.status, state.speed, gameTick]);

  // --- Instrumentation: Data Collection & Lyapunov Exponent ---
  useEffect(() => {
    if (state.status !== GameStatus.RUNNING) return;
    
    // Data Logger
    const dataLogger = setInterval(() => {
        if (state.snake.length === 0) return;
        const head = state.snake[0];
        const dirVector = state.direction;
        const directionAngle = (Math.atan2(dirVector.y, dirVector.x) * 180 / Math.PI + 360) % 360;

        setDataLog(prev => [...prev, {
            timestamp: Date.now(),
            head_x: head.x,
            head_y: head.y,
            speed: state.speed,
            direction: directionAngle,
            score: state.score,
            food_x: state.food.x,
            food_y: state.food.y,
            lyapunov_estimate: lyapunov,
        }]);
    }, DATA_COLLECTION_INTERVAL_MS);

    return () => clearInterval(dataLogger);
  }, [state.status, state.snake, state.direction, state.speed, state.score, state.food, lyapunov]);

  // Lyapunov Calculator
  useEffect(() => {
    if (state.status !== GameStatus.RUNNING || state.ticks === 0) return;

    if (state.ticks % LYAPUNOV_UPDATE_TICKS === 0) {
        const head = state.snake[0];
        const shadowHead = state.shadowSnake[0];

        const d_t = Math.sqrt(Math.pow(head.x - shadowHead.x, 2) + Math.pow(head.y - shadowHead.y, 2));
        const d_0 = LYAPUNOV_INITIAL_PERTURBATION;

        if (d_t > 0 && d_0 > 0) {
            // Formula: λ ≈ (1/t) * ln(d(t)/d(0))
            const time = state.ticks; // Using ticks as our time unit
            const newLyapunov = (1 / time) * Math.log(d_t / d_0);
            setLyapunov(newLyapunov);
        }
    }
  }, [state.ticks, state.snake, state.shadowSnake, state.status]);

  // --- Control Handlers ---
  const handleStart = () => dispatch({ type: 'START' });
  const handlePause = () => dispatch({ type: 'PAUSE' });
  const handleReset = () => {
    dispatch({ type: 'RESET' });
    setDataLog([]);
    setLyapunov(0);
  };
  
  const handleExport = () => {
    if (dataLog.length === 0) {
        alert("No data collected yet. Play the game first.");
        return;
    }
    const headers = Object.keys(dataLog[0]).join(',');
    const csvContent = dataLog.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `snake_chaos_data_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-2 text-emerald-400">Chaos-Emergent Snake Game</h1>
      <p className="mb-4 text-gray-400">An instrumented simulation of chaos theory in a classic game.</p>
      
      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl">
        <div className="flex flex-col items-center">
          <GameCanvas snake={state.snake} food={state.food} />
           {state.status === GameStatus.GAME_OVER && (
            <div className="mt-4 text-center p-4 bg-red-900/50 border border-red-500 rounded-lg">
                <h2 className="text-2xl font-bold text-red-400">Game Over</h2>
                <p>Final Score: {state.score}</p>
            </div>
           )}
          <Controls status={state.status} onStart={handleStart} onPause={handlePause} onReset={handleReset} onExport={handleExport}/>
        </div>
        
        <div className="flex-grow flex flex-col gap-6">
          <MetricsDisplay score={state.score} speed={state.speed} lyapunov={lyapunov} gameTime={state.gameTime} />
          <PhaseSpaceVisualization data={dataLog} />
        </div>
      </div>
    </div>
  );
}
