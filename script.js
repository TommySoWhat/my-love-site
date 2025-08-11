// === Sync config (ДОДАТИ НА ПОЧАТОК script.js) ===
const SYNC_URL = 'https://script.google.com/macros/s/AKfycbyGbdkATD_X0fNghHhMLEPrMoGAoc3tpvo1RE9jJ5V1fzhZRCAFicfiOOmJiLIFSoi9/exec'; // ← твій URL з деплою
const SYNC_SECRET = 'my-love-2025';                                // ← той самий SECRET
const ROOM_ID = 'our-room-001';                                       // можете змінити
const DEVICE_ID = (() => {
    const k = 'device_id';
    let id = localStorage.getItem(k);
    if (!id) { id = 'dev-' + Math.random().toString(36).slice(2,9); localStorage.setItem(k, id); }
    return id;
})();
async function syncPost(updates){
    try{
        await fetch(SYNC_URL, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ roomId: ROOM_ID, updates, deviceId: DEVICE_ID, secret: SYNC_SECRET })
        });
    }catch(e){ /* офлайн — ок */ }
}
async function syncPull(){
    try{
        const res = await fetch(
            `${SYNC_URL}?roomId=${encodeURIComponent(ROOM_ID)}&secret=${encodeURIComponent(SYNC_SECRET)}`
        );

        const j = await res.json();
        return j?.state || {};
    }catch(e){ return {}; }
}
// ---------- Відправка у Google Form ----------
function sendToGoogleForm(data) {
    const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdd3H8XgUyi9KHpxDn57bLMDxdbgEqTpMOZBrfds_L3KRx5Rg/formResponse";
    const formData = new FormData();

    // Твої entry.* (з pre-filled link)
    if (data.moment_id !== undefined)      formData.append("entry.1704869847", data.moment_id);
    if (data.note_text !== undefined)      formData.append("entry.590568909", data.note_text);
    if (data.liked !== undefined)          formData.append("entry.992399076", data.liked);
    if (data.idea_selected !== undefined)  formData.append("entry.789712950", data.idea_selected);

    // no-cors: відповідь не читаємо, але дані прилетять у Sheets
    fetch(formUrl, { method: "POST", mode: "no-cors", body: formData });
}

// ---------- Плаваючі елементи на фоні ----------
const bg = document.getElementById('bg-hearts');
if (bg){
    const is18 = document.body.classList.contains('page-18');

    const spawnMark = () => {
        const el = document.createElement('div');
        el.className = 'heart';
        el.textContent = is18 ? '🔞' : (Math.random() < 0.85 ? '❤️' : '💖');
        const size = 16 + Math.random()*18;
        el.style.left = `${Math.random()*100}%`;
        el.style.bottom = `${Math.random()*10}px`;
        el.style.fontSize = `${size}px`;
        el.style.animationDuration = `${6.5 + Math.random()*2.5}s`;
        bg.appendChild(el);
        setTimeout(()=> el.remove(), 10000);
    };

    // “кожен клік — сердечко/знак”
    document.addEventListener('click', (e)=>{
        const el = document.createElement('div');
        el.className = 'heart';
        el.textContent = is18 ? '🔞' : '❤️';
        el.style.left = `${e.clientX}px`;
        el.style.top = `${e.clientY}px`;
        el.style.position = 'fixed';
        el.style.animationDuration = `6.5s`;
        document.body.appendChild(el);
        setTimeout(()=> el.remove(), 9000);
    });

    setInterval(spawnMark, 900);
}

// ---------- Утиліти ----------
const qs = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const storageKey = (type, id) => `${type}_${id}`;

// Невеликий дебаунс, щоб не спамити форму під час набору нотатки
function debounce(fn, ms=600){
    let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

// ---------- Галерея: лайки + нотатки (localStorage + відправка) ----------
qsa('.card').forEach(card=>{
    const id = card.dataset.id;
    const likeBtn = qs('.like', card);
    const noteEl = qs('.note', card);

    // init from storage
    if (localStorage.getItem(storageKey('like', id)) === '1'){
        likeBtn.classList.add('liked'); likeBtn.textContent = '💗';
    }
    const savedNote = localStorage.getItem(storageKey('note', id));
    if (savedNote){ noteEl.value = savedNote; }

    likeBtn?.addEventListener('click', ()=>{
        const liked = likeBtn.classList.toggle('liked');
        likeBtn.textContent = liked ? '💗' : '🤍';
        localStorage.setItem(storageKey('like', id), liked ? '1' : '0');
        syncPost([{ key: `like_${id}`, value: liked ? '1' : '0' }]);
        // ► Відправити лайк у форму
        sendToGoogleForm({ moment_id: id, liked: liked ? 'yes' : 'no' });
    });

    const sendNote = debounce((val)=>{
        localStorage.setItem(storageKey('note', id), val.trim());
        syncPost([{ key: `note_${id}`, value: val.trim() }]);
        // ► Відправити нотатку у форму
        sendToGoogleForm({ moment_id: id, note_text: val.trim() });
    }, 700);

    noteEl?.addEventListener('input', ()=>{
        const v = noteEl.value.slice(0,64); // страховка по ліміту
        if (noteEl.value !== v) noteEl.value = v;
        sendNote(v);
    });
});

// ---------- Ідеї побачень ----------
const defaultIdeas = [
    "Вечеря при свічках вдома з твоєю улюбленою стравою.",
    "Кіно/серіал-марафон з обіймами.",
    "Вечір настільних ігор + закуски.",
    "Прогулянка вночі містом з гарячим шоколадом.",
    "Ранковий сніданок у ліжко.",
    "День без телефону — тільки ми.",
    "Маленька спільна фотосесія.",
    "Приготування нової страви разом.",
    "Спа-вечір удвох (масаж, ванна, ароматні свічки).",
    "Похід у нове кафе чи ресторан, куди ще не ходили."
];

const IDEAS_KEY = 'ideas_list';
const SELECTED_KEY = 'idea_selected_index';

function loadIdeas(){
    const json = localStorage.getItem(IDEAS_KEY);
    return json ? JSON.parse(json) : defaultIdeas.slice();
}
function saveIdeas(list){
    localStorage.setItem(IDEAS_KEY, JSON.stringify(list));
}

const ideas = loadIdeas();
let idx = Math.min(parseInt(localStorage.getItem(SELECTED_KEY)||'0',10), Math.max(ideas.length-1,0));

const ideasUl = document.getElementById('ideasUl');
const ideaText = document.getElementById('ideaText');
const ideaIndex = document.getElementById('ideaIndex');
const prevBtn = document.getElementById('prevIdea');
const nextBtn = document.getElementById('nextIdea');
const chooseBtn = document.getElementById('chooseIdea');
const toast = document.getElementById('toast');
const addIdeaBtn = document.getElementById('addIdea');
const newIdeaInput = document.getElementById('newIdea');

function renderList(){
    if (!ideasUl) return;
    ideasUl.innerHTML = '';
    ideas.forEach((text, i)=>{
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.className = 'li-text';
        span.textContent = text;

        const actions = document.createElement('div');
        actions.className = 'li-actions';

        const showBtn = document.createElement('button');
        showBtn.className = 'show';
        showBtn.textContent = 'Показати';
        showBtn.addEventListener('click', ()=>{ idx = i; renderSlider(); });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', ()=>{
            ideas.splice(i,1);
            saveIdeas(ideas);
            if (idx >= ideas.length) idx = Math.max(ideas.length-1, 0);
            renderList(); renderSlider();
            toastMsg('Ідею прибрано');
        });

        actions.appendChild(showBtn);
        actions.appendChild(removeBtn);
        li.appendChild(span);
        li.appendChild(actions);
        ideasUl.appendChild(li);
    });
}

function renderSlider(){
    if (!ideaText || !ideaIndex) return;
    ideaText.textContent = ideas.length ? ideas[idx] : 'Немає ідей — додай свою 🙂';
    ideaIndex.textContent = `${ideas.length ? (idx+1) : 0} / ${ideas.length}`;
    localStorage.setItem(SELECTED_KEY, String(idx));
}
function toastMsg(msg){
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> toast.classList.remove('show'), 1400);
}

prevBtn && prevBtn.addEventListener('click', ()=>{
    if (!ideas.length) return;
    idx = (idx - 1 + ideas.length) % ideas.length;
    renderSlider();
});
nextBtn && nextBtn.addEventListener('click', ()=>{
    if (!ideas.length) return;
    idx = (idx + 1) % ideas.length;
    renderSlider();
});
chooseBtn && chooseBtn.addEventListener('click', ()=>{
    if (!ideas.length) return;
    const chosen = ideas[idx];
    toastMsg(`Обрано: ${chosen}`);
    localStorage.setItem('idea_selected_text', chosen); // ← ДОДАНО
    syncPost([{ key: 'idea_selected_text', value: chosen }]); // ← ДОДАНО
    // ► Відправити обрану ідею у форму
    sendToGoogleForm({ idea_selected: chosen });
});

addIdeaBtn && addIdeaBtn.addEventListener('click', ()=>{
    const val = (newIdeaInput.value || '').trim();
    if (!val) return;
    ideas.push(val);
    saveIdeas(ideas);
    newIdeaInput.value = '';
    renderList();
    idx = ideas.length - 1;
    renderSlider();
    toastMsg('Додано нову ідею');
});
// =============== Changelog Drawer ===============
const fab = document.getElementById('changelogFab');
const drawer = document.getElementById('changelogDrawer');
const overlay = document.getElementById('changelogOverlay');
const closeBtn = document.getElementById('changelogClose');
const list = document.getElementById('changelogList');

// Мінімальний реєстр змін (можеш вести руками або зберігати в localStorage)
const CHANGELOG = [
    { date: '2025-08-11', title: 'Додано іконку «Що нового»', desc: 'Бічна шторка з історією змін, керування мишею та клавішею Esc.' },
    { date: '2025-08-10', title: 'Оптимізовано зображення', desc: 'Переведено фото у modern формати та ввімкнено lazy-loading.' },
    { date: '2025-08-05', title: 'Секція «Ідеї побачень»', desc: 'Слайдер + список, збереження в localStorage, відправка у форму.' }
];

function renderChangelog(items){
    if (!list) return;
    list.innerHTML = '';
    items.forEach(it=>{
        const li = document.createElement('li');
        li.innerHTML = `
      <time datetime="${it.date}">${new Date(it.date).toLocaleDateString('uk-UA')}</time>
      <div class="title">${it.title}</div>
      ${it.desc ? `<div class="desc">${it.desc}</div>` : ''}
    `;
        list.appendChild(li);
    });
}
renderChangelog(CHANGELOG);

function openDrawer(){
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
    overlay?.removeAttribute('hidden');
    fab?.setAttribute('aria-expanded','true');
}
function closeDrawer(){
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    overlay?.setAttribute('hidden','');
    fab?.setAttribute('aria-expanded','false');
}

fab?.addEventListener('click', openDrawer);
closeBtn?.addEventListener('click', closeDrawer);
overlay?.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') closeDrawer();
});

// Перший рендер
renderList(); renderSlider();

// === Пул стану з «хмари» і мердж у localStorage (ДОДАТИ ПІСЛЯ ПЕРШОГО РЕНДЕРА) ===
(async ()=>{
    const state = await syncPull();
    // Очікувані ключі: note_m1, like_m1, ..., idea_selected_text
    Object.entries(state).forEach(([k,v])=>{
        if (k.startsWith('note_')) localStorage.setItem(k, String(v || ''));
        if (k.startsWith('like_')) localStorage.setItem(k, String(v || '0'));
        if (k === 'idea_selected_text') localStorage.setItem('idea_selected_text', String(v || ''));
    });
    // Перемалювати картки після мерджу
    qsa('.card').forEach(card=>{
        const id = card.dataset.id;
        const likeBtn = qs('.like', card);
        const noteEl  = qs('.note', card);
        if (localStorage.getItem(storageKey('like', id)) === '1'){
            likeBtn.classList.add('liked'); likeBtn.textContent = '💗';
        } else {
            likeBtn.classList.remove('liked'); likeBtn.textContent = '🤍';
        }
        const savedNote = localStorage.getItem(storageKey('note', id));
        if (savedNote != null) noteEl.value = savedNote;
    });
})();

