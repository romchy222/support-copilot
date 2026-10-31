import {intentPatterns,insufficientComplaint,offTopic,uzbekHint} from './features.mjs';
import { prepareInput, InputError } from './input.mjs';
export { InputError } from './input.mjs';
const mapping = { 'ќ': 'қ', 'ґ': 'ғ', 'ѕ': 'ң', 'є': 'ә', 'ј': 'ө', 'ў': 'ұ', 'ї': 'ү' };
export const normalize = s => s.normalize('NFKC').toLowerCase().replace(/[ќґѕєјўї]/g, c => mapping[c]).replace(/[‘’ʻʼ`]/g, "'");
export const knowledge = [{ ref: '2.1', section: 'Общие правила игры', title: 'Оскорбления игроков и родственников', terms: ['оскорб', 'insult', 'haqorat', 'балағат'], text: 'Запрещено прямое, завуалированное и провокационное оскорбление личности игрока и его родственников, а также любые упоминания их в негативном ключе в любом из чатов.' }];
export const titles = { 'complaint.insult': 'Оскорбления и токсичность', 'complaint.cheat': 'Читы и стороннее ПО', 'complaint.dm': 'Убийство и нарушение РП', 'complaint.scam': 'Обман и мошенничество', 'complaint.rmt_ads': 'Реклама и RMT', 'complaint.admin': 'Жалоба на администратора', 'complaint.other': 'Другое нарушение', 'complaint.invalid': 'Недостаточно информации', 'report.question': 'Вопрос по механике игры', 'report.help': 'Помощь с игровой проблемой', 'report.complaint': 'Жалоба на игрока', 'report.account': 'Доступ и имущество аккаунта', 'report.payment': 'Платёж и донат', 'report.offtopic': 'Оффтоп и пустые сообщения' };
export function detectLang(s) { if(uzbekHint(s))return 'uz'; if (/[әғқңөұүһі]/.test(s) || /сәлем|көмек|аккаунтыма/.test(s))
    return 'kk'; if (/\b(salom|men|menga|iltimos|qanday|akkaunt|pul|haqorat|yordam|parol)\b|to'lov|o'yin/.test(s))
    return 'uz'; if (/[а-яё]/.test(s))
    return 'ru'; if (/\b(hola|gracias|cuenta|ayuda|pago)\b/.test(s))
    return 'es'; if (/(?<!\p{L})(olá|ola|obrigado|conta|ajuda|pagamento)(?!\p{L})/u.test(s))
    return 'pt'; if (/\b(hello|help|account|payment|stuck|please|insult|how|banned)\b/.test(s))
    return 'en'; return 'und'; }
const patterns=intentPatterns;
export const texts = {
    ru: { hello: 'Здравствуйте!', review: 'Необходимо уточнить обстоятельства и проверить обращение администратором. Описанные события пока не подтверждены.', clarify: 'Опишите, пожалуйста, проблему, укажите сервер и время события.', payment: 'Платёж должен проверить специалист поддержки. Подготовьте дату покупки и чек. Не передавайте пароль и полные данные банковской карты. Возврат или зачисление заранее не гарантируются.', account: 'Проблему доступа или имущества аккаунта должен проверить специалист поддержки. Не передавайте пароль и коды подтверждения. Восстановление заранее не гарантируется.', appeal: 'Апелляцию должен рассмотреть администратор. Укажите сервер, время и причину наказания. Снятие блокировки заранее не гарантируется.', insult: 'Пункт 2.1 общих правил запрещает оскорбления игроков и их родственников.', missing: 'В подключённой базе пока нет проверенной инструкции по этому вопросу.' },
    kk: { hello: 'Сәлеметсіз бе!', review: 'Мән-жайды нақтылап, өтінішті әкімші тексеруі керек. Сипатталған оқиғалар әлі расталған жоқ.', clarify: 'Мәселені сипаттап, серверді және оқиға уақытын көрсетіңіз.', payment: 'Төлемді қолдау маманы тексеруі керек. Сатып алу күні мен түбіртекті дайындаңыз. Құпиясөз бен банк картасының толық деректерін жібермеңіз. Қаражаттың қайтарылуына алдын ала кепілдік берілмейді.', account: 'Аккаунтқа кіру немесе мүлік мәселесін қолдау маманы тексеруі керек. Құпиясөз бен растау кодтарын бермеңіз. Қалпына келтіруге алдын ала кепілдік берілмейді.', appeal: 'Бұғаттауға қатысты шағымды әкімші қарауы керек. Серверді, жаза уақытын және себебін көрсетіңіз. Бұғаттаудың алынуына алдын ала кепілдік берілмейді.', insult: 'Жалпы ережелердің 2.1-тармағы ойыншыларды және олардың туыстарын қорлауға тыйым салады.', missing: 'Қосылған білім қорында бұл сұраққа тексерілген нұсқаулық жоқ.' },
    uz: { hello: 'Salom!', review: 'Vaziyatni aniqlashtirish va administrator tekshiruvi kerak. Tasvirlangan voqealar hali tasdiqlanmagan.', clarify: 'Muammoni tasvirlang, server va voqea vaqtini yozing.', payment: 'To‘lovni qo‘llab-quvvatlash mutaxassisi tekshirishi kerak. Xarid sanasi va chekni tayyorlang. Parol yoki bank kartasining to‘liq ma’lumotlarini yubormang. Qaytarish oldindan kafolatlanmaydi.', account: 'Akkauntga kirish yoki mulk masalasini mutaxassis tekshirishi kerak. Parol va tasdiqlash kodlarini bermang. Tiklash oldindan kafolatlanmaydi.', appeal: 'Bloklash bo‘yicha murojaatni administrator ko‘rib chiqishi kerak. Server, jazo vaqti va sababini yozing. Blok olib tashlanishi oldindan kafolatlanmaydi.', insult: 'Umumiy qoidalarning 2.1-bandi o‘yinchilar va ularning qarindoshlarini haqorat qilishni taqiqlaydi.', missing: 'Ulangan bilim bazasida bu savol bo‘yicha tekshirilgan yo‘riqnoma yo‘q.' },
    en: { hello: 'Hello!', review: 'An administrator needs to clarify and review the request. The reported events have not been verified.', clarify: 'Please describe the issue and include the server and time.', payment: 'A support specialist must review the payment. Prepare the purchase date and receipt. Do not share passwords or full bank card details. A refund or credit cannot be guaranteed in advance.', account: 'A support specialist must review account access or property issues. Do not share passwords or verification codes. Recovery cannot be guaranteed.', appeal: 'An administrator must review the appeal. Include the server, penalty time and reason. A ban reversal cannot be guaranteed.', insult: 'Section 2.1 of the general rules prohibits insulting players and their relatives.', missing: 'The connected knowledge base does not contain a verified instruction for this question.' },
    es: { hello: '¡Hola!', review: 'Un administrador debe revisar la solicitud. Los hechos descritos no están verificados.', clarify: 'Indica qué ocurrió, en qué servidor y cuándo.', payment: 'Un especialista debe revisar el pago. Prepara el recibo y la fecha. No compartas contraseñas ni datos completos de tu tarjeta. No se garantiza un reembolso.', account: 'Un especialista debe revisar el acceso o los bienes de la cuenta. No compartas contraseñas ni códigos. No se garantiza la recuperación.', appeal: 'Un administrador debe revisar la apelación. Indica el servidor y la sanción. No se garantiza retirar el bloqueo.', insult: 'El apartado 2.1 de las reglas generales prohíbe insultar a jugadores y familiares.', missing: 'La base conectada aún no contiene una instrucción verificada para esta consulta.' },
    pt: { hello: 'Olá!', review: 'Um administrador precisa analisar a solicitação. Os fatos ainda não foram verificados.', clarify: 'Informe o que aconteceu, em qual servidor e quando.', payment: 'Um especialista precisa verificar o pagamento. Prepare a data e o comprovante. Não compartilhe senhas nem dados completos do cartão. O reembolso não é garantido.', account: 'Um especialista precisa verificar o acesso ou os bens da conta. Não compartilhe senhas nem códigos. A recuperação não é garantida.', appeal: 'Um administrador precisa analisar o recurso. Informe o servidor e a punição. A retirada do bloqueio não é garantida.', insult: 'O item 2.1 das regras gerais proíbe insultos a jogadores e seus familiares.', missing: 'A base conectada ainda não contém uma instrução verificada para esta pergunta.' }
};
export function triage(input) {
    input = prepareInput(input);
    if (!input || !['complaint', 'report'].includes(input.kind))
        throw new InputError('kind должен быть complaint или report');
    if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length > 50)
        throw new InputError('Нужно от 1 до 50 сообщений');
    let size = 0;
    for (const m of input.messages) {
        if (!m || !['player', 'reported_player', 'admin'].includes(m.role) || typeof m.text !== 'string')
            throw new InputError('Укажите допустимые role и text');
        size += m.text.length;
        if (m.attachments !== undefined && (!Number.isInteger(m.attachments) || m.attachments < 0 || m.attachments > 100))
            throw new InputError('attachments: целое число от 0 до 100');
    }
    if (size > 20000)
        throw new InputError('Максимум 20 000 символов');
    // Admin answers and outcome labels are deliberately ignored.
    const messages = input.messages.filter(m => m.role === 'player');
    const raw = messages.map(m => m.text).join('\n');
    if (!raw.trim())
        throw new InputError('Нужно непустое сообщение игрока');
    const s = normalize(raw);
    const has = k => patterns[k].test(s) || (k === 'dm' && /(^|\s)\u0434\u043c(\s|$)/u.test(s));
    const lang = detectLang(s), t = texts[lang] || texts.ru, complaint = input.kind === 'complaint';
    const attachments = messages.reduce((n, m) => n + (m.attachments || 0), 0);
    const vague = (s.trim().length < 12 || /^(помогите|привет|help|salom)[ !,.]*$/.test(s)) && !Object.keys(patterns).some(k => has(k));
    let category = complaint ? 'complaint.other' : 'report.question', topic = 'clarify';
    if (has('payment')) {
        category = complaint ? 'complaint.other' : 'report.payment';
        topic = 'payment';
    }
    else if (has('appeal')) {
        category = complaint ? 'complaint.admin' : 'report.account';
        topic = 'appeal';
    }
    else if (has('account') && !has('rmt') && (!complaint||/\u0432\u0437\u043b\u043e\u043c|\u043f\u0430\u0440\u043e\u043b|\u043f\u0440\u043e\u043f\u0430\u043b|hacked|password|parol/.test(s))) {
        category = complaint ? 'complaint.other' : 'report.account';
        topic = 'account';
    }
    else if (has('admin')) {
        category = complaint ? 'complaint.admin' : 'report.complaint';
        topic = 'review';
    }
    else if (complaint) {
        category = (vague||insufficientComplaint(s)&&!Object.keys(patterns).some(k=>has(k))) ? 'complaint.invalid' : has('cheat') ? 'complaint.cheat' : has('scam') ? 'complaint.scam' : has('rmt') ? 'complaint.rmt_ads' : has('insult') ? 'complaint.insult' : has('dm') ? 'complaint.dm' : 'complaint.other';
        topic = category === 'complaint.insult' ? 'insult' : 'review';
    }
    else {
        category = (vague||offTopic(s)) ? 'report.offtopic' : has('help') ? 'report.help' : has('insult') || has('dm') || has('scam') || has('cheat') ? 'report.complaint' : 'report.question';
        topic = has('insult') ? 'insult' : category === 'report.complaint' ? 'review' : 'clarify';
    }
    const priority = has('payment') || has('critical') || topic === 'account' && /взлом|не.*(?:войти|зайти)|hacked|password|құпиясөз|алмай|parol|kirmay/.test(s) ? 'p0' : category==='complaint.invalid'?'p3':has('cheat') || has('rmt') || has('scam') && /миллион|дом|бизнес|million/.test(s) || complaint && attachments ? 'p1' : vague || category === 'report.question' || category==='report.offtopic' || complaint && !attachments ? 'p3' : 'p2';
    const retrieved = knowledge.map(k => ({ ...k, score: k.terms.filter(term => s.includes(term)).length })).filter(k => k.score > 0 && topic === 'insult').sort((a, b) => b.score - a.score).slice(0, 1);
    const cited = retrieved.map(k => k.ref);
    const needs_human = category !== 'report.offtopic' || lang === 'und';
    const reasons = [];
    if (['payment', 'account', 'appeal'].includes(topic))
        reasons.push('Обязательная проверка специалистом: платёж, аккаунт или апелляция');
    if (complaint || category === 'report.complaint')
        reasons.push('Администратор должен проверить факты и доказательства');
    if (category === 'report.help')
        reasons.push('Для помощи в игре требуется администратор');
    if (category === 'report.question')
        reasons.push('В небольшой базе нет проверенной инструкции по механике игры');
    if (lang === 'und')
        reasons.push('Язык не определён надёжно');
    if (!reasons.length)
        reasons.push('Нужно уточнить содержание обращения');
    const body = topic === 'insult' && cited.length ? `${t.insult}\n\n${t.review}` : topic === 'clarify' && category === 'report.question' ? `${t.missing} ${t.clarify}` : t[topic];
    const confidence = lang === 'und' ? 0.35 : vague ? 0.55 : category.endsWith('other') ? 0.45 : 0.72;
    return { lang, category, priority, is_spam_or_duplicate: /^(ау[ !,.]*){2,}$/.test(s), extracted: { nickname: input.reported_nick || raw.match(/\b[A-Z][a-zA-Z0-9]{1,24}_[A-Z][a-zA-Z0-9]{1,24}\b/)?.[0] || null, rule_refs: cited, has_evidence: attachments > 0, server: input.server || s.match(/(?:сервер|server)\s*[#№:]?\s*(\d{1,3})/)?.[1] || null }, draft_reply: { lang: lang === 'und' ? 'ru' : lang, text: `${t.hello} ${body}`, cited }, needs_human, confidence, reasons, analysis: {intent_topic:topic,engine: 'rules-and-templates-v1', confidence_kind: 'heuristic_not_calibrated', category_title: titles[category], knowledge_scope: 'small_verified_baseline', evidence_status: attachments ? 'attachments_not_reviewed' : 'no_attachments', retrieved: retrieved.map(({ score, ...k }) => k), cost_usd: 0 } };
}
