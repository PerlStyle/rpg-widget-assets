



class RPGWidget {
  constructor() {
    this.ws = null;
    this.gameState = null;
    this.currentPlayer = null;

    this.assets = { manifest:null, images:new Map() };
    this.anim = { state:'idle', frame:0, lastTime:0, frameMs:125 }; // ~8fps
    this.equipment = {}; // name->sprite key
    this.appearance = {}; // layer->sprite key

    this.initElements();
    this.loadAssets().then(()=> {
      this.connectWebSocket();
      this.setupStreamElementsAPI();
      this.loop(); // start render loop
    });
  }

  initElements() {
    this.gameLog = document.getElementById('gameLog');
    this.playerStats = document.getElementById('playerStats');
    this.mapCanvas = document.getElementById('mapCanvas');
    this.mapCtx = this.mapCanvas.getContext('2d');

    this.charCanvas = document.getElementById('charCanvas');
    this.charCtx = this.charCanvas.getContext('2d');

    this.drawMap(); // initial minimap bg

    this.charEl = document.getElementById('char');
    this.startIdleScheduler();
  }

  connectWebSocket() {
    try {
      this.ws = new WebSocket('ws://localhost:3001');
      
      this.ws.onopen = () => {
        this.log('Connected to game server');
        this.ws.send(JSON.stringify({ type: 'subscribe' }));
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleGameUpdate(data);
      };
      
      this.ws.onerror = (error) => {
        this.log('WebSocket error - running in demo mode');
      };
      
      this.ws.onclose = () => {
        this.log('Connection to server lost');
        setTimeout(() => this.connectWebSocket(), 5000);
      };
    } catch (error) {
      this.log('Cannot connect to local server - demo mode');
    }
  }

  setupStreamElementsAPI() {
    // Check if we're running inside StreamElements
    if (typeof window.addEventListener !== 'undefined') {
      window.addEventListener('onEventReceived', (obj) => {
        const listener = obj.detail.listener;
        const event = obj.detail.event;
        
        if (listener === 'message') {
          this.handleChatMessage(event.data);
        }
      });
    }

    // SE Store integration for persistence
    if (typeof SE_API !== 'undefined' && SE_API.store) {
      this.loadFromSEStore();
    }
  }

  handleChatMessage(data) {
    const username = data.displayName || data.nick;
    const message = data.text;
    
    // Log chat messages that start with !
    if (message.startsWith('!')) {
      this.log(`${username}: ${message}`);
    }
  }

  handleGameUpdate(data) {
    switch (data.type) {
      case 'gameUpdate':
        this.updateGameState(data.data);
        break;
      case 'playerMove':
        this.updatePlayerStats(data.player);
        this.triggerWalk();
        break;
      case 'diceRoll':
        this.showDiceRoll(data);
        break;
    }
  }

  setCharState(state) {
    if (!this.charEl) return;
      this.charEl.classList.remove('state-idle0','state-idle1','state-idle2','state-idle-combat0','state-idle-combat1','state-idle-combat2','state-walk');
      this.charEl.classList.add(state);
  }

  setWeapon(name) { // 'dagger' | 'spear'
    if (!this.charEl) return;
    this.charEl.classList.remove('weapon-dagger','weapon-spear');
    this.charEl.classList.add('weapon-' + name);
  }

  setHead(name) { // 'mage_hat' (add more later)
    if (!this.charEl) return;
    this.charEl.classList.remove('head-mage_hat');
    this.charEl.classList.add('head-' + name);
  }

  triggerWalk() {        // call this on move events
    if (!this.charEl) return;
    this.setCharState('state-walk');
    clearTimeout(this._walkT);
   this._walkT = setTimeout(() => this.setCharState('state-idle0'), 600);
  }

  startIdleScheduler() { // ~80/10/10 idle mix
    let alt = 1;
    setInterval(() => {
      if (!this.charEl) return;
      if (this.charEl.classList.contains('state-walk')) return;
      this.setCharState('state-idle' + alt);
      setTimeout(() => this.setCharState('state-idle0'), 3000);
      alt = (alt === 1 ? 2 : 1);
    }, 30000);
  }

  triggerWalk(){
    this.anim.state = 'walk';
    // auto return to idle after short time
    clearTimeout(this.anim._t);
    this.anim._t = setTimeout(()=>{ this.anim.state = 'idle'; }, 600);
  }

  updateGameState(gameData) {
    this.gameState = gameData;
    if (gameData.players && gameData.players.length > 0) {
      // Update with most recently active player
      this.updatePlayerStats(gameData.players[gameData.players.length - 1]);
    }
  }

  updatePlayerStats(player) {
    this.currentPlayer = player;
    
    const activePlayerDiv = document.getElementById('activePlayer');
    const hpBar = document.getElementById('hpBar');
    const xpBar = document.getElementById('xpBar');
    
    activePlayerDiv.innerHTML = `
      ${player.username}<br>
      Lvl ${player.level} ${player.class}<br>
      HP: ${player.hp}/${player.maxHP}<br>
      ATK: ${player.attack} DEF: ${player.defense}<br>
      Gold: ${player.gold}
    `;
    this.fetchAndDrawViewport(player.x, player.y);
    const hpPercent = (player.hp / player.maxHP) * 100;
    hpBar.style.width = hpPercent + '%';
    
    // XP bar (assuming 100 XP per level for now)
    const xpForNextLevel = player.level * 100;
    const xpPercent = (player.experience % 100);
    xpBar.style.width = xpPercent + '%';
    this.fetchAndDrawViewport(player.x, player.y);
  }

  showDiceRoll(rollData) {
    this.log(`${rollData.username} rolled ${rollData.roll}/${rollData.sides}${rollData.isCritical ? ' (CRITICAL!)' : ''}`);
    
    // Show floating text effect
    this.showFloatingText(rollData.roll, rollData.isCritical ? 'critical' : '');
  }

  showFloatingText(text, className = '') {
    const floatingDiv = document.createElement('div');
    floatingDiv.className = `floating-text ${className}`;
    floatingDiv.textContent = text;
    
    // Random position in center area
    floatingDiv.style.left = (window.innerWidth / 2 - 50 + Math.random() * 100) + 'px';
    floatingDiv.style.top = (window.innerHeight / 2 + Math.random() * 100) + 'px';
    
    document.body.appendChild(floatingDiv);
    
    // Remove after animation
    setTimeout(() => {
      if (floatingDiv.parentNode) {
        floatingDiv.parentNode.removeChild(floatingDiv);
      }
    }, 2000);
  }

  drawMap() {
    // Simple grid-based minimap
    this.mapCtx.fillStyle = '#1a1a1a';
    this.mapCtx.fillRect(0, 0, 196, 196);
    
    // Draw grid
    this.mapCtx.strokeStyle = '#333';
    this.mapCtx.lineWidth = 1;
    
    for (let i = 0; i <= 196; i += 20) {
      this.mapCtx.beginPath();
      this.mapCtx.moveTo(i, 0);
      this.mapCtx.lineTo(i, 196);
      this.mapCtx.stroke();
      
      this.mapCtx.beginPath();
      this.mapCtx.moveTo(0, i);
      this.mapCtx.lineTo(196, i);
      this.mapCtx.stroke();
    }
    
    // Draw player position if available
    if (this.currentPlayer) {
      this.mapCtx.fillStyle = '#3498db';
      this.mapCtx.fillRect(this.currentPlayer.x * 20 + 8, this.currentPlayer.y * 20 + 8, 4, 4);
    }
  }

  async loadAssets() {
    try {
      const res = await fetch('/api/assets/manifest');
      this.assets.manifest = await res.json();
      if (this.assets.manifest?.meta?.walkFps) {
        this.anim.frameMs = Math.round(1000 / this.assets.manifest.meta.walkFps);
      }
      // preload images
      const toLoad = [];
      const pushImgs = (frames=[]) => frames.forEach(p => { if (p) toLoad.push(p); });
      for (const v of Object.values(this.assets.manifest.sprites)) {
        pushImgs(v.idle); pushImgs(v.walk);
      }
      await Promise.all(toLoad.map(src => this.preload(src)));
      // defaults
      this.appearance = { ...(this.assets.manifest.defaults?.appearance || { "base":"base/default" }) };
      this.equipment =  { ...(this.assets.manifest.defaults?.equipment || {}) };
    } catch(e){ this.log('Asset manifest missing; using rectangles.'); }
  }
  preload(src){
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = ()=>{ this.assets.images.set(src, img); resolve(); };
      img.onerror = ()=> resolve(); // tolerate missing
      img.src = `/assets/${src}`;
    });
  }



  loop(ts=0){
    requestAnimationFrame((t)=>this.loop(t));
    if (!this.charCtx) return;

    // advance walk frames
    if (this.anim.state === 'walk') {
      if (ts - this.anim.lastTime > this.anim.frameMs) {
        this.anim.frame = (this.anim.frame + 1) % 6;
        this.anim.lastTime = ts;
      }
    } else {
      this.anim.frame = 0;
    }
    this.drawCharacter();
  }

  drawCharacter(){
    const ctx = this.charCtx;
    ctx.clearRect(0,0,this.charCanvas.width,this.charCanvas.height);

    const drawLayer = (key) => {
      const man = this.assets.manifest?.sprites?.[key];
      if (!man) return false;
      const frames = (this.anim.state === 'walk' ? man.walk : man.idle) || man.idle || [];
      const path = frames[Math.min(this.anim.frame, frames.length-1)];
      const img = this.assets.images.get(path);
      if (img) {
        const s = Math.min(this.charCanvas.width, this.charCanvas.height);
        ctx.drawImage(img, 0, 0, s, s);
        return true;
      }
      return false;
    };

    // draw base + equipped layers; fall back to a rectangle if assets missing
    const layers = this.assets.manifest?.layers || ["base","head","mainhand","offhand"];
    let drewAny = false;

    for (const layer of layers) {
      const spriteKey =
       this.equipment[layer] ||
        this.appearance[layer] ||
        (layer === 'base' ? (this.appearance.base || 'base/default') : null);
      if (spriteKey) drewAny = drawLayer(spriteKey) || drewAny;
    }

    if (!drewAny) {
    // fallback placeholder
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(32, 16, 64, 96);
    }
  }

  async fetchAndDrawViewport(cx, cy) {
    try {
      const r = 3;
      const res = await fetch(`/api/viewport?x=${cx}&y=${cy}&r=${r}`);
      const vp = await res.json();
      this.drawViewport(vp);
    } catch {
      this.log('Viewport fetch failed (demo mode).');
    }
  }

  drawViewport(vp) {
    const size = 196;           // canvas size
    const tiles = 7;            // 7x7
    const cell = Math.floor(size / tiles);
    this.mapCtx.clearRect(0,0,size,size);

    // background
    this.mapCtx.fillStyle = '#1a1a1a';
    this.mapCtx.fillRect(0,0,size,size);

    // grid + walls
    const { x:cx, y:cy } = vp.center;
    let i = 0;
    for (let y = cy - vp.radius; y <= cy + vp.radius; y++) {
      for (let x = cx - vp.radius; x <= cx + vp.radius; x++) {
        const px = (i % tiles) * cell;
        const py = Math.floor(i / tiles) * cell;

        // cell bg
        this.mapCtx.strokeStyle = '#333';
        this.mapCtx.strokeRect(px, py, cell, cell);

        const tile = vp.tiles[i];
        if (tile?.blocked) {
          this.mapCtx.fillStyle = '#444';
          this.mapCtx.fillRect(px+1, py+1, cell-2, cell-2);
        }
        // center (player)
        if (x === cx && y === cy) {
          this.mapCtx.fillStyle = '#3498db';
          const s = Math.floor(cell * 0.35);
          this.mapCtx.fillRect(px + (cell-s)/2, py + (cell-s)/2, s, s);
        }
        i++;
      }
    }
  }
  
  log(message) {
    const logDiv = document.createElement('div');
    logDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.gameLog.appendChild(logDiv);
    
    // Keep log scrolled to bottom
    this.gameLog.scrollTop = this.gameLog.scrollHeight;
    
    // Limit log entries
    while (this.gameLog.children.length > 50) {
      this.gameLog.removeChild(this.gameLog.firstChild);
    }
  }

  loadFromSEStore() {
    SE_API.store.get('rpgGameState').then(data => {
      if (data) {
        this.gameState = data;
        this.log('Loaded game state from StreamElements');
      }
    });
  }

  saveToSEStore() {
    if (typeof SE_API !== 'undefined' && SE_API.store && this.gameState) {
      SE_API.store.set('rpgGameState', this.gameState);
    }
  }
}

// Initialize widget when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.rpgWidget = new RPGWidget();
});

// Save state periodically if SE is available
setInterval(() => {
  if (window.rpgWidget) {
    window.rpgWidget.saveToSEStore();
  }
}, 30000);
