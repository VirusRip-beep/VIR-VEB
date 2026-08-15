// --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ОТПРАВКИ ЗАПРОСОВ ---
async function apiRequest(endpoint, bodyData = {}) {
    const initData = window.Telegram?.WebApp?.initData || '';
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, ...bodyData })
        });
        return await response.json();
    } catch (err) {
        console.error(`Ошибка при вызове ${endpoint}:`, err);
        return { success: false, message: 'Ошибка связи с сервером' };
    }
}

// --- 🎰 СЛОТЫ ---
async function playSlots() {
    const betInput = document.getElementById('slots-bet');
    const bet = parseInt(betInput.value);

    if (isNaN(bet) || bet < 100) {
        alert('Минимальная ставка: 100 VIR');
        return;
    }

    const res = await apiRequest('/api/play', { game: 'slots', bet: bet });
    
    if (!res.success) {
        alert(res.message);
        return;
    }

    const reelsEl = document.getElementById('slots-reels');
    if (res.reels) {
        reelsEl.innerText = res.reels.join(' | ');
    }

    updateBalanceUI(res.balance);

    if (res.win > 0) {
        alert(`🎉 Вы выиграли ${res.win} VIR!`);
    }
}

// --- 🎡 КОЛЕСО ФОРТУНЫ ---
async function playWheel() {
    const betInput = document.getElementById('wheel-bet');
    const bet = parseInt(betInput.value);

    if (isNaN(bet) || bet < 100) {
        alert('Минимальная ставка: 100 VIR');
        return;
    }

    const res = await apiRequest('/api/play', { game: 'wheel', bet: bet });

    if (!res.success) {
        alert(res.message);
        return;
    }

    const wheelEl = document.getElementById('wheel-target');
    wheelEl.style.transition = 'transform 3s cubic-bezier(0.15, 0.9, 0.15, 1)';
    const deg = 360 * 5 + (res.targetAngle * 180 / Math.PI);
    wheelEl.style.transform = `rotate(${deg}deg)`;

    setTimeout(() => {
        updateBalanceUI(res.balance);
        if (res.win > 0) {
            alert(`🎉 Коэффициент x${res.mult}! Выигрыш: ${res.win} VIR!`);
        } else {
            alert('😔 Не повезло, попробуйте еще раз!');
        }
        wheelEl.style.transition = 'none';
        wheelEl.style.transform = 'rotate(0deg)';
    }, 3200);
}

// --- 🪙 МОНЕТКА ---
async function playCoin(choice) {
    const betInput = document.getElementById('coin-bet');
    const bet = parseInt(betInput.value);

    if (isNaN(bet) || bet < 100) {
        alert('Минимальная ставка: 100 VIR');
        return;
    }

    const res = await apiRequest('/api/play', { game: 'coin', bet: bet, choice: choice });

    if (!res.success) {
        alert(res.message);
        return;
    }

    const coinResEl = document.getElementById('coin-res');
    coinResEl.innerText = res.result === 'орёл' ? '🦅 Орёл' : '🪙 Решка';

    updateBalanceUI(res.balance);

    if (res.win > 0) {
        alert(`🎉 Вы угадали (${res.result})! +${res.win} VIR`);
    } else {
        alert(`😔 Выпало: ${res.result}. Увы!`);
    }
}

// --- ⚪ PLINKO (С использованием Matter.js) ---
let plinkoEngine, plinkoRender;

function initPlinko() {
    const container = document.getElementById('plinko-container');
    if (!container || !window.Matter) return;

    container.innerHTML = '';
    const { Engine, Render, Runner, Bodies, Composite } = Matter;

    plinkoEngine = Engine.create();
    plinkoRender = Render.create({
        element: container,
        engine: plinkoEngine,
        options: {
            width: container.clientWidth || 300,
            height: 300,
            wireframes: false,
            background: 'transparent'
        }
    });

    // Пины (пегборд)
    for (let row = 2; row < 7; row++) {
        for (let col = 0; col <= row; col++) {
            const x = (container.clientWidth / 2) + (col - row / 2) * 35;
            const y = row * 35;
            const peg = Bodies.circle(x, y, 4, { isStatic: true, render: { fillStyle: '#fff' } });
            Composite.add(plinkoEngine.world, peg);
        }
    }

    // Пол
    const ground = Bodies.rectangle(container.clientWidth / 2, 305, container.clientWidth, 10, { isStatic: true });
    Composite.add(plinkoEngine.world, ground);

    Render.run(plinkoRender);
    Runner.run(Runner.create(), plinkoEngine);
}

async function playPlinko() {
    const betInput = document.getElementById('plinko-bet');
    const bet = parseInt(betInput.value);

    if (isNaN(bet) || bet < 100) {
        alert('Минимальная ставка: 100 VIR');
        return;
    }

    // Рандомный множитель выигрыша для Plinko
    const mults = [0, 0.5, 1.5, 2, 5];
    const winMult = mults[Math.floor(Math.random() * mults.length)];
    const winAmt = Math.floor(bet * winMult);

    const res = await apiRequest('/api/play', { game: 'plinko', bet: bet, win: winAmt });

    if (!res.success) {
        alert(res.message);
        return;
    }

    // Создание падающего шарика
    if (plinkoEngine) {
        const { Bodies, Composite } = Matter;
        const ball = Bodies.circle(150 + (Math.random() * 20 - 10), 10, 8, {
            restitution: 0.5,
            render: { fillStyle: '#ffb703' }
        });
        Composite.add(plinkoEngine.world, ball);
    }

    setTimeout(() => {
        updateBalanceUI(res.balance);
        if (winAmt > 0) {
            alert(`🎉 Шарик принес x${winMult}! Выигрыш: ${winAmt} VIR!`);
        }
    }, 2000);
}

// Инициализация Plinko при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initPlinko();
});
