// Game Constants
const GAME_WIDTH = 10;
const GAME_HEIGHT = 10;
const ROOMS_PER_FLOOR = 10;
const MAZE_COMPLEXITY = 0.3;

// Enemy Types
const ENEMY_TYPES = {
    goblin: { hp: 15, dmg: 3, xp: 25, loot: 10, emoji: '👹' },
    orc: { hp: 30, dmg: 6, xp: 50, loot: 25, emoji: '🗡️' },
    skeleton: { hp: 20, dmg: 4, xp: 40, loot: 20, emoji: '💀' },
    dragon: { hp: 100, dmg: 15, xp: 200, loot: 100, emoji: '🐉' }
};

// Shop price tracking
const shopPrices = {
    heal: 25,
    damage: 60,
    health: 60,
    speed: 50,
    shotspeed: 40,
    armor: 45
};

// Game State
const gameState = {
    floor: 1,
    room: 0,
    playerX: 0,
    playerY: 0,
    playerHP: 100,
    playerMaxHP: 100,
    playerLevel: 1,
    playerXP: 0,
    playerXPNeeded: 100,
    gold: 0,
    inventory: [],
    maze: [],
    enemies: [],
    potions: [],
    chests: [],
    stairsX: 0,
    stairsY: 0,
    inCombat: false,
    currentEnemy: null
};

// Initialize Game
function init() {
    generateFloor();
    render();
    setupControls();
}

// Generate Maze using Recursive Backtracking
function generateMaze(width, height) {
    const maze = Array(height).fill().map(() => Array(width).fill(1));
    
    function carve(x, y) {
        maze[y][x] = 0;
        const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]].sort(() => Math.random() - 0.5);
        
        for (const [dx, dy] of directions) {
            const nx = x + dx, ny = y + dy;
            if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && maze[ny][nx] === 1) {
                maze[y + dy / 2][x + dx / 2] = 0;
                carve(nx, ny);
            }
        }
    }
    
    carve(1, 1);
    return maze;
}

// Generate New Room
function generateRoom() {
    gameState.maze = generateMaze(GAME_WIDTH, GAME_HEIGHT);
    gameState.enemies = [];
    gameState.potions = [];
    gameState.chests = [];
    gameState.inCombat = false;
    gameState.currentEnemy = null;
    
    // Place player
    gameState.playerX = 1;
    gameState.playerY = 1;
    gameState.maze[gameState.playerY][gameState.playerX] = 0;
    
    // Place stairs
    let stairsPlaced = false;
    while (!stairsPlaced) {
        gameState.stairsX = Math.floor(Math.random() * GAME_WIDTH);
        gameState.stairsY = Math.floor(Math.random() * GAME_HEIGHT);
        if (gameState.maze[gameState.stairsY][gameState.stairsX] === 0 &&
            (gameState.stairsX > 3 || gameState.stairsY > 3)) {
            stairsPlaced = true;
        }
    }
    gameState.maze[gameState.stairsY][gameState.stairsX] = 0;
    
    // Place enemies (scale with floor)
    const enemyCount = 2 + gameState.floor;
    for (let i = 0; i < enemyCount; i++) {
        let placed = false;
        while (!placed) {
            const x = Math.floor(Math.random() * GAME_WIDTH);
            const y = Math.floor(Math.random() * GAME_HEIGHT);
            if (gameState.maze[y][x] === 0 && !(x === gameState.playerX && y === gameState.playerY)) {
                const typeKeys = Object.keys(ENEMY_TYPES);
                const enemyType = typeKeys[Math.floor(Math.random() * typeKeys.length)];
                const template = ENEMY_TYPES[enemyType];
                gameState.enemies.push({
                    x, y, type: enemyType,
                    hp: template.hp + (gameState.floor - 1) * 5,
                    maxHp: template.hp + (gameState.floor - 1) * 5,
                    dmg: template.dmg + (gameState.floor - 1)
                });
                placed = true;
            }
        }
    }
    
    // Place potions
    const potionCount = 2 + Math.floor(gameState.floor / 2);
    for (let i = 0; i < potionCount; i++) {
        let placed = false;
        while (!placed) {
            const x = Math.floor(Math.random() * GAME_WIDTH);
            const y = Math.floor(Math.random() * GAME_HEIGHT);
            if (gameState.maze[y][x] === 0 && !gameState.enemies.some(e => e.x === x && e.y === y)) {
                gameState.potions.push({ x, y, healing: 30 + gameState.floor * 5 });
                placed = true;
            }
        }
    }
    
    // Place chests
    const chestCount = 1 + Math.floor(gameState.floor / 3);
    for (let i = 0; i < chestCount; i++) {
        let placed = false;
        while (!placed) {
            const x = Math.floor(Math.random() * GAME_WIDTH);
            const y = Math.floor(Math.random() * GAME_HEIGHT);
            if (gameState.maze[y][x] === 0 && !gameState.enemies.some(e => e.x === x && e.y === y)) {
                gameState.chests.push({ x, y, gold: 50 + gameState.floor * 20 });
                placed = true;
            }
        }
    }
}

// Generate Floor (all 10 rooms)
function generateFloor() {
    gameState.room = 0;
    generateRoom();
    addLog(`📍 Floor ${gameState.floor}, Room ${gameState.room + 1}/${ROOMS_PER_FLOOR}`);
}

// Player Movement
function movePlayer(dx, dy) {
    if (gameState.inCombat) {
        addLog('⚔️ You are in combat!');
        return;
    }
    
    const newX = gameState.playerX + dx;
    const newY = gameState.playerY + dy;
    
    if (newX < 0 || newX >= GAME_WIDTH || newY < 0 || newY >= GAME_HEIGHT) return;
    if (gameState.maze[newY][newX] === 1) return;
    
    gameState.playerX = newX;
    gameState.playerY = newY;
    
    // Check for interactions
    checkStairs();
    checkPotion();
    checkChest();
    checkEnemy();
    
    render();
}

// Check if player reached stairs
function checkStairs() {
    if (gameState.playerX === gameState.stairsX && gameState.playerY === gameState.stairsY) {
        if (gameState.room < ROOMS_PER_FLOOR - 1) {
            gameState.room++;
            generateRoom();
            addLog(`✨ Advanced to Room ${gameState.room + 1}/${ROOMS_PER_FLOOR}`);
        } else {
            completeFloor();
        }
    }
}

// Check for potions
function checkPotion() {
    const potionIndex = gameState.potions.findIndex(p => p.x === gameState.playerX && p.y === gameState.playerY);
    if (potionIndex !== -1) {
        const potion = gameState.potions.splice(potionIndex, 1)[0];
        const oldHP = gameState.playerHP;
        gameState.playerHP = Math.min(gameState.playerMaxHP, gameState.playerHP + potion.healing);
        addLog(`🧪 Found potion! Healed ${gameState.playerHP - oldHP} HP`);
    }
}

// Check for chests
function checkChest() {
    const chestIndex = gameState.chests.findIndex(c => c.x === gameState.playerX && c.y === gameState.playerY);
    if (chestIndex !== -1) {
        const chest = gameState.chests.splice(chestIndex, 1)[0];
        gameState.gold += chest.gold;
        addLog(`💰 Found treasure! +${chest.gold} gold`);
    }
}

// Check for enemies
function checkEnemy() {
    const enemy = gameState.enemies.find(e => e.x === gameState.playerX && e.y === gameState.playerY);
    if (enemy) {
        initiatesCombat(enemy);
    }
}

// Initiate Combat
function initiatesCombat(enemy) {
    gameState.inCombat = true;
    gameState.currentEnemy = enemy;
    addLog(`⚔️ Encountered ${ENEMY_TYPES[enemy.type].emoji} ${enemy.type}!`);
    showModal(`Battle: ${enemy.type.toUpperCase()}!`,
        `HP: ${enemy.hp}/${enemy.maxHp}`,
        [
            { text: '⚔️ Attack', onclick: () => playerAttack() },
            { text: '🏃 Flee', onclick: () => flee() }
        ]);
}

// Player Attack
function playerAttack() {
    const enemy = gameState.currentEnemy;
    const playerDmg = Math.floor(Math.random() * 8) + 4 + gameState.playerLevel;
    
    enemy.hp -= playerDmg;
    addLog(`⚔️ You dealt ${playerDmg} damage!`);
    
    if (enemy.hp <= 0) {
        defeatEnemy(enemy);
        closeModal();
        return;
    }
    
    // Enemy counter attack
    const enemyDmg = Math.floor(Math.random() * enemy.dmg) + 2;
    gameState.playerHP -= enemyDmg;
    addLog(`💥 ${enemy.type} dealt ${enemyDmg} damage!`);
    
    if (gameState.playerHP <= 0) {
        gameOver();
        closeModal();
        return;
    }
    
    // Update modal
    const modalBody = document.getElementById('modalBody');
    modalBody.textContent = `HP: ${enemy.hp}/${enemy.maxHp}\n\nYour HP: ${gameState.playerHP}/${gameState.playerMaxHP}`;
    
    render();
}

// Defeat Enemy
function defeatEnemy(enemy) {
    gameState.enemies = gameState.enemies.filter(e => e !== enemy);
    const template = ENEMY_TYPES[enemy.type];
    const xpGain = template.xp + (gameState.floor - 1) * 10;
    const lootGain = template.loot + (gameState.floor - 1) * 5;
    
    gameState.playerXP += xpGain;
    gameState.gold += lootGain;
    
    addLog(`🎉 Victory! +${xpGain} XP, +${lootGain} gold`);
    
    checkLevelUp();
    gameState.inCombat = false;
    gameState.currentEnemy = null;
    render();
}

// Check Level Up
function checkLevelUp() {
    while (gameState.playerXP >= gameState.playerXPNeeded) {
        gameState.playerXP -= gameState.playerXPNeeded;
        gameState.playerLevel++;
        gameState.playerMaxHP += 20;
        gameState.playerHP = gameState.playerMaxHP;
        gameState.playerXPNeeded = Math.floor(gameState.playerXPNeeded * 1.2);
        addLog(`🌟 LEVEL UP! You are now level ${gameState.playerLevel}!`);
    }
}

// Flee from Combat
function flee() {
    if (Math.random() < 0.5) {
        gameState.inCombat = false;
        gameState.currentEnemy = null;
        closeModal();
        // Move back
        gameState.playerX--;
        gameState.playerY--;
        addLog('🏃 Fled from combat!');
        render();
    } else {
        const enemy = gameState.currentEnemy;
        const enemyDmg = Math.floor(Math.random() * enemy.dmg) + 2;
        gameState.playerHP -= enemyDmg;
        addLog(`❌ Failed to flee! ${enemy.type} dealt ${enemyDmg} damage!`);
        if (gameState.playerHP <= 0) {
            gameOver();
            closeModal();
        }
    }
}

// Complete Floor
function completeFloor() {
    gameState.floor++;
    gameState.room = 0;
    gameState.playerMaxHP += 30;
    gameState.playerHP = gameState.playerMaxHP;
    generateFloor();
    addLog(`🏰 FLOOR COMPLETE! Advancing to floor ${gameState.floor}`);
}

// Game Over
function gameOver() {
    showModal('💀 GAME OVER',
        `You died on Floor ${gameState.floor}, Room ${gameState.room + 1}\n\nFinal Stats:\nLevel: ${gameState.playerLevel}\nGold: ${gameState.gold}`,
        [{ text: 'Restart', onclick: () => restart() }]);
}

// Restart Game
function restart() {
    gameState.floor = 1;
    gameState.room = 0;
    gameState.playerX = 0;
    gameState.playerY = 0;
    gameState.playerHP = 100;
    gameState.playerMaxHP = 100;
    gameState.playerLevel = 1;
    gameState.playerXP = 0;
    gameState.playerXPNeeded = 100;
    gameState.gold = 0;
    gameState.inventory = [];
    gameState.inCombat = false;
    gameState.currentEnemy = null;
    document.getElementById('combatLog').innerHTML = '';
    generateFloor();
    closeModal();
    render();
}

// Render Game
function render() {
    updateStats();
    renderMap();
    renderInventory();
}

// Update Stats Display
function updateStats() {
    document.getElementById('hp').textContent = gameState.playerHP;
    document.getElementById('maxHp').textContent = gameState.playerMaxHP;
    document.getElementById('level').textContent = gameState.playerLevel;
    document.getElementById('xp').textContent = gameState.playerXP;
    document.getElementById('xpNeeded').textContent = gameState.playerXPNeeded;
    document.getElementById('gold').textContent = gameState.gold;
}

// Render Map
function renderMap() {
    const mapContainer = document.getElementById('dungeonMap');
    mapContainer.innerHTML = '';
    mapContainer.style.gridTemplateColumns = `repeat(${GAME_WIDTH}, 1fr)`;
    
    for (let y = 0; y < GAME_HEIGHT; y++) {
        for (let x = 0; x < GAME_WIDTH; x++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            
            if (gameState.playerX === x && gameState.playerY === y) {
                tile.textContent = '🧙';
                tile.classList.add('player');
            } else if (gameState.maze[y][x] === 1) {
                tile.textContent = '█';
                tile.classList.add('wall');
            } else if (gameState.stairsX === x && gameState.stairsY === y) {
                tile.textContent = '🪜';
                tile.classList.add('stairs');
            } else {
                const enemy = gameState.enemies.find(e => e.x === x && e.y === y);
                if (enemy) {
                    tile.textContent = ENEMY_TYPES[enemy.type].emoji;
                    tile.classList.add('enemy', enemy.type);
                } else if (gameState.potions.some(p => p.x === x && p.y === y)) {
                    tile.textContent = '🧪';
                    tile.classList.add('potion');
                } else if (gameState.chests.some(c => c.x === x && c.y === y)) {
                    tile.textContent = '📦';
                    tile.classList.add('chest');
                } else {
                    tile.textContent = '·';
                    tile.classList.add('floor');
                }
            }
            
            mapContainer.appendChild(tile);
        }
    }
}

// Render Inventory
function renderInventory() {
    const invContainer = document.getElementById('inventory');
    invContainer.innerHTML = '';
    
    if (gameState.inventory.length === 0) {
        invContainer.innerHTML = '<div style="color: #999;">Empty</div>';
        return;
    }
    
    gameState.inventory.forEach((item, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'inventory-item';
        itemEl.innerHTML = `<span class="item-name">${item.name}</span><br><span class="item-stats">${item.stats}</span>`;
        invContainer.appendChild(itemEl);
    });
}

// Add Log Entry
function addLog(message) {
    const log = document.getElementById('combatLog');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if (message.includes('💥') || message.includes('⚔️')) entry.classList.add('damage');
    if (message.includes('🧪')) entry.classList.add('heal');
    if (message.includes('🎉')) entry.classList.add('victory');
    if (message.includes('🌟')) entry.classList.add('level-up');
    
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

// Modal Functions
function showModal(title, body, actions = []) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    const actionsDiv = document.getElementById('modalActions');
    actionsDiv.innerHTML = '';
    
    actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'modal-btn primary';
        btn.textContent = action.text;
        btn.onclick = action.onclick;
        actionsDiv.appendChild(btn);
    });
    
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

// Setup Controls
function setupControls() {
    // Arrow Keys
    document.getElementById('moveUp').onclick = () => movePlayer(0, -1);
    document.getElementById('moveLeft').onclick = () => movePlayer(-1, 0);
    document.getElementById('moveDown').onclick = () => movePlayer(0, 1);
    document.getElementById('moveRight').onclick = () => movePlayer(1, 0);
    
    // Actions
    document.getElementById('attackBtn').onclick = () => {
        if (gameState.inCombat) playerAttack();
        else addLog('⚔️ No enemies nearby!');
    };
    
    document.getElementById('useItemBtn').onclick = () => {
        if (gameState.inventory.length === 0) {
            addLog('🧪 No items in inventory!');
        } else {
            addLog('🧪 Item used!');
        }
    };
    
    document.getElementById('restBtn').onclick = () => {
        gameState.playerHP = Math.min(gameState.playerMaxHP, gameState.playerHP + 20);
        addLog(`😴 Rested. HP: ${gameState.playerHP}/${gameState.playerMaxHP}`);
        render();
    };
    
    // Keyboard Support
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('modal').classList.contains('hidden')) {
            switch(e.key) {
                case 'ArrowUp': case 'w': case 'W': movePlayer(0, -1); break;
                case 'ArrowLeft': case 'a': case 'A': movePlayer(-1, 0); break;
                case 'ArrowDown': case 's': case 'S': movePlayer(0, 1); break;
                case 'ArrowRight': case 'd': case 'D': movePlayer(1, 0); break;
            }
        }
    });
    
    // Modal Close
    document.getElementById('modalClose').onclick = closeModal;
    document.getElementById('modal').onclick = (e) => {
        if (e.target === document.getElementById('modal')) closeModal();
    };
}

// Start Game
init();
