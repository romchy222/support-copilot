// Assistant-edited language templates. Independent native-speaker review is still pending.
const templates={
 ru:{
  insult:'Здравствуйте! Пункт 2.1 общих правил запрещает оскорбления игроков и их родственников.',
  cheat:'Здравствуйте! Пункт 5.2 общих правил запрещает использование стороннего ПО и читов.',
  scam:'Здравствуйте! Пункт 4.1 общих правил запрещает обман и махинации с игровым имуществом.',
  rmt:'Здравствуйте! Пункт 4.4 общих правил запрещает сделки за реальные деньги.',
  admin:'Здравствуйте! Пункт 3.4 общих правил указывает, что жалобы на администраторов подаются через соответствующий раздел в течение двух дней с момента выдачи наказания.',
  help:'Здравствуйте! Укажите сервер, точное местоположение и обстоятельства игровой проблемы для проверки администратором.',
  attachment:'Приложенные материалы и обстоятельства должен проверить администратор.',
  review:'Обстоятельства должен проверить администратор.',
  server:'Уточните сервер.',
  time:'Уточните время события.',
  both:'Уточните сервер и время события.',
  payment:'Здравствуйте! Для проверки платежа специалисту нужны дата и время покупки, название товара и чек. Не отправляйте пароль или полные данные банковской карты; зачисление и возврат можно подтвердить только после проверки.',
  account:'Здравствуйте! Вопрос доступа или имущества аккаунта должен проверить специалист поддержки. Не передавайте пароль и коды подтверждения; восстановление заранее не гарантируется.'
 },
 kk:{
  insult:'Сәлеметсіз бе! Жалпы ойын ережелерінің 2.1-тармағында ойыншыларды және олардың туыстарын қорлауға тыйым салынған.',
  cheat:'Сәлеметсіз бе! Жалпы ойын ережелерінің 5.2-тармағында бөгде бағдарламалар мен читтерді қолдануға тыйым салынған.',
  scam:'Сәлеметсіз бе! Жалпы ойын ережелерінің 4.1-тармағында ойын мүлкімен алаяқтық жасауға тыйым салынған.',
  rmt:'Сәлеметсіз бе! Жалпы ойын ережелерінің 4.4-тармағында нақты ақшаға мәміле жасауға тыйым салынған.',
  admin:'Сәлеметсіз бе! Жалпы ойын ережелерінің 3.4-тармағына сәйкес әкімшіге шағым жаза берілген сәттен бастап екі күн ішінде тиісті бөлімге беріледі.',
  help:'Сәлеметсіз бе! Әкімші тексеруі үшін серверді, нақты орналасқан жерді және ойын мәселесінің мән-жайын жазыңыз.',
  attachment:'Қоса берілген материалдар мен мән-жайды әкімші тексеруі керек.',
  review:'Мән-жайды әкімші тексеруі керек.',
  server:'Серверді нақтылап жазыңыз.',
  time:'Оқиға уақытын нақтылап жазыңыз.',
  both:'Сервер мен оқиға уақытын нақтылап жазыңыз.',
  payment:'Сәлеметсіз бе! Төлемді тексеру үшін сатып алу күні мен уақытын, тауар атауын және түбіртекті дайындаңыз. Құпиясөзді немесе банк картасының толық деректерін жібермеңіз; қаражаттың қайтарылуына алдын ала кепілдік берілмейді.',
  account:'Сәлеметсіз бе! Аккаунтқа кіру немесе мүлік мәселесін қолдау қызметінің маманы тексеруі керек. Құпиясөз бен растау кодтарын ешкімге бермеңіз; қалпына келтіруге алдын ала кепілдік берілмейді.'
 },
 uz:{
  insult:'Salom! Umumiy o‘yin qoidalarining 2.1-bandida o‘yinchilar va ularning qarindoshlarini haqorat qilish taqiqlangan.',
  cheat:'Salom! Umumiy o‘yin qoidalarining 5.2-bandida begona dasturlar va chitlardan foydalanish taqiqlangan.',
  scam:'Salom! Umumiy o‘yin qoidalarining 4.1-bandida o‘yin mulki bilan firibgarlik qilish taqiqlangan.',
  rmt:'Salom! Umumiy o‘yin qoidalarining 4.4-bandida haqiqiy pulga savdo qilish taqiqlangan.',
  admin:'Salom! Umumiy o‘yin qoidalarining 3.4-bandiga muvofiq administrator ustidan shikoyat jazo berilgan paytdan boshlab ikki kun ichida tegishli bo‘limga topshiriladi.',
  help:'Salom! Administrator tekshirishi uchun serverni, aniq joylashuvni va o‘yin muammosi tafsilotlarini yozing.',
  attachment:'Ilova qilingan materiallar va vaziyatni administrator tekshirishi kerak.',
  review:'Vaziyatni administrator tekshirishi kerak.',
  server:'Serverni aniqlashtiring.',
  time:'Hodisa vaqtini aniqlashtiring.',
  both:'Server va hodisa vaqtini aniqlashtiring.',
  payment:'Salom! To‘lovni tekshirish uchun xarid sanasi va vaqti, mahsulot nomi hamda chekni tayyorlang. Parol yoki bank kartasining to‘liq ma’lumotlarini yubormang; pul qaytarilishi oldindan kafolatlanmaydi.',
  account:'Salom! Akkauntga kirish yoki mulk masalasini qo‘llab-quvvatlash mutaxassisi tekshirishi kerak. Parol va tasdiqlash kodlarini hech kimga bermang; tiklash oldindan kafolatlanmaydi.'
 },
};
const ruleKey={'2.1':'insult','5.2':'cheat','4.1':'scam','4.4':'rmt','3.4':'admin'};
const templateEvidence={
 insult: source=>/оскорблен/i.test(source)&&/родственник/i.test(source),
 cheat: source=>/стороннего программного обеспечения/i.test(source)&&/читы/i.test(source),
 scam: source=>/мошенничеств|обман/i.test(source),
 rmt: source=>/за реальные деньги/i.test(source),
 admin: source=>/жалобы на администраторов/i.test(source)&&/раздел/i.test(source)&&/2-х дней|двух дней/i.test(source),
};
export function editorialDraft(result,input){
 const t=templates[result.draft_reply.lang];if(!t)return result;
 let text;
 const cited=(result.analysis.cited_sources||[])[0];
 if(result.category==='report.payment')text=t.payment;
 else if(result.category==='report.account'&&!/appeal|ban/.test(result.analysis?.intent_topic||''))text=t.account;
 else if(result.category==='report.help'&&!cited)text=t.help;
 else if(cited&&cited.section==='Общие правила игры'&&ruleKey[cited.ref]&&templateEvidence[ruleKey[cited.ref]](cited.text)){
   const messages=input.messages.filter(m=>m.role==='player');
   const timeKnown=messages.some(m=>/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(m.text));
   const serverKnown=!!result.extracted.server;
   const request=!serverKnown&&!timeKnown?t.both:!serverKnown?t.server:!timeKnown?t.time:'';
   text=[t[ruleKey[cited.ref]],result.extracted.has_evidence?t.attachment:t.review,request].filter(Boolean).join(' ');
 }
 return text?{...result,draft_reply:{...result.draft_reply,text},analysis:{...result.analysis,draft_origin:'assistant_edited_template',native_speaker_reviewed:false}}:result;
}
