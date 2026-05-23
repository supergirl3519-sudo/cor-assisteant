// ===== ЦОР-Ассистент - Основной JavaScript =====

class CORAssistant {
    constructor() {
        this.apiKey = localStorage.getItem('cor_api_key') || '';
        this.model = localStorage.getItem('cor_model') || 'meta-llama/llama-4-maverick:free';
        this.history = JSON.parse(localStorage.getItem('cor_history') || '[]');
        this.currentResult = '';
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateApiStatus();
        this.renderHistory();
        this.renderTemplates();
        this.loadSettings();
    }

    // ===== НАВИГАЦИЯ =====
    bindEvents() {
        // Навигация по разделам
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);

                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Предмет "Другое"
        document.getElementById('subject').addEventListener('change', (e) => {
            const customGroup = document.getElementById('customSubjectGroup');
            customGroup.style.display = e.target.value === 'drugee' ? 'block' : 'none';
        });

        // Кнопки
        document.getElementById('generateBtn').addEventListener('click', () => this.generate());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearForm());
        document.getElementById('copyBtn').addEventListener('click', () => this.copyResult());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadResult());
        document.getElementById('printBtn').addEventListener('click', () => this.printResult());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());

        // Примеры
        document.querySelectorAll('.example-tag').forEach(tag => {
            tag.addEventListener('click', () => this.loadExample(tag.dataset.example));
        });
    }

    switchSection(section) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(section).classList.add('active');

        const titles = {
            generator: 'Создание ЦОР',
            templates: 'Шаблоны',
            history: 'Мои материалы',
            settings: 'Настройки API'
        };
        document.getElementById('pageTitle').textContent = titles[section];
    }

    // ===== ГЕНЕРАЦИЯ ЦОР =====
    async generate() {
        const subject = document.getElementById('subject').value;
        const customSubject = document.getElementById('customSubject').value;
        const grade = document.getElementById('grade').value;
        const corType = document.getElementById('corType').value;
        const topic = document.getElementById('topic').value.trim();
        const requirements = document.getElementById('requirements').value.trim();
        const quantity = document.getElementById('quantity').value;
        const difficulty = document.getElementById('difficulty').value;
        const fgos = document.getElementById('fgosCheck').checked;
        const differentiation = document.getElementById('differentiation').checked;

        // Валидация
        if (!subject || !grade || !corType || !topic) {
            alert('Пожалуйста, заполните все обязательные поля: Предмет, Класс, Тип ЦОР и Тему.');
            return;
        }

        if (!this.apiKey) {
            alert('API ключ не настроен! Перейдите в раздел "Настройки API" и добавьте ключ OpenRouter.');
            this.switchSection('settings');
            document.querySelectorAll('.nav-item').forEach(i => {
                i.classList.toggle('active', i.dataset.section === 'settings');
            });
            return;
        }

        const finalSubject = subject === 'drugee' ? customSubject : this.getSubjectName(subject);
        const prompt = this.buildPrompt(finalSubject, grade, corType, topic, requirements, quantity, difficulty, fgos, differentiation);

        this.showLoading();

        try {
            const response = await this.callAPI(prompt);
            this.displayResult(response, finalSubject, corType, topic);
            this.saveToHistory(finalSubject, grade, corType, topic, response);
        } catch (error) {
            this.displayError(error);
        } finally {
            this.hideLoading();
        }
    }

    buildPrompt(subject, grade, corType, topic, requirements, quantity, difficulty, fgos, differentiation) {
        const typeNames = {
            'konspekt': 'конспект урока',
            'prezentaciya': 'презентация (описание слайдов)',
            'test': 'тест / контрольная работа',
            'samostoyatelnya': 'самостоятельная работа',
            'kartochki': 'карточки-задания',
            'krskross': 'кроссворд с вопросами и ответами',
            'rabochiy-list': 'рабочий лист / лист упражнений',
            'plan-kalendar': 'календарно-тематический план',
            'programma': 'рабочая программа',
            'diktant': 'диктант / проверочная работа',
            'esse': 'тема для эссе / сочинения с планом',
            'proekt': 'проектное задание'
        };

        const difficultyNames = {
            'base': 'базовый',
            'average': 'средний',
            'advanced': 'продвинутый',
            'mixed': 'смешанный (базовые + продвинутые задания)'
        };

        let prompt = `Ты — опытный методист и учитель с 20-летним стажем. Создай качественный цифровой образовательный ресурс (ЦОР) для российской школы.

**Параметры:**
- Предмет: ${subject}
- Класс: ${grade}
- Тип ЦОР: ${typeNames[corType] || corType}
- Тема: ${topic}
- Количество элементов: ${quantity}
- Уровень сложности: ${difficultyNames[difficulty]}
${fgos ? '- Должно соответствовать ФГОС' : ''}
${differentiation ? '- Нужна дифференциация: задания для слабых, средних и сильных учеников' : ''}
${requirements ? '- Дополнительные требования: ' + requirements : ''}

**Требования к оформлению:**
1. Используй чёткую структуру с заголовками
2. Для тестов: указывай правильные ответы и пояснения
3. Для конспектов: включай цели, этапы, методы, оценивание
4. Для презентаций: описывай каждый слайд (заголовок, содержание, визуал)
5. Для кроссвордов: давай сетку и список вопросов с ответами
6. Используй образовательную терминологию
7. Формат: Markdown с таблицами, списками, выделением
8. Язык: русский, профессиональный педагогический стиль

Создай полноценный материал, который учитель может сразу использовать на уроке.`;

        return prompt;
    }

    getSubjectName(value) {
        const subjects = {
            'matematika': 'Математика',
            'russkiy': 'Русский язык',
            'literatura': 'Литература',
            'istoriya': 'История',
            'obshchestvoznanie': 'Обществознание',
            'geografiya': 'География',
            'biologiya': 'Биология',
            'fizika': 'Физика',
            'himiya': 'Химия',
            'informatika': 'Информатика',
            'angliyskiy': 'Английский язык',
            'fizkultura': 'Физкультура',
            'tekhnologiya': 'Технология',
            'izo': 'ИЗО',
            'muzyka': 'Музыка'
        };
        return subjects[value] || value;
    }

    async callAPI(prompt) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'ЦОР-Ассистент'
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: 'Ты — профессиональный методист и помощник учителя. Создаёшь качественные цифровые образовательные ресурсы (ЦОР) для школы. Отвечаешь только на русском языке, используя педагогическую терминологию.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Ошибка API: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // ===== ОТОБРАЖЕНИЕ РЕЗУЛЬТАТА =====
    displayResult(content, subject, type, topic) {
        this.currentResult = content;
        const preview = document.getElementById('previewContent');

        // Простой Markdown-парсер
        const html = this.markdownToHTML(content);

        preview.innerHTML = `
            <div class="result-content">
                <div style="margin-bottom: 20px; padding: 12px 16px; background: var(--primary-light); border-radius: var(--radius-sm); border-left: 3px solid var(--primary);">
                    <strong style="color: var(--primary);">✅ ${subject} — ${topic}</strong>
                    <span style="color: var(--text-light); font-size: 12px; margin-left: 8px;">Сгенерировано ИИ</span>
                </div>
                ${html}
            </div>
        `;

        document.getElementById('copyBtn').disabled = false;
        document.getElementById('downloadBtn').disabled = false;
        document.getElementById('printBtn').disabled = false;
    }

    markdownToHTML(md) {
        return md
            // Заголовки
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Жирный
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            // Курсив
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            // Код
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Блоки кода
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Списки
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
            // Таблицы (простые)
            .replace(/\|(.+)\|/g, (match, p1) => {
                const cells = p1.split('|').map(c => `<td>${c.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            })
            // Цитаты
            .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
            // Абзацы
            .replace(/

/g, '</p><p>')
            .replace(/^(.+)$/gim, (match) => {
                if (match.match(/^<\/?(h|li|tr|td|blockquote|pre)/)) return match;
                return `<p>${match}</p>`;
            });
    }

    displayError(error) {
        const preview = document.getElementById('previewContent');
        preview.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <h3>Ошибка генерации</h3>
                <p style="color: var(--danger);">${error.message}</p>
                <p style="font-size: 13px; margin-top: 12px;">
                    Возможные причины:<br>
                    • Неверный API ключ<br>
                    • Исчерпан лимит запросов (попробуйте другую модель)<br>
                    • Проблемы с сетью<br>
                    • Модель временно недоступна
                </p>
                <button class="btn btn-primary" style="margin-top: 16px;" onclick="location.reload()">🔄 Попробовать снова</button>
            </div>
        `;
    }

    // ===== ЗАГРУЗКА / ПРИМЕРЫ =====
    showLoading() {
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('previewContent').style.display = 'none';
        document.getElementById('generateBtn').disabled = true;

        const steps = [
            'Анализирую параметры...',
            'Формирую структуру материала...',
            'Генерирую содержание...',
            'Проверяю соответствие ФГОС...',
            'Финальная обработка...'
        ];

        let step = 0;
        this.loadingInterval = setInterval(() => {
            document.getElementById('loadingStep').textContent = steps[step % steps.length];
            step++;
        }, 2000);
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('previewContent').style.display = 'block';
        document.getElementById('generateBtn').disabled = false;
        clearInterval(this.loadingInterval);
    }

    loadExample(type) {
        const examples = {
            matematika: {
                subject: 'matematika',
                grade: '9',
                corType: 'test',
                topic: 'Квадратные уравнения',
                requirements: 'Формат ЕГЭ, 10 вопросов с ответами',
                quantity: '10',
                difficulty: 'mixed'
            },
            russkiy: {
                subject: 'russkiy',
                grade: '5',
                corType: 'diktant',
                topic: 'Правописание безударных гласных',
                requirements: '15 слов, с пояснениями правил',
                quantity: '15',
                difficulty: 'average'
            },
            istoriya: {
                subject: 'istoriya',
                grade: '7',
                corType: 'konspekt',
                topic: 'Крещение Руси',
                requirements: 'Урок 45 минут, интерактивные элементы',
                quantity: '5',
                difficulty: 'average'
            }
        };

        const ex = examples[type];
        if (ex) {
            document.getElementById('subject').value = ex.subject;
            document.getElementById('grade').value = ex.grade;
            document.getElementById('corType').value = ex.corType;
            document.getElementById('topic').value = ex.topic;
            document.getElementById('requirements').value = ex.requirements;
            document.getElementById('quantity').value = ex.quantity;
            document.getElementById('difficulty').value = ex.difficulty;
            document.getElementById('customSubjectGroup').style.display = 'none';
        }
    }

    clearForm() {
        document.getElementById('subject').value = '';
        document.getElementById('customSubject').value = '';
        document.getElementById('grade').value = '';
        document.getElementById('corType').value = '';
        document.getElementById('topic').value = '';
        document.getElementById('requirements').value = '';
        document.getElementById('quantity').value = '10';
        document.getElementById('difficulty').value = 'average';
        document.getElementById('fgosCheck').checked = true;
        document.getElementById('differentiation').checked = false;
        document.getElementById('customSubjectGroup').style.display = 'none';

        document.getElementById('previewContent').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>Готовы создать ЦОР?</h3>
                <p>Заполните форму слева и нажмите «Сгенерировать».<br>ИИ создаст качественный образовательный материал.</p>
            </div>
        `;

        document.getElementById('copyBtn').disabled = true;
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('printBtn').disabled = true;
    }

    // ===== ДЕЙСТВИЯ С РЕЗУЛЬТАТОМ =====
    copyResult() {
        navigator.clipboard.writeText(this.currentResult).then(() => {
            const btn = document.getElementById('copyBtn');
            const original = btn.textContent;
            btn.textContent = '✅ Скопировано!';
            setTimeout(() => btn.textContent = original, 2000);
        });
    }

    downloadResult() {
        const subject = document.getElementById('subject');
        const topic = document.getElementById('topic').value;
        const type = document.getElementById('corType').value;

        const blob = new Blob([this.currentResult], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ЦОР_${this.getSubjectName(subject.value)}_${topic}_${type}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    printResult() {
        window.print();
    }

    // ===== ИСТОРИЯ =====
    saveToHistory(subject, grade, type, topic, content) {
        const item = {
            id: Date.now(),
            subject,
            grade,
            type,
            topic,
            content,
            date: new Date().toLocaleString('ru-RU')
        };

        this.history.unshift(item);
        if (this.history.length > 50) this.history.pop();

        localStorage.setItem('cor_history', JSON.stringify(this.history));
        this.renderHistory();
    }

    renderHistory() {
        const container = document.getElementById('historyList');

        if (this.history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <h3>История пуста</h3>
                    <p>Созданные материалы будут сохраняться здесь автоматически.</p>
                </div>
            `;
            return;
        }

        const typeIcons = {
            'konspekt': '📋',
            'prezentaciya': '📊',
            'test': '📝',
            'samostoyatelnya': '✏️',
            'kartochki': '🃏',
            'krskross': '🔠',
            'rabochiy-list': '📄',
            'plan-kalendar': '📅',
            'programma': '📑',
            'diktant': '✍️',
            'esse': '📖',
            'proekt': '🔬'
        };

        container.innerHTML = this.history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-icon">${typeIcons[item.type] || '📄'}</div>
                <div class="history-info">
                    <h4>${item.subject}, ${item.grade} класс — ${item.topic}</h4>
                    <p>${this.getTypeName(item.type)} • ${item.date}</p>
                </div>
                <div class="history-actions">
                    <button class="history-btn" title="Просмотреть" onclick="app.viewHistoryItem(${item.id})">👁️</button>
                    <button class="history-btn" title="Скачать" onclick="app.downloadHistoryItem(${item.id})">💾</button>
                    <button class="history-btn" title="Удалить" onclick="app.deleteHistoryItem(${item.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    viewHistoryItem(id) {
        const item = this.history.find(h => h.id === id);
        if (!item) return;

        this.currentResult = item.content;
        this.displayResult(item.content, item.subject, item.type, item.topic);
        this.switchSection('generator');
        document.querySelectorAll('.nav-item').forEach(i => {
            i.classList.toggle('active', i.dataset.section === 'generator');
        });
    }

    downloadHistoryItem(id) {
        const item = this.history.find(h => h.id === id);
        if (!item) return;

        const blob = new Blob([item.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ЦОР_${item.subject}_${item.topic}_${item.type}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    deleteHistoryItem(id) {
        if (!confirm('Удалить этот материал из истории?')) return;
        this.history = this.history.filter(h => h.id !== id);
        localStorage.setItem('cor_history', JSON.stringify(this.history));
        this.renderHistory();
    }

    clearHistory() {
        if (!confirm('Очистить всю историю? Это действие нельзя отменить.')) return;
        this.history = [];
        localStorage.removeItem('cor_history');
        this.renderHistory();
    }

    getTypeName(type) {
        const names = {
            'konspekt': 'Конспект',
            'prezentaciya': 'Презентация',
            'test': 'Тест',
            'samostoyatelnya': 'Самостоятельная',
            'kartochki': 'Карточки',
            'krskross': 'Кроссворд',
            'rabochiy-list': 'Рабочий лист',
            'plan-kalendar': 'Календарный план',
            'programma': 'Программа',
            'diktant': 'Диктант',
            'esse': 'Эссе',
            'proekt': 'Проект'
        };
        return names[type] || type;
    }

    // ===== ШАБЛОНЫ =====
    renderTemplates() {
        const templates = [
            { icon: '📋', title: 'Конспект урока', desc: 'Полный план урока с целями, этапами и методами', tags: ['ФГОС', 'Любой предмет'] },
            { icon: '📝', title: 'Тест с ответами', desc: 'Контрольная работа с ключом и пояснениями', tags: ['ЕГЭ/ОГЭ', 'Автопроверка'] },
            { icon: '📊', title: 'Презентация', desc: 'Описание слайдов с содержанием и визуалом', tags: ['PowerPoint', 'Google Slides'] },
            { icon: '✏️', title: 'Самостоятельная', desc: 'Задания для самостоятельной работы на уроке', tags: ['15-20 мин', 'Разный уровень'] },
            { icon: '🃏', title: 'Карточки-задания', desc: 'Индивидуальные карточки для работы в парах', tags: ['Интерактив', 'Группы'] },
            { icon: '🔠', title: 'Кроссворд', desc: 'Образовательный кроссворд с вопросами и ответами', tags: ['Игра', 'Повторение'] },
            { icon: '📄', title: 'Рабочий лист', desc: 'Лист с упражнениями для печати', tags: ['Печать', 'Практика'] },
            { icon: '📅', title: 'Календарный план', desc: 'Тематическое планирование на четверть/год', tags: ['Планирование', 'ФГОС'] },
            { icon: '📑', title: 'Рабочая программа', desc: 'Программа по предмету с пояснительной запиской', tags: ['Администрация', 'Отчёт'] },
            { icon: '✍️', title: 'Диктант / Проверочная', desc: 'Текст диктанта с грамматическим заданием', tags: ['Русский язык', 'Проверка'] },
            { icon: '📖', title: 'Эссе / Сочинение', desc: 'Тема с планом и критериями оценивания', tags: ['Литература', 'История'] },
            { icon: '🔬', title: 'Проектное задание', desc: 'Тема проекта с этапами и критериями', tags: ['Исследование', 'Практика'] }
        ];

        const grid = document.getElementById('templatesGrid');
        grid.innerHTML = templates.map(t => `
            <div class="template-card" onclick="app.loadTemplate('${t.title}')">
                <div class="template-icon">${t.icon}</div>
                <h4>${t.title}</h4>
                <p>${t.desc}</p>
                <div class="template-meta">
                    ${t.tags.map(tag => `<span class="template-tag">${tag}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    loadTemplate(title) {
        const typeMap = {
            'Конспект урока': 'konspekt',
            'Тест с ответами': 'test',
            'Презентация': 'prezentaciya',
            'Самостоятельная': 'samostoyatelnya',
            'Карточки-задания': 'kartochki',
            'Кроссворд': 'krskross',
            'Рабочий лист': 'rabochiy-list',
            'Календарный план': 'plan-kalendar',
            'Рабочая программа': 'programma',
            'Диктант / Проверочная': 'diktant',
            'Эссе / Сочинение': 'esse',
            'Проектное задание': 'proekt'
        };

        document.getElementById('corType').value = typeMap[title] || '';
        this.switchSection('generator');
        document.querySelectorAll('.nav-item').forEach(i => {
            i.classList.toggle('active', i.dataset.section === 'generator');
        });
    }

    // ===== НАСТРОЙКИ =====
    loadSettings() {
        document.getElementById('apiKey').value = this.apiKey;
        document.getElementById('modelSelect').value = this.model;
    }

    saveSettings() {
        const key = document.getElementById('apiKey').value.trim();
        const model = document.getElementById('modelSelect').value;
        const saveKey = document.getElementById('saveApiKey').checked;

        if (!key) {
            alert('Введите API ключ');
            return;
        }

        this.apiKey = key;
        this.model = model;

        if (saveKey) {
            localStorage.setItem('cor_api_key', key);
            localStorage.setItem('cor_model', model);
        } else {
            localStorage.removeItem('cor_api_key');
            localStorage.removeItem('cor_model');
        }

        this.updateApiStatus();
        alert('✅ Настройки сохранены! Теперь можно генерировать ЦОР.');
    }

    updateApiStatus() {
        const status = document.getElementById('apiStatus');
        if (this.apiKey) {
            status.classList.add('connected');
            status.querySelector('.status-text').textContent = 'API подключен';
        } else {
            status.classList.remove('connected');
            status.querySelector('.status-text').textContent = 'API не подключен';
        }
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
const app = new CORAssistant();
