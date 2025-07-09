document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const scoreEl = document.getElementById('score');
    const finalScoreEl = document.getElementById('finalScore');
    const flowBar = document.getElementById('flowBar');
    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');

    // Audio Elements
    const backgroundMusic = new Audio('YOUR_BACKGROUND_MUSIC.mp3'); // Replace with your music file
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.3;

    const orbCollectSound = new Audio('YOUR_ORB_COLLECT_SOUND.mp3'); // Replace with your sound file
    orbCollectSound.volume = 0.7;

    const dashSound = new Audio('YOUR_DASH_SOUND.mp3'); // Replace with your sound file
    dashSound.volume = 0.5;

    const levelUpSound = new Audio('YOUR_LEVEL_UP_SOUND.mp3'); // Replace with your sound file
    levelUpSound.volume = 0.6;

    const gameOverSound = new Audio('YOUR_GAME_OVER_SOUND.mp3'); // Replace with your sound file
    gameOverSound.volume = 0.8;

    function playSound(audioElement) {
        audioElement.currentTime = 0; // Rewind to start for quick playback
        audioElement.play().catch(e => console.error("Audio playback failed:", e));
    }

    let canvasWidth, canvasHeight;

    function resizeCanvas() {
        const container = canvas.parentElement;
        const style = getComputedStyle(container);
        const rect = canvas.getBoundingClientRect();
        canvasWidth = rect.width;
        canvasHeight = rect.height;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        console.log('resizeCanvas - rect.width:', rect.width, 'rect.height:', rect.height);
        console.log('resizeCanvas - canvas.width:', canvas.width, 'canvas.height:', canvas.height);
        console.log('resizeCanvas - canvas.getBoundingClientRect():', rect);

        resetGame();
    }

    // --- Game State ---
    let gameState = 'start';
    let frameCount = 0;
    let score = 0;
    let flow = 0;
    let level = 1;
    let gameSpeed = 1;
    let levelUpScore = 2000;
    let keysPressed = {};

    // --- Entities ---
    let player = {};
    let obstacles = [];
    let energyOrbs = [];
    let particles = [];

    // --- Player Object --- (Jellyfish)
    const playerProto = {
        x: 0, y: 0, radius: 15, renderRadius: 15,
        inFlow: false, flowDuration: 0, isDashing: false,
        dashCooldown: 0, dashDuration: 0, baseY: 0,
        angle: 0, // For tentacle animation
        draw() {
            this.angle += 0.1;
            const pulsatingRadius = this.radius + Math.sin(frameCount * 0.1) * 2;

            // Tentacles
            ctx.beginPath();
            ctx.strokeStyle = this.inFlow ? '#6BCB77' : '#4D96FF';
            ctx.lineWidth = 3;
            ctx.shadowColor = this.inFlow ? '#6BCB77' : '#4D96FF';
            ctx.shadowBlur = 15;
            for (let i = 0; i < 5; i++) {
                const tentacleAngle = this.angle + (i * Math.PI * 2 / 5);
                const length = 15 + Math.sin(this.angle * 2 + i) * 5;
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(
                    this.x + Math.cos(tentacleAngle) * length,
                    this.y + Math.sin(tentacleAngle) * length + 10 // Hang down a bit
                );
            }
            ctx.stroke();
            ctx.closePath();

            // Body
            ctx.beginPath();
            ctx.arc(this.x, this.y, pulsatingRadius, 0, Math.PI * 2);
            let playerColor = this.inFlow ? '#6BCB77' : '#4D96FF';
            if (this.isDashing) playerColor = '#FFFFFF';
            ctx.fillStyle = playerColor;
            ctx.shadowColor = playerColor;
            ctx.shadowBlur = 25;
            ctx.fill();
            ctx.closePath();

            ctx.shadowBlur = 0;
        }
    };
    
    // --- Particle System ---
    function createParticle(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                radius: Math.random() * 3 + 1,
                color: color,
                life: 40 // a bit longer life
            });
        }
    }

    function handleParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            ctx.globalAlpha = p.life / 40;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();

            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
        ctx.globalAlpha = 1.0;
    }
    
    // --- Background Particles ---
    function createBgParticle() {
        particles.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            vx: 0,
            vy: 0.3 * gameSpeed, // Slower and calmer
            radius: Math.random() * 2,
            color: 'rgba(224, 225, 221, 0.15)', // Match new text color
            life: Infinity,
            isBg: true
        });
    }

    function handleBgParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            if (!p.isBg) continue;
            
            p.y += p.vy;
            
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();

            if (p.y > canvasHeight) {
                p.y = 0;
                p.x = Math.random() * canvasWidth;
            }
        }
    }


    // --- Game Functions ---
    function addObstacle() {
        const typeRoll = Math.random();
        let obstacle;

        if (level > 1 && typeRoll > 0.8) { // Homing obstacles are even less frequent
            obstacle = {
                type: 'homing', x: Math.random() * canvasWidth, y: -30,
                width: 25, height: 25, color: '#F72585',
                speed: 2 * gameSpeed
            };
        } else {
            const brickLayout = [];
            const brickWidth = 40;
            const numBricksInRow = Math.floor(canvasWidth / brickWidth);
            let consecutiveGaps = 0;

            // Create a random layout of bricks and gaps
            for (let i = 0; i < numBricksInRow; i++) {
                // Adjust probability based on level. More bricks as level increases.
                const brickProbability = 0.6 + Math.min(0.25, level * 0.02);
                if (Math.random() < brickProbability) {
                    brickLayout.push(true); // It's a brick
                    consecutiveGaps = 0;
                } else {
                    brickLayout.push(false); // It's a gap
                    consecutiveGaps++;
                }
            }

            // Ensure there is at least one path wide enough for the player
            const requiredGaps = Math.ceil((player.radius * 2) / brickWidth);
            if (consecutiveGaps < requiredGaps) {
                // If not enough gaps were naturally created, force a path
                const pathStart = Math.floor(Math.random() * (numBricksInRow - requiredGaps));
                for (let i = 0; i < requiredGaps; i++) {
                    brickLayout[pathStart + i] = false;
                }
            }
            
            obstacle = {
                type: 'standard', y: -30, height: 25,
                color: '#FF6B6B', speed: 3.5 * gameSpeed,
                brickWidth: brickWidth,
                layout: brickLayout
            };
        }
        obstacles.push(obstacle);
    }

    function addEnergyOrb() {
        const x = Math.random() * (canvasWidth - 40) + 20;
        const y = -20;
        energyOrbs.push({ 
            x, y, radius: 8, color: '#80FFDB', speed: 2 * gameSpeed,
            baseX: x, angle: Math.random() * Math.PI * 2, amplitude: Math.random() * 30 + 20
        });
    }

    function handleEntities() {
        handleBgParticles();
        handleParticles();

        obstacles.forEach((obs, i) => {
            obs.y += obs.speed;
            if (obs.type === 'homing') {
                if (obs.x < player.x) obs.x += obs.speed * 0.25;
                if (obs.x > player.x) obs.x -= obs.speed * 0.25;
            }
            drawObstacle(obs);
            checkCollision(obs);
            if (obs.y - obs.height > canvasHeight) obstacles.splice(i, 1);
        });

        energyOrbs.forEach((orb, i) => {
            orb.y += orb.speed;
            orb.angle += 0.05;
            orb.x = orb.baseX + Math.sin(orb.angle) * orb.amplitude;

            drawEnergyOrb(orb);
            checkOrbCollection(orb, i);
            if (orb.y - orb.radius > canvasHeight) energyOrbs.splice(i, 1);
        });
    }

    function drawObstacle(obs) {
        ctx.shadowColor = obs.color;
        ctx.shadowBlur = 15;

        if (obs.type === 'homing') {
            const gradient = ctx.createRadialGradient(obs.x, obs.y, obs.width / 4, obs.x, obs.y, obs.width / 2);
            gradient.addColorStop(0, '#F72585');
            gradient.addColorStop(1, '#B5179E');
            ctx.fillStyle = gradient;

            ctx.beginPath();
            ctx.arc(obs.x, obs.y, obs.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

        } else {
            ctx.fillStyle = obs.color;
            const brickGap = 2;

            obs.layout.forEach((isBrick, i) => {
                if (isBrick) {
                    const x = i * obs.brickWidth;
                    ctx.fillRect(x, obs.y, obs.brickWidth - brickGap, obs.height);
                }
            });
        }
        ctx.shadowBlur = 0;
    }

    function drawEnergyOrb(orb) {
        ctx.fillStyle = orb.color;
        ctx.shadowColor = orb.color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function checkCollision(obs) {
        if (player.inFlow || player.isDashing) return;

        if (obs.type === 'homing') {
            const dx = player.x - obs.x;
            const dy = player.y - obs.y;
            if (Math.sqrt(dx * dx + dy * dy) < player.radius + obs.width / 2) {
                endGame();
            }
        } else {
            if (player.y > obs.y - player.radius && player.y < obs.y + obs.height + player.radius) {
                const playerBrickIndex = Math.floor(player.x / obs.brickWidth);
                if (obs.layout[playerBrickIndex]) {
                    // More precise check within the brick
                    const brickX = playerBrickIndex * obs.brickWidth;
                    if (player.x + player.radius > brickX && player.x - player.radius < brickX + obs.brickWidth) {
                        endGame();
                    }
                }
            }
        }
    }

    function checkOrbCollection(orb, index) {
        const dx = player.x - orb.x;
        const dy = player.y - orb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const magnetRadius = player.inFlow ? 150 : 50; // Have a small magnet radius normally

        if (distance < player.radius + orb.radius + magnetRadius) {
            // Magnetic pull
            orb.x += (player.x - orb.x) * 0.1;
            orb.y += (player.y - orb.y) * 0.1;
            
            if (distance < player.radius + orb.radius) {
                score += 150;
                flow = Math.min(100, flow + 10);
                createParticle(orb.x, orb.y, orb.color, 15);
                playSound(orbCollectSound);
                energyOrbs.splice(index, 1);
            }
        }
    }

    function updatePlayer() {
        // Keyboard movement
        if (keysPressed['ArrowLeft']) {
            player.x -= 7 * gameSpeed;
        }
        if (keysPressed['ArrowRight']) {
            player.x += 7 * gameSpeed;
        }

        // Clamp player position to screen bounds
        if (player.x < player.radius) {
            player.x = player.radius;
        }
        if (player.x > canvasWidth - player.radius) {
            player.x = canvasWidth - player.radius;
        }

        // Dash logic
        if (player.dashCooldown > 0) player.dashCooldown--;
        if (player.isDashing) {
            player.y -= 5;
            player.dashDuration--;
            createParticle(player.x, player.y + player.radius, 'rgba(255, 255, 255, 0.5)', 2);
            if (player.dashDuration <= 0) player.isDashing = false;
        } else if (player.y < player.baseY) {
            player.y = Math.min(player.baseY, player.y + 3);
        }
    }

    function updateGameProgress() {
        score++;
        scoreEl.textContent = score;

        if (score > levelUpScore) {
            level++;
            gameSpeed *= 1.05;
            levelUpScore *= 2.5;
            createParticle(canvasWidth / 2, canvasHeight / 2, '#FFFFFF', 50);
            playSound(levelUpSound);
        }

        if (!player.inFlow) {
            // Slower flow gain, more rewarding to collect orbs
            flow = Math.min(100, flow + 0.05); 
            if (flow >= 100) {
                player.inFlow = true;
                player.flowDuration = 300; // 5 seconds
            }
        }
        flowBar.style.width = `${flow}%`;

        if (player.inFlow) {
            player.flowDuration--;
            if (player.flowDuration <= 0) {
                player.inFlow = false;
                flow = 0;
            }
        }
    }

    function startGame() {
        gameState = 'playing';
        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        resetGame();
        backgroundMusic.play().catch(e => console.error("Background music playback failed:", e));
        gameLoop();
    }

    function resetGame() {
        frameCount = 0;
        score = 0;
        flow = 0;
        level = 1;
        gameSpeed = 1;
        levelUpScore = 2000;

        obstacles = [];
        energyOrbs = [];
        particles = particles.filter(p => p.isBg);

        player = Object.create(playerProto);
        player.x = canvasWidth / 2;
        player.baseY = canvasHeight - 150; // Move player up even more
        player.y = player.baseY;
        
        if (particles.filter(p => p.isBg).length === 0) {
            for(let i = 0; i < 50; i++) {
                createBgParticle();
            }
        }
    }

    function endGame() {
        gameState = 'gameOver';
        finalScoreEl.textContent = score;
        gameOverScreen.style.display = 'flex';
        createParticle(player.x, player.y, '#FF6B6B', 50); // Use a reddish color for impact
        playSound(gameOverSound);
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        triggerScreenShake(15, 0.5);
    }

    function gameLoop() {
        if (gameState !== 'playing') return;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        updateGameProgress();
        handleEntities();
        updatePlayer();
        player.draw();

        frameCount++;
        if (frameCount % Math.floor(60 / gameSpeed) === 0) {
            addObstacle();
        }
        if (frameCount % Math.floor(150 / gameSpeed) === 0) {
            addEnergyOrb();
        }

        requestAnimationFrame(gameLoop);
    }

    // --- Event Listeners ---
    function handlePointerMove(x) {
        const rect = canvas.getBoundingClientRect();
        player.x = x - rect.left;
        if (player.x < player.radius) player.x = player.radius;
        if (player.x > canvasWidth - player.radius) player.x = canvasWidth - player.radius;
    }

    function triggerDash() {
        if (player.dashCooldown <= 0 && !player.isDashing) {
            player.isDashing = true;
            player.dashDuration = 30;
            player.dashCooldown = 120;
            createParticle(player.x, player.y, '#FFFFFF', 20);
            playSound(dashSound);
            triggerScreenShake(5, 0.3);
        }
    }

    function triggerScreenShake(intensity, duration) {
        document.body.style.transition = 'transform 0.1s';
        document.body.style.transform = `translate(${Math.random() * intensity - intensity / 2}px, ${Math.random() * intensity - intensity / 2}px)`;

        setTimeout(() => {
            document.body.style.transform = 'none';
        }, duration * 1000);
    }

    // Use pointer events for broader compatibility
    canvas.addEventListener('pointermove', (e) => {
        if (gameState === 'playing' && e.pointerType !== 'touch') handlePointerMove(e.clientX);
    });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (gameState === 'playing') handlePointerMove(e.touches[0].clientX);
    }, { passive: false });

    canvas.addEventListener('pointerdown', (e) => {
        if (gameState === 'playing') triggerDash();
    });

    window.addEventListener('keydown', (e) => {
        keysPressed[e.key] = true;
        // Prevent default browser action for space key
        if (e.key === ' ') {
            e.preventDefault();
            triggerDash();
        }
    });

    window.addEventListener('keyup', (e) => {
        keysPressed[e.key] = false;
    });
    
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    window.addEventListener('resize', resizeCanvas);

    // Initial setup
    resizeCanvas();
    startScreen.style.display = 'flex';
});
