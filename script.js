const tg = window.Telegram.WebApp;
tg.expand();

let balance = 0;
let history = [];
const initData = tg.initData; // Передается на сервер для безопасной авторизации

// Инициализация данных пользователя из Telegram
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {  
    let u = tg.initDataUnsafe.user;  
    document.getElementById('user-name').innerText = '👤 ' + u.first_name;  
    document.getElementById('prof-fullname').innerText = u.first_name + (u.last_name ? ' ' + u.last_name : '');  
    document.getElementById('prof-username').innerText = u.username ? '@' + u.username : '@no_username';  
    document.getElementById('prof-id').innerText = 'ID: ' + u.id;  
}

// Запрос баланса с сервера Python
async function fetchUserData() {
    try {
        let res = await fetch('/api/user_info', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ initData })
        });
        let data = await res.json();
        if(data.success) {
            balance = data.balance;
            history = data.history || [];
            document.getElementById('user-balance').innerText = balance;
            renderHistory();
        }
    } catch(e) {
        console.error("Ошибка загрузки данных пользователя", e);
    }
}
fetchUserData();

function renderHistory() {  
    let box = document.getElementById('history-box');  
    box.innerHTML = history.length === 0 ? '<div style="font-size:12px; color:#64748b; text-align:center;">История пуста</div>' : '';  
    history.forEach(h => {  
        let item = document.createElement('div');  
        item.className = 'history-item';  
        item.style.borderLeftColor = h.amt >= 0 ? 'var(--green)' : 'var(--red)';  
        item.innerHTML = `<span>${h.title}</span><span style="font-weight:bold; color:${h.amt>=0?'var(--green)':'var(--red)'}">${h.amt>=0?'+':''}${h.amt} VIR</span>`;  
        box.appendChild(item);  
    });  
}  

function validateBet(game) {  
    let val = parseInt(document.getElementById(game + '-bet').value) || 0;  
    let err = document.getElementById(game + '-err');  
    let btn = document.getElementById(game + '-btn') || document.getElementById(game + '-action-btn');  
    if(val < 100) {  
        err.style.display = 'block';  
        if(btn) btn.disabled = true;  
        return false;  
    } else {  
        err.style.display = 'none';  
        if(btn) btn.disabled = false;  
        return true;  
    }  
}  

function showNotice(title, text, isWin) {  
    const modal = document.getElementById('win-modal');  
    document.getElementById('modal-title').innerText = title;  
    document.getElementById('modal-title').style.color = isWin ? 'var(--gold)' : 'var(--red)';  
    document.getElementById('modal-text').innerText = text;  
    modal.style.display = 'block';  
    setTimeout(() => { modal.style.display = 'none'; }, 1800);  
}  

function switchTab(tab, btn) {  
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');  
    document.querySelectorAll('.tab-btn').forEach(b => b.className = 'tab-btn');  
    document.getElementById(tab + (tab === 'profile' ? '-page' : '-game')).style.display = 'flex';  
    btn.classList.add('active-' + tab);  
    if(tab === 'wheel') drawWheel(0);  
    if(tab === 'mines' && document.getElementById('mines-board').children.length === 0) resetMinesBoard();  
}  

function switchProfSub(sub) {  
    document.getElementById('prof-sub-history').style.display = sub === 'history' ? 'block' : 'none';  
    document.getElementById('prof-sub-tasks').style.display = sub === 'tasks' ? 'block' : 'none';  
}  

/* --- 1. PLINKO --- */  
const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;  
const engine = Engine.create();  
const render = Render.create({  
    element: document.getElementById('plinko-board'),  
    engine: engine,  
    options: { width: 280, height: 310, wireframes: false, background: '#030712' }  
});  

for (let i = 0; i < 7; i++) {  
    let count = i + 3;  
    let spacing = 280 / (count + 1);  
    for (let j = 0; j < count; j++) {  
        Composite.add(engine.world, Bodies.circle((j + 1) * spacing, 35 + i * 35, 6, {  
            isStatic: true, render: { fillStyle: '#38bdf8' }  
        }));  
    }  
}  

const mults = [10, 2, 0.5, 0.2, 0.5, 2, 10];  
const colors = ['#ef4444', '#f97316', '#eab308', '#64748b', '#eab308', '#f97316', '#ef4444'];  
const bWidth = 280 / mults.length;  

for (let i = 0; i < mults.length; i++) {  
    Composite.add(engine.world, Bodies.rectangle(i * bWidth + bWidth / 2, 295, bWidth - 2, 28, {  
        isStatic: true, isSensor: true, render: { fillStyle: colors[i] }, label: `m_${mults[i]}`  
    }));  
}  
Render.run(render); Runner.run(Runner.create(), engine);  

let plinkoActiveBalls = 0, plinkoTotalWin = 0, plinkoLogs = [];  
function dropBall() {  
    if(!validateBet('plinko')) return;  
    let bet = parseInt(document.getElementById('plinko-bet').value);  
    let ballsCount = parseInt(document.getElementById('plinko-balls').value) || 2;  
    ballsCount = Math.max(2, Math.min(10, ballsCount));  

    if(bet > balance) return showNotice('Ошибка', 'Недостаточно баланса!', false);  

    let perBallBet = bet / ballsCount;  
    plinkoActiveBalls = ballsCount; plinkoTotalWin = 0; plinkoLogs = [];  
    document.getElementById('plinko-btn').disabled = true;  

    for(let i=0; i<ballsCount; i++) {  
        setTimeout(() => {  
            let ball = Bodies.circle(140 + (Math.random() * 16 - 8), 10, 6, {  
                restitution: 0.6, friction: 0.1, render: { fillStyle: '#facc15' }, label: `b_${perBallBet}`  
            });  
            Composite.add(engine.world, ball);  
        }, i * 250);  
    }  
}  

Events.on(engine, 'collisionStart', async (e) => {  
    for (let p of e.pairs) {  
        let b = p.bodyA.label.startsWith('b_') ? p.bodyA : (p.bodyB.label.startsWith('b_') ? p.bodyB : null);  
        let m = p.bodyA.label.startsWith('m_') ? p.bodyA : (p.bodyB.label.startsWith('m_') ? p.bodyB : null);  
        if(b && m) {  
            let ballBet = parseFloat(b.label.split('_')[1]);  
            let mult = parseFloat(m.label.split('_')[1]);  
            let win = ballBet * mult;  
            plinkoTotalWin += win;  
            plinkoLogs.push(`x${mult}`);  
            Composite.remove(engine.world, b);  
            plinkoActiveBalls--;  

            document.getElementById('plinko-results').innerText = `Выпало: ${plinkoLogs.join(', ')}`;  

            if(plinkoActiveBalls <= 0) {  
                let bet = parseInt(document.getElementById('plinko-bet').value);
                let finalWin = Math.floor(plinkoTotalWin);  

                // Отправляем результат на сервер
                let res = await fetch('/api/play', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ initData, game: 'plinko', bet, win: finalWin })
                });
                let data = await res.json();
                if(data.success) {
                    balance = data.balance;
                    document.getElementById('user-balance').innerText = balance;
                    showNotice('Итоги Plinko', `${finalWin >= bet ? '+' : ''}${finalWin - bet} VIR`, finalWin >= bet);  
                } else {
                    showNotice('Ошибка', data.message, false);
                }
                document.getElementById('plinko-btn').disabled = false;  
            }  
        }  
    }  
});  

/* --- 2. SLOTS --- */  
const slotItems = ['7️⃣', '🍋', '🍒', '🍇'];  
async function spinSlots() {  
    if(!validateBet('slots')) return;  
    let bet = parseInt(document.getElementById('slots-bet').value);  
    if(bet > balance) return showNotice('Ошибка', 'Недостаточно баланса!', false);  

    let btn = document.getElementById('slots-btn'); btn.disabled = true;  

    let interval = setInterval(() => {  
        document.getElementById('s1').innerText = slotItems[Math.floor(Math.random()*slotItems.length)];  
        document.getElementById('s2').innerText = slotItems[Math.floor(Math.random()*slotItems.length)];  
        document.getElementById('s3').innerText = slotItems[Math.floor(Math.random()*slotItems.length)];  
    }, 80);  

    let res = await fetch('/api/play', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ initData, game: 'slots', bet })
    });
    let data = await res.json();

    setTimeout(() => {  
        clearInterval(interval); btn.disabled = false;  
        if(!data.success) return showNotice('Ошибка', data.message, false);

        balance = data.balance;
        document.getElementById('user-balance').innerText = balance;
        document.getElementById('s1').innerText = data.reels[0];  
        document.getElementById('s2').innerText = data.reels[1];  
        document.getElementById('s3').innerText = data.reels[2];  

        if(data.win > 0) {  
            showNotice('🎉 Выигрыш!', `+${data.win} VIR`, true);  
        } else {  
            showNotice('❌ Неповезло', 'Попробуй еще раз!', false);  
        }  
    }, 1500);  
}  

/* --- 3. WHEEL --- */  
const canvas = document.getElementById('wheel-canvas');  
const ctx = canvas.getContext('2d');  
const wheelSectors = [0, 2, 0.5, 3, 0, 1.5, 0.2, 5];  

function drawWheel(angle = 0) {  
    let numSectors = wheelSectors.length;  
    let arc = (2 * Math.PI) / numSectors;  
    ctx.clearRect(0, 0, 280, 280);  

    for (let i = 0; i < numSectors; i++) {  
        let sa = angle + i * arc;  
        ctx.beginPath();  
        ctx.fillStyle = i % 2 === 0 ? '#6d28d9' : '#a855f7';  
        ctx.moveTo(140, 140);  
        ctx.arc(140, 140, 120, sa, sa + arc);  
        ctx.fill();  

        ctx.save();  
        ctx.translate(140, 140);  
        ctx.rotate(sa + arc / 2);  
        ctx.fillStyle = '#fff';  
        ctx.font = 'bold 14px sans-serif';  
        ctx.fillText(`x${wheelSectors[i]}`, 60, 5);  
        ctx.restore();  
    }  
}  

async function spinWheel() {  
    if(!validateBet('wheel')) return;  
    let bet = parseInt(document.getElementById('wheel-bet').value);  
    if(bet > balance) return showNotice('Ошибка', 'Недостаточно баланса!', false);  

    let btn = document.getElementById('wheel-btn'); btn.disabled = true;  

    let res = await fetch('/api/play', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ initData, game: 'wheel', bet })
    });
    let data = await res.json();
    if(!data.success) {
        btn.disabled = false;
        return showNotice('Ошибка', data.message, false);
    }

    let extraRotations = Math.PI * 8 + (data.targetAngle || 0);  
    let start = performance.now();  

    function anim(time) {  
        let prog = Math.min((time - start) / 2500, 1);  
        let ease = 1 - Math.pow(1 - prog, 3);  
        let currentAngle = extraRotations * ease;  
        drawWheel(currentAngle);  

        if(prog < 1) {  
            requestAnimationFrame(anim);  
        } else {  
            btn.disabled = false;  
            balance = data.balance;
            document.getElementById('user-balance').innerText = balance;
            showNotice(data.win > 0 ? '🎉 Выигрыш!' : '📉 Проигрыш', `x${data.mult} (${data.win} VIR)`, data.win > 0);  
        }  
    }  
    requestAnimationFrame(anim);  
}  

/* --- 4. MINES --- */  
let minesGameActive = false, currentMinesBet = 0, openedCount = 0;  
let activeMults = [];  

function resetMinesBoard() {  
    let board = document.getElementById('mines-board');  
    board.innerHTML = '';  
    for(let i=0; i<30; i++) {  
        let tile = document.createElement('div');  
        tile.className = 'mine-tile';  
        tile.innerText = '❓';  
        tile.onclick = () => clickMineTile(i, tile);  
        board.appendChild(tile);  
    }  
}  

async function handleMinesAction() {  
    if(minesGameActive) {  
        // Забрать выигрыш
        let res = await fetch('/api/mines/cashout', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ initData })
        });
        let data = await res.json();
        if(data.success) {
            balance = data.balance;
            document.getElementById('user-balance').innerText = balance;
            showNotice('💰 ЗАБРАЛ!', `+${data.win} VIR`, true);  
            endMinesGame(true, data.mines);  
        }
    } else {  
        if(!validateBet('mines')) return;  
        let bet = parseInt(document.getElementById('mines-bet').value);  
        let count = parseInt(document.getElementById('mines-count').value) || 3;  
        count = Math.max(3, Math.min(7, count));  

        if(bet > balance) return showNotice('Ошибка', 'Недостаточно баланса!', false);  

        let res = await fetch('/api/mines/start', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ initData, bet, minesCount: count })
        });
        let data = await res.json();
        if(!data.success) return showNotice('Ошибка', data.message, false);

        balance = data.balance;
        document.getElementById('user-balance').innerText = balance;
        currentMinesBet = bet; openedCount = 0; minesGameActive = true;  
        activeMults = data.mults;

        renderMinesSteps();  
        resetMinesBoard();  

        document.getElementById('mines-setup-1').style.display = 'none';  
        document.getElementById('mines-setup-2').style.display = 'none';  
        let btn = document.getElementById('mines-action-btn');  
        btn.innerText = '💰 Забрать 0 VIR';  
        btn.style.background = '#eab308';  
    }  
}  

function renderMinesSteps() {  
    let container = document.getElementById('mines-steps');  
    container.innerHTML = '';  
    activeMults.slice(0, 8).forEach((m, idx) => {  
        let badge = document.createElement('div');  
        badge.className = 'step-badge' + (idx < openedCount ? ' active' : '');  
        badge.innerText = `x${m}`;  
        container.appendChild(badge);  
    });  
}  

async function clickMineTile(idx, tile) {  
    if(!minesGameActive || tile.innerText !== '❓') return;  

    let res = await fetch('/api/mines/step', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ initData, step: idx })
    });
    let data = await res.json();

    if(!data.success) return showNotice('Ошибка', data.message, false);

    if(data.exploded) {  
        tile.innerText = '💣'; tile.style.background = 'var(--red)';  
        showNotice('💥 БУМ!', 'Ты подорвался на мине', false);  
        endMinesGame(false, data.mines);  
    } else {  
        tile.innerText = '💎'; tile.style.background = 'var(--green)';  
        openedCount++;  
        renderMinesSteps();  
        document.getElementById('mines-action-btn').innerText = `💰 Забрать ${data.currentWin} VIR (x${data.currentMult})`;  
    }  
}  

function endMinesGame(isWin, mines) {  
    minesGameActive = false;  
    document.getElementById('mines-setup-1').style.display = 'flex';  
    document.getElementById('mines-setup-2').style.display = 'flex';  
    let btn = document.getElementById('mines-action-btn');  
    btn.innerText = 'Начать игру 💣';  
    btn.style.background = 'var(--green)';  

    let tiles = document.getElementById('mines-board').children;  
    if(mines) {
        mines.forEach(p => {  
            if(tiles[p]) { tiles[p].innerText = '💣'; tiles[p].style.background = 'var(--red)'; }  
        });  
    }
}  

/* --- 5. COIN --- */  
async function flipCoin(choice) {  
    if(!validateBet('coin')) return;  
    let bet = parseInt(document.getElementById('coin-bet').value);  
    if(bet > balance) return showNotice('Ошибка', 'Недостаточно баланса!', false);  

    let res = await fetch('/api/play', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ initData, game: 'coin', bet, choice })
    });
    let data = await res.json();
    if(!data.success) return showNotice('Ошибка', data.message, false);

    balance = data.balance;
    document.getElementById('user-balance').innerText = balance;
    document.getElementById('coin-icon').innerText = data.result === 'орёл' ? '🪙' : '👑';  

    if(data.win > 0) {  
        showNotice('🎉 УГАДАЛ!', `+${data.win} VIR (x2)`, true);  
    } else {  
        showNotice('❌ НЕУГАДАЛ', `Выпал ${data.result}`, false);  
    }  
}  

/* --- 6. BONUS --- */  
async function claimBonus() {  
    let res = await fetch('/api/bonus', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ initData })
    });
    let data = await res.json();
    if(data.success) {
        balance = data.balance;
        document.getElementById('user-balance').innerText = balance;
        showNotice('🎁 УСПЕХ!', '+1000 VIR на баланс', true);  
    } else {
        showNotice('⏳ Жди', data.message, false);  
    }
}
