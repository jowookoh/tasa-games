# 🎮 Tasa Games

A collection of fun, colorful games for kids! Designed for tablets with large, touch-friendly buttons and a playful interface.

## Games

### 🧠 Memory Match
A classic card-matching memory game with cute animal emojis. Find all the pairs to win!

### Coming Soon
- 🔢 Number Fun
- 🎨 Color Quest  
- 🔤 Letter Land

## Running Locally

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Project Structure

```
tasa-games/
├── index.html          # Main HTML structure
├── styles.css          # All styling
└── js/
    ├── app.js          # Main app controller (navigation, modals)
    ├── game-base.js    # Base class for all games
    ├── utils.js        # Shared utilities
    └── games/
        └── memory.js   # Memory Match game
```

## Adding a New Game

1. **Create the game HTML** in `index.html`:
```html
<section id="yourgame-game" class="screen game-screen">
  <!-- Your game UI -->
</section>
```

2. **Add a game card** to the home screen:
```html
<button class="game-card" data-game="yourgame">
  <span class="game-icon">🎯</span>
  <span class="game-name">Your Game</span>
  <span class="game-desc">Description</span>
</button>
```

3. **Create the game module** at `js/games/yourgame.js`:
```javascript
import { GameBase } from '../game-base.js';

export class YourGame extends GameBase {
  constructor(app) {
    super('yourgame', app);
  }

  init() {
    // Set up event listeners
  }

  onEnter() {
    // Called when navigating to this game
  }

  onPlayAgain() {
    // Called when "Play Again" is clicked
  }
}
```

4. **Register the game** in `js/app.js`:
```javascript
import { YourGame } from './games/yourgame.js';
// ...
this.registerGame('yourgame', YourGame);
```

## Architecture

- **App Controller** (`js/app.js`): Handles navigation between screens, win modal display, and game registration
- **GameBase** (`js/game-base.js`): Base class providing common game functionality
- **Games** (`js/games/`): Each game is a self-contained module extending GameBase
- **Utils** (`js/utils.js`): Shared helper functions
