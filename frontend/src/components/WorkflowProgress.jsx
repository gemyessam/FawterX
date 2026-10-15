import { FileUp, Columns3, ScanLine, Send, Check } from 'lucide-react'

export default function WorkflowProgress({ step, lang }) {
  const ar = lang === 'ar'
  const stages = [
    [FileUp, ar ? 'ارفع ملفك' : 'Upload your file', ar ? 'بيانات البداية' : 'Source data'],
    [Columns3, ar ? 'رتّب الأعمدة' : 'Map columns', ar ? 'ربط الحقول' : 'Field mapping'],
    [ScanLine, ar ? 'راجع الفاتورة' : 'Review invoice', ar ? 'المطابقة والبيانات' : 'Data & compliance'],
    [Send, ar ? 'كمّل الإرسال' : 'Submit invoice', ar ? 'بوابة الضرائب' : 'ETA portal'],
  ]
  return <ol className="fx-workflow-progress" aria-label={ar ? 'مراحل الفاتورة' : 'Invoice stages'}>
    {stages.map(([Icon, title, description], i) => <li key={title} className={`${step === i + 1 ? 'current' : ''} ${step > i + 1 ? 'complete' : ''}`} aria-current={step === i + 1 ? 'step' : undefined}><span className="fx-stage-icon">{step > i + 1 ? <Check size={19} /> : <Icon size={19} />}</span><div><small>0{i + 1}</small><b>{title}</b><span>{description}</span></div></li>)}
  </ol>
}
