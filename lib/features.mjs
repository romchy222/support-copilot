// Intent features describe the allegation only; they never confirm a violation.
export const intentPatterns={
 payment:/донат|плат[её]ж|оплат|списал|payment|paid|refund|to'lov|төлем|pago|pagamento/i,
 account:/взлом|парол|аккаунт|пропал.*(?:машин|имуществ)|выкидыва.*другой\s*аккаунт|hacked|account|password|akkaunt|parol|құпиясөз|cuenta|conta/i,
 appeal:/разбан|розбан|апелляц|обжал|(?<!приста[её]т\s*)забан(?!ьте\s*пожалуйста)|бан.*(?:причин|сним|обжал)|не\s*соглас.*(?:наказ|вердикт)|смягч.*наказ|кто.*выдал|оказался.*дмг|не\s*үшін.*бан|unban|banned|бұғат|банды|неверно\s*выда|за\s*(?:что|шо)\s*(?:бан|варн|ванн|мут|дмг)|дмг\s*не\s*за\s*что|снимите.*(?:бан|варн|мут)|опру\s*(?:на|за|по)|не\s*согл\b|ne\s*sogl\b|banga?\s*norozi|bandan\s*chiqar|sababsiz\s*blo[kg]|qayta\s*mut\s*ber/i,
 admin:/админ.*(?:жалоб|мут|бан|причин|снял|выдал|отказ)|жалоб.*админ|не\s+забанили|мою\s+жалоб.*ответ|нехватка\s+доказательств|admin(?:lar|lani|strator).*(?:rad|huquq|farm)|не\s*(?:правильно|верно)\s*(?:выдал\s*наказ|отвечает\s*на\s*репорт)|фарм\s*репорт|rep\s*farm|требую.*администратор.*выговор|naqonuniy.*admin|nohaq.*qaror/i,
 cheat:/чит|аим|aimbot|cheat|через стен|летает|софт|\bsoft\b|автоклик|макрос|играет\s*со\s*сб\b/i,
 scam:/(?<!не\s)скам|обман|мошен|кинул|scam|aldadi|алда|aldasa|olib.*(?:chiqib|bermadi)|pulni.*(?:topshirmadi|bermadi)|в\s*замен.*вышел|составили\s*договор.*вышел|переводом.*не\s*увидел/i,
 rmt:/rmt|реал.*деньг|прода[её]т.*аккаунт|реклам/i,
 dm:/(?<!\p{L})(?:дм|дб|тк|dm|db|tk|рк|rk|ск|sk)(?!\p{L})|дмит|дмил|дмят|задеэмил|текаш|уби[лт]|убива(?:ет|ют|ть)|застрел|стреля|унёс|задавил|задовил|збил|сбил.*машин|подрезал.*огонь|надел.*наручник|повязал|арестовал.*без\s*причин|посадил.*(?:просто\s*так|без\s*причин|тюрьм|когда\s*я)|взяли\s*под\s*стражу|kill|өлтір|связал|вер[её]вк|kishan|kshan|o'ldir|oldir|uldirdi|otib|otdi|otvord|otishvordi|otyabdi|qamoq|kamoka|qamadi|тайзер|tayzer|arqon.*boyladi|qop\s*kiydir|moshina\s*bilan\s*oldir|без\s+причин.*тюрьм|нрп\s*коп|нон\s*рп\s*коп|nrp\s*kop/iu,
 insult:/оск[оа]рб|(?<!\p{L})(?:оск|ос3|osk|osc)(?!\p{L})|оска(?:ет|ют|л)|обзыва|матер|матоми|непристойные|чувырла|хуесос|пидорас|уебок|шлюха|шантаж.*угроз|угроз.*жизн|дайте\s*мут.*музык|приста[её]т.*забаньте|токсич|расизм|insult|haqorat|xaqorat|haqrat|балағат|упом.*род|задел.*род|onadan|onamdan|so'k|so'qi|so'kin|sokdi|sokyapti|sokindi|sukindi|sukini|yban\s*bolasi/i,
 help:/застр|текстур|баг|ошибк|вылет|stuck|bug|қате|qotib|переверн[иуі]|почините|вытащите.*из\s*воды|достаньте\s*тачку|дастаньте\s*тачку|снимите\s*(?:наручники|мешок)|тп\s*(?:ко\s*мне|меня|на\s*бв)|телепортируйте|не\s*могу\s*встать|в\s*каком-то\s*измерени|упал\s*в\s*воду/i,
 critical:/массов.*баг|угро[зж].*(?:жизн|убий|реал)|докс|dox|death threat/i,
};
export function insufficientComplaint(text){
 const meaningful=text.replace(/<[^>]+>/g,' ').replace(/\d+(?:[.,]\d+)*/g,' ').replace(/(?:^|\s)(?:оп|op|gz|жб|фв|опг|оплз|ук|рф|green\s+zone)(?=\s|$)/g,' ').replace(/[^\p{L}]/gu,'');
 return meaningful.length<3||/^(?:продам|куплю|не согласен|опру|обиженный человек|самый лучший|примите меры администраторы)[.!?\s]*$/i.test(text.replace(/<[^>]+>/g,' ').trim())||/^(?:лвл не поднимается|как купить|как найти|touch and hold a clip to pin it)/i.test(text.trim());
}
export function offTopic(text){return /^(?:помогите|помагите|памагите|помогітє|памагі|помоги|памоги|помоите|помо7ите|привет|помощь|ау|сос|спавн|спавн дайте|yordam|yordam e|help|help pls|salom)[ !,.]*$/i.test(text)||/столица\s|вы тут|\bайди\s+в\s+форме|хорошего настроения|добрый вечер:\)/i.test(text)}
export function uzbekHint(text){return /\b(?:salom|assalomu|asalomu|men|menga|meni|mani|iltimos|qanday|akkaunt|pul|haqorat|xaqorat|yordam|parol|uchun|bilan|besabab|sababsiz|qildi|odamlarni|chora|onadan|onamdan|sokdi|sokyapti|sukindi)\b|to'lov|o'yin|so'k|o'ldir|oldirdi|qamoq|kishan/i.test(text)}
