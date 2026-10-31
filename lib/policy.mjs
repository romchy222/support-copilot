import { normalize } from './triage.mjs';
export function mandatoryHuman(input, category) {
    if (input.kind === 'complaint' || ['report.account', 'report.payment', 'complaint.admin'].includes(category))
        return true;
    const text = normalize(input.messages.filter(m => m.role === 'player').map(m => m.text).join(' '));
    return /плат[её]ж|донат|оплат|списал|взлом|парол|разбан|апелляц|забан|не могу (?:войти|зайти)|payment|refund|hacked|password|unban|ban appeal|төлем|құпиясөз|бұғат|аккаунт.*алмай|to'lov|parol|akkaunt.*(?:kirmay|o'g'ir)|apelaci|pago|reembolso|pagamento|senha|contrase/.test(text);
}
export function permittedAutomatic(category, lang, hasSources, confidence) {
    return lang !== 'und' && confidence >= .85 && (category === 'report.offtopic' || category === 'report.question' && hasSources);
}
const unsafe = [
  /передан[аоы]?\s+(?:на|в|админ|специал)|(?:обращение|жалоба)[^.!?\n]{0,100}(?:рассмотрен|принят[ао]|зарегистрирован)/i,
    /(?:получит|выдадим|назначим).*(?:мут|бан|наказ)|верн[её]м|возместим|разблокируем|разбаним/i,
    /(?:скриншот|запис[ьи]|фото|доказательств).*(?:видно|проверен|подтвержда)|нарушение подтверждено/i,
    /(?:will|shall)\s+(?:refund|unban|punish|restore|ban)|(?:have|has) been (?:forwarded|reviewed|resolved)|we (?:reviewed|confirmed)/i,
    /ақша.*қайтарамыз|бұғат.*аламыз|әкімшіге жіберілді|жазалаймыз|pul.*qaytaramiz|ban.*ochamiz|jazolaymiz|administratorga yuborildi/i,
    /reembolsaremos|desbloquearemos|será punido|vamos (?:reembolsar|punir)|foi (?:encaminhad|analisad)|ha sido (?:revisad|enviad)/i,
];
export function unsafeDraft(text) { return unsafe.some(pattern => pattern.test(text)); }
