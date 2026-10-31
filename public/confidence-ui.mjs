export function confidencePresentation(result) {
  const raw=Number.isFinite(result.confidence)?result.confidence:null;
  const isModel=result.analysis?.confidence_kind==='model_self_assessment_not_calibrated';
  return {title:isModel?'Самооценка модели':result.analysis?.confidence_kind==='heuristic_not_calibrated'?'Эвристический балл':'Служебный балл',value:raw===null?'—':raw.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}),note:'Шкала 0–1. Не вероятность правильности. Независимая калибровка ещё не выполнена.',raw,target:'category_correctness',calibrated:false};
}
