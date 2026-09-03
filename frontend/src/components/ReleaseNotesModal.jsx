import React from 'react'
import packageInfo from '../../package.json'

export default function ReleaseNotesModal({ isOpen, onClose, lang = 'ar' }) {
  if (!isOpen) return null

  const isAr = lang === 'ar'

  const releaseHistory = [
    {
      version: 'v2.27.55',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? '✨ التحديث الأحدث' : '✨ Latest Release',
      badgeColor: '#00e0a1',
      title: isAr ? 'إصلاح فوري لشاشة مراجعة شوكو ومنع الشاشة الفارغة وتأمين نطاق المتغيرات' : 'Instant Fix for Schüco Review Screen Scope Reference Error & Blank Screen Prevention',
      highlights: [
        {
          icon: '🛡️',
          text: isAr
            ? 'إصلاح الشاشة الفارغة: تصحيح نطاق المتغيرات ومصفوفة أذون دلمار النشطة في كارت الدفعة الموسع لمنع أي خطأ برمجي عند رفع ملفات شوكو.'
            : 'Blank Screen Resolution: Corrected variable scope for active Delmar dispatches in expanded batch card.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'استقرار كامل: ضمان عمل مزامنة الأسعار وتفاصيل المقاييس بسلاسة تامة وفورية.'
            : 'Bulletproof Stability: Ensured seamless price reconciliation and metric calculations.'
        }
      ]
    },
    {
      version: 'v2.27.54',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'توحيد مصدر ومحرك التسعير بين أذون دلمار وبيان شوكو وربط الرصيد المتبقي بدقة' : 'Unified Pricing Engine & Single Source of Truth Between Delmar Dispatches & Schüco SD',
      highlights: [
        {
          icon: '🎯',
          text: isAr
            ? 'مصدر تسعير موحد 100%: ربط تسعير بيان شوكو مباشرة بأذون دلمار المنصرفة وفواتير التوريد الأصلية بدلاً من التقديرات القديمة.'
            : 'Single Source of Truth: Directly mapped Schüco SD pricing to active Delmar dispatches and original Canex source invoices.'
        },
        {
          icon: '⚖️',
          text: isAr
            ? 'تطابق رياضي تام: إظهار تكلفة شوكو (928 عود) + قيمة الرصيد المتبقي بدلمار (5 أعواد) = إجمالي أذون دلمار (1,323,034.51 ج) مع زر مزامنة فوري.'
            : 'Exact Balance Reconciliation: Schüco Cost + Remaining Delmar Stock = Total Dispatched Amount with instant 1-click sync.'
        }
      ]
    },
    {
      version: 'v2.27.53',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'تثبيت أبعاد وتنسيق أعمدة جدول الحركات والقضاء على التفاف الأعواد ونوع الحركة' : 'Table Layout Stabilization & Fixed Dimensions for Movement and Bars Columns',
      highlights: [
        {
          icon: '📏',
          text: isAr
            ? 'تثبيت أحجام الأعمدة: تخصيص عرض ثابت ومستقر لكل من عمود (نوع الحركة) وعمود (الأعواد / القطاعات) ومنع انكسار الكلمات أو تذبذب العرض نهائياً.'
            : 'Fixed Column Widths: Guaranteed stable dimensions for Movement and Bars columns, preventing text wrapping or layout jitter.'
        },
        {
          icon: '✨',
          text: isAr
            ? 'تنسيق أنيق لكبسولة الأعواد: إظهار عدد الأعواد ووحدة BAR على سطر أفقي واحد عريض ومريح للعين، وإزالة أزرار تصحيح التكلفة المؤقتة لاعتماد الحساب التلقائي.'
            : 'Streamlined Bar Badge & UI Cleanup: Unified BAR badges on single horizontal lines and removed temporary reconciliation buttons.'
        }
      ]
    },
    {
      version: 'v2.27.52',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'أدوات فورية لإعادة احتساب وتصحيح تكلفة أذون الصرف من الفواتير الأصلية (1.29M)' : 'Instant Actions for Retroactive Outbound Cost Reconciliation from Source Invoices',
      highlights: [
        {
          icon: '⚡',
          text: isAr
            ? 'زر تصحيح التكلفة في كل سطر: إضافة زر فوري (تصحيح التكلفة) بجانب كل إذن صرف في جدول الحركات لإعادة تدقيق بنوده وسحب قيمته الحقيقية فوراً.'
            : 'Per-Row Cost Fix Action: Added instant "Fix Cost" button to each outbound row in transaction history to recalculate item valuations on demand.'
        },
        {
          icon: '💰',
          text: isAr
            ? 'تحديث شامل لكافة أذون الصرف: زر رئيسي أعلى الجدول لتصحيح جميع الحركات السابقة ومطابقتها مع فواتير التوريد الأصلية (لتصل إلى قيمتها الحقيقية 1.29M).'
            : 'Global Bulk Cost Re-Evaluation: One-click header action to recalculate all historical outbound movements against source invoices.'
        }
      ]
    },
    {
      version: 'v2.27.51',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'تأسيس المحرك الموحد للتسعير (Single Source of Truth) وتصحيح تكلفة الصرف وكود 515750' : 'Canonical Single Source of Truth Valuation Engine & Cross-Reference Pricing',
      highlights: [
        {
          icon: '🏛️',
          text: isAr
            ? 'المصدر الموحد للتسعير والتكلفة: اعتماد هيكل هرمي موحد (فاتورة التوريد الأصلية ⬅️ قاموس المترادفات ⬅️ المخزن الفعلي ⬅️ حركات التوريد) لمنع أي تضارب أو أخطاء في حساب التكلفة.'
            : 'Canonical Cost Engine: Unified 4-tier hierarchy for pricing and valuation across all dispatch and review workflows.'
        },
        {
          icon: '📐',
          text: isAr
            ? 'تصحيح معادلة التكلفة للأعواد والأمتار: القضاء نهائياً على خطأ قسمة السعر على طول العود، وتوحيد معادلة القيمة (الأعواد × سعر العود = الأمتار × سعر المتر) ومطابقة قيمة SD التامة.'
            : 'Fixed Profile Valuation Math: Eliminated per-meter vs per-bar unit price discrepancy, aligning dispatch values precisely with delivery notes.'
        },
        {
          icon: '🔁',
          text: isAr
            ? 'حل تصفير بند شوكو 515750: ربط ذكي وتلقائي مع كود كانكس المقابل (515756) عبر قاموس الأكواد المترادفة، مع إظهار التكلفة والإنذار بالصفر في نافذة الصرف ومطابقة التكاليف التاريخية.'
            : 'Resolved 515750 Zero-Cost: Automatic cross-referencing to Canex 515756 with real-time zero-cost alerting and retroactive reconciliation.'
        }
      ]
    },
    {
      version: 'v2.27.50',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'ربط وإظهار ريفرنس الفاتورة المصروف منها في سجل الحركات وتتبع مراحل الصرف والدهان' : 'Source Inbound Invoice Reference Tracking in Audit Trail & Dispatches View',
      highlights: [
        {
          icon: '🔗',
          text: isAr
            ? 'إظهار ريفرنس الفاتورة المصروف منها: استبدال الأكواد الداخلية التلقائية (FROM-INV-ID) ببادج أنيق وواضح يوضح رقم الفاتورة الأصلية ومرجع العميل في جدول الحركات والتوريدات وتفاصيل الفاتورة.'
            : 'Human-Readable Source Invoice Reference: Resolves raw internal IDs into clean source invoice badges with customer reference in transaction audit trail.'
        },
        {
          icon: '🎨',
          text: isAr
            ? 'تتبع مراحل الصرف والدهان: إظهار الفاتورة المرجعية المصروف منها مباشرة في كروت أوامر الصرف وقسم التفاصيل مع دعم البحث الفوري برقم الفاتورة الأصلية.'
            : 'Dispatches Lifecycle Integration: Displays source inbound invoice reference on dispatch cards and detail sections with search filtering.'
        }
      ]
    },
    {
      version: 'v2.27.49',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'إظهار مجموع تكلفة وقيمة إذن الصرف (SD) في شريط المقاييس وتذييل الجدول الإجمالي' : 'Total SD / Outbound Cost Metric Pill & Grand Totals Table Footer',
      highlights: [
        {
          icon: '💰',
          text: isAr
            ? 'كبسولة مجموع التكلفة: إضافة مقياس إجمالي التكلفة والقيمة المالية لإذن الصرف (SD) أو المواد الخارجة مباشرة في شريط القيادة التنفيذي بالعملة المعتمدة.'
            : 'Total Cost Metric Pill: Prominently displays the total outbound cost/value of the delivery order in the header metric strip.'
        },
        {
          icon: '📊',
          text: isAr
            ? 'تذييل المجموع الكلي للجدول (Grand Total Footer): إضافة سطر تذييل ختامي أسفل جدول البنود يجمع تلقائياً إجمالي الأعواد، الأمتار، الوزن بالكيلوجرام، وإجمالي القيمة المالية.'
            : 'Comprehensive Table Footer: Summary row compiling total bars, total linear meters, total weight in kg, and total net amount.'
        }
      ]
    },
    {
      version: 'v2.27.48',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'تأثير بصري تفاعلي لأزرار الأولوية وتمدد كامل (Stretch) لعمود وصف القطاعات' : 'Interactive Priority Toggle Visual State & Full Stretch for Profile Descriptions',
      highlights: [
        {
          icon: '🎨',
          text: isAr
            ? 'تفاعل بصري فوري لأزرار الأولوية: عند الضغط على (دلمار أولاً) يضيء الزر باللون الأخضر الزمردي المتوهج مع تعتيم زر المستودع، وعند الضغط على (المستودع أولاً) يضيء باللون السماوي المتوهج فوراً لتأكيد الاختيار بصرياً.'
            : 'Interactive Dynamic Priority Toggles: Distinct visual glow and color inversion confirming Delmar First (Emerald Green) vs Warehouse First (Sky Blue).'
        },
        {
          icon: '📐',
          text: isAr
            ? 'تمدد كامل لعمود وصف القطاع (Full Stretch): توسيع عرض العمود إلى 480-500px مع تمدد حقل النص (100% Full Width) لعرض الوصف الفني للقطاع بالكامل دون أي ضغط أو اقتطاع.'
            : 'Profile Description Full Stretch: Expanded column width to 480-500px with full 100% width textarea for comfortable readability.'
        }
      ]
    },
    {
      version: 'v2.27.47',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'إعادة هيكلة واجهة المراجعة: أرقام تنظيمية مدمجة وإنذار التعارض بالأحمر وتنبيه الفارق بالبرتقالي' : 'Invoice Review UI Streamlining: Compact Metrics, Red Conflict Alarms & Orange Variance Alerts',
      highlights: [
        {
          icon: '📊',
          text: isAr
            ? 'كبسولات أرقام تنظيمية مدمجة: إلغاء كافة الفقرات الإنشائية والكروت الضخمة المتداخلة، وتوحيد إجمالي أعواد شوكو، ورصيد دلمار، ومطلوب المستودع، وفحص الأصناف في شريط قيادة نحيف ومريح للعين بنسبة 100%.'
            : 'Compact Metric Pills: Eliminated discursive text and bulky nested cards in favor of clean, executive metric badges.'
        },
        {
          icon: '🚨',
          text: isAr
            ? 'نوتفكيشن الإنذار بالأحمر فقط: تخصيص اللون الأحمر حصراً لإنذارات تعارض الأصناف ونفاد الرصيد والتحويل التلقائي للمستودع لإبراز الأثر الفعلي دون تشتيت.'
            : 'Dedicated Red Conflict Alarm: High-priority alerts reserved exclusively for competing items, stock exhaustion, and automatic warehouse rerouting.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'تنبيه الفارق بالأصفر البرتقالي: شريط تنبيهي أنيق بلون كهرماني/برتقالي عند وجود فارق أعواد بين شوكو ودلمار يوضح الإجراء المالي والكمي بدقة وسطر واحد.'
            : 'Clean Amber Variance Notice: Streamlined single-line notice for requested SD bars exceeding Delmar inventory.'
        }
      ]
    },
    {
      version: 'v2.27.46',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'نظام التخصيص التتابعي التراكمي لأوامر دلمار وتنبيه الأكواد المشتركة والمكررة (Sequential Delmar Allocation & Duplicate Code Alerting)' : 'Sequential Delmar Allocation Engine & Duplicate/Shared Code Detection & Real-time Alerting',
      highlights: [
        {
          icon: '🔢',
          text: isAr
            ? 'التخصيص التتابعي التراكمي (Sequential FIFO Allocation): عند تكرار أو تشابه الصنف بين عدة سطور في الفاتورة، يُعطى السطر الأول في الترتيب الأولوية الكاملة من رصيد دلمار، ويأخذ السطر التالي المتبقي إن وُجد، أو يُصرف بالكامل من المستودع الرئيسي عند نفاد رصيد دلمار.'
            : 'Sequential FIFO Allocation: First line in order receives full priority from Delmar stock. Successive matching lines consume remaining balance or route 100% to warehouse upon exhaustion.'
        },
        {
          icon: '⚠️',
          text: isAr
            ? 'تنبيهات فورية للأكواد المتشابهة والمشتركة: بانر تحذيري بارز في كارت الفاتورة وبادجات واضحة في الجدول لكل سطر توضح حالة الصنف (مشترك 1 من 2، أخذ الباقي، أو نَفَد الرصيد بسطر سابق وتم تحويل الصرف للمستودع).'
            : 'Smart Shared/Duplicate Code Alerting: Prominent conflict banners and per-row badges clarifying shared order ranking, exhaustion points, and automatic warehouse fallbacks.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'منع الازدواجية والحساب الوهمي: القضاء التام على ازدواجية رصيد دلمار بين السطور المتعددة وضمان مطابقة الأرصدة المصروفة والمحفوظة مع قاعدة البيانات.'
            : 'Zero Phantom Balance Guarantee: Complete elimination of duplicate stock allocation across concurrent lines with verified database persistence.'
        }
      ]
    },
    {
      version: 'v2.27.45',
      date: isAr ? '3 سبتمبر 2026' : 'Sep 3, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'معالجة صرف وإغلاق أوامر مخزن الوسيط (دلمار) وإظهار إجمالي أعواد شوكو ورصد الفارق بدقة' : 'Automated Delmar Intermediate Warehouse Fulfillment & Precise Schüco Requested Bars & Variance Tracking',
      highlights: [
        {
          icon: '⚡',
          text: isAr
            ? 'خصم وإغلاق أوامر دلمار تلقائياً: ربط استدعاء fulfillDelmarDispatches عند حفظ إذن الصرف الخارجي مع تحديث مراحل الأوامر الجارية إلى (المرحلة 2: تم التسليم للعميل النهائي ومكتمل)، وخصم رصيد دلمار بدقة متناهية.'
            : 'Automated Delmar Dispatches Fulfillment: Outbound delivery notes automatically complete and fulfill in-coating dispatches with full lifecycle audit.'
        },
        {
          icon: '📋',
          text: isAr
            ? 'لوحة بيان أعواد شوكو ومخزن دلمار: كارت تحليلي ثلاثي يوضح مجموع الأعواد المطلوبة في إذن شوكو (958 عود)، والرصيد الفعلي في مخزن دلمار (933 عود)، والفارق الواجب سحبه من المستودع الرئيسي (25 عود).'
            : 'Schüco Requested Bars & Delmar Balance Overview: Comprehensive 3-metric KPI board detailing requested SD bars, actual Delmar stock, and warehouse shortage.'
        },
        {
          icon: '🔄',
          text: isAr
            ? 'أزرار مطابقة وتحديث لحظية: إضافة زر (مطابقة وإغلاق أوامر دلمار) في شاشة تتبع المراحل وسجل الحركات لمعالجة أي أذونات سابقة بضغطة زر وتصحيح رصيد المستودع للفارق.'
            : 'One-Click Delmar Reconcile Buttons: Instant synchronization and fulfillment for existing dispatches directly from Lifecycle Tracker and Audit Trail.'
        }
      ]
    },
    {
      version: 'v2.27.44',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#64748b',
      title: isAr ? 'ترقية جذرية لنقاط الاستعادة الكاملة (4 في 1) والتراجع المتكامل لمخزن دلمار وحركات الصرف' : 'Full 4-in-1 Complete Restore Engine & Integrated Rollback for Delmar Dispatches & Inventory',
      highlights: [
        {
          icon: '🛡️',
          text: isAr
            ? 'استعادة شاملة 100% لكامل النظام: ترقية نقطة الاستعادة لحفظ واسترجاع كل شيء (الأرصدة + الحركات + الفواتير + أوامر دلمار)، وحذف أي فواتير أُضيفت بعد النقطة وإرجاع الأوامر لحالتها الأصلية دون أي أثر متبقي.'
            : 'Complete 4-in-1 Snapshot Restore: Full point restore covers Stock, Movements, Invoices, and Dispatches, cleanly wiping subsequent entries.'
        },
        {
          icon: '↩️',
          text: isAr
            ? 'تراجع ذكي عن الصرف: عند التراجع عن أي إذن صرف، يتم فوراً إعادة فتح أوامر دلمار المنصرفة وإرجاعها لمرحلة قيد الدهان والمعالجة (المرحلة 1)، وعكس رصيد المخزن الفعلي فقط.'
            : 'Smart Outbound Rollback: Cancelling an outbound delivery note restores Delmar orders back to in_coating and safely reverses inventory.'
        },
        {
          icon: '🔒',
          text: isAr
            ? 'حظر الإغلاق الصامت في الخلفية: إلغاء أي تعديلات صامتة على أوامر دلمار عند فتح الصفحات لضمان ثبات ودقة الأرصدة التراكمية.'
            : 'Strict Deterministic State: Removed silent background reconciliations to guarantee inventory fidelity.'
        }
      ]
    },
    {
      version: 'v2.27.43',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'تكبير وإبراز أرقام عدد البارات (BAR) في بطاقات التتبع وجداول الفحص' : 'Enlarged High-Visibility Bar Count Typography Across Lifecycle Tracker & Audit Tables',
      highlights: [
        {
          icon: '🔍',
          text: isAr
            ? 'تكبير عدد البارات في بطاقات المراحل: تكبير أرقام البارات (BAR) في بطاقات المرحلة 1 والمرحلة 2 إلى 1.6rem بخط عريض وبادجات مضيئة مميزة لتسهيل قراءتها بنظرة واحدة.'
            : 'Enlarged Bar Counts in Lifecycle Cards: Bar totals in Phase 1 & Phase 2 cards boosted to 1.6rem with bold illuminated badges.'
        },
        {
          icon: '📊',
          text: isAr
            ? 'خطوط أوضح في جداول المراجعة وسجل الحركات: تكبير خانات المتاح والمطلوب وعدد الأعواد في سجل الحركات لضمان قراءة سريعة ومريحة للعين.'
            : 'Clearer Table Typography: Available, requested, and total dispatched bar counts enlarged for enhanced legibility.'
        }
      ]
    },
    {
      version: 'v2.27.42',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'خصم وإغلاق أوامر مخزن دلمار آلياً عند الصرف، واحتساب قيمة الصرف بسعر تكلفة الدخول' : 'Auto-Fulfill Delmar Dispatches & Valuation of Outbound Deliveries by Inbound Acquisition Cost',
      highlights: [
        {
          icon: '🏭',
          text: isAr
            ? 'خصم وإغلاق دورة دلمار تلقائياً: عند صرف أذونات التسليم من مخزن دلمار، يقوم السيستم فوراً بالخصم من أوامر التتبع الجارية وإغلاقها وتحويلها إلى (المرحلة 2: تم التسليم للعميل النهائي) وتصفير الرصيد المنصرف.'
            : 'Auto-fulfill Delmar Coating Dispatches: delivery orders (SD) automatically deduct and close corresponding open coating batches.'
        },
        {
          icon: '💰',
          text: isAr
            ? 'تقييم الصرف بتكلفة التوريد (Inbound Cost): أذونات التسليم التي لا تتضمن أسعاراً مطبوعة يتم احتساب قيمتها تلقائياً بضرب الكميات في تكلفة دخول القطاع الأصلية من المخزن، ومنع ظهور 0.00 EGP نهائياً.'
            : 'Automatic Inbound Cost Valuation: unpriced delivery notes are automatically valued using incoming unit/bar costs from inventory.'
        },
        {
          icon: '🔄',
          text: isAr
            ? 'زر تدقيق وتصحيح الحركات السابقة: زر مخصص في سجل الحركات لتدقيق وتحديث تكلفة إذن SD 594 وتحديث وإغلاق أوامر دلمار المعلقة بنقرة واحدة.'
            : 'Audit & Reconciliation Action: one-click action to backfill past zero-cost deliveries and synchronize Delmar batches.'
        }
      ]
    },
    {
      version: 'v2.27.41',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'إخفاء خانة الربط اليدوي تلقائياً وتفعيلها بزر مخصص عند الطلب' : 'Collapsible On-Demand Canex Manual Link Input',
      highlights: [
        {
          icon: '🔗',
          text: isAr
            ? 'تصميم مدمج ونظيف: إخفاء خانة إدخال كود كانكس اليدوي افتراضياً لتوفير المساحة ومنع ازدحام الجدول، مع توفير زر رابط [ 🔗 ] سريع بجانب زر البحث [ 🔍 ] لفتح الخانة عند الحاجة فقط.'
            : 'Compact Clean UI: Canex manual link input is hidden by default and toggled via a sleek [🔗] button, saving vertical space and visual clutter.'
        },
        {
          icon: '✨',
          text: isAr
            ? 'إغلاق تلقائي بعد الربط: بمجرد اعتماد الربط بكود كانكس، تُغلق الخانة تلقائياً وتظهر شارة خضراء أنيقة تؤكد الربط الدائم.'
            : 'Auto-collapse after linking: the input field closes automatically once linked and shows the elegant green verified badge.'
        }
      ]
    },
    {
      version: 'v2.27.40',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'أعمدة الأرصدة والمتبقي (المستودع ودلمار)، إزالة الاقتراحات الزائدة، وشريط الأولوية العام' : 'Independent Stock & Remaining Columns, Cleaner Canex Link UI & Batch Priority Toolbar',
      highlights: [
        {
          icon: '📊',
          text: isAr
            ? 'أعمدة صريحة ومستقلة لكل بيان: (المتاح بالمخزن، المتاح بدلمار، المطلوب، الأولوية والتوزيع، والمتبقي بالمخزن وبدلمار) بخطوط مريحة للعين وتصميم أوسع وأسهل.'
            : 'Independent explicit columns for Warehouse Stock, Delmar Stock, Requested, Priority & Split, and Remaining Balance with larger comfortable font sizes.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'زرار عام لتطبيق الأولوية بنقرة واحدة: شريط تحكم بارز أعلى الجدول لتطبيق أولوية دلمار أولاً أو المستودع أولاً على كافة بنود الإذن دفعة واحدة دون الحاجة لتعديل كل بند على حدة.'
            : '1-Click Batch Priority Toolbar: directly set priority for the entire batch at once.'
        },
        {
          icon: '🎯',
          text: isAr
            ? 'تنظيف اقتراحات كانكس: إزالة صناديق الاقتراحات تماماً عن أي كود معروف أو له رفرنس بالمخزن، وقصرها فقط على البنود غير المعرفة نهائياً.'
            : 'Cleaner Code Linking: fuzzy suggestion boxes removed for known referenced codes, only appearing for truly missing items.'
        }
      ]
    },
    {
      version: 'v2.27.39',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'التحكم الرقمي المباشر في أعواد دلمار، أزرار الأولويات الفورية، والربط المانيوال بكود كانكس' : 'Interactive Delmar Bar Input, 1-Click Priority Controls & Always-Available Canex Code Linking',
      highlights: [
        {
          icon: '🔢',
          text: isAr
            ? 'خانة رقمية تفاعلية لتحديد أعواد دلمار يدوياً: إمكانية كتابة عدد الأعواد المطلوب سحبها من دلمار بدقة، مع احتساب فوري وتلقائي لحصة المستودع والرصيد المتبقي دون أي التباس.'
            : 'Interactive Delmar Bars Input: explicitly type the exact number of bars from Delmar with instant real-time calculation of warehouse balance.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'أزرار أولوية الصرف الفورية: (🏭 دلمار أولاً) لسحب كامل المطلوب من دلمار وحفظ المستودع، و (📦 المستودع أولاً) لصرف المتاح بالمستودع وتغطية الفارق من دلمار، بالإضافة لأزرار الأولوية الجماعية بالبانر العلوي.'
            : '1-Click Priority Controls: (Delmar First) or (Warehouse First) per line and for the entire delivery batch at once.'
        },
        {
          icon: '🔗',
          text: isAr
            ? 'خانة إدخال كود كانكس المانيوال متاحة دائماً لكل سطر: إمكانية كتابة كود كانكس (مثل 515756) وربطه فوراً بكود شوكو (مثل 515750) وحفظه في القاموس للأبد بضغطة زر واحدة.'
            : 'Always-Available Manual Canex Linking: link different codes (e.g. Schuco 515750 to Canex 515756) manually in any row and store permanently in dictionary.'
        }
      ]
    },
    {
      version: 'v2.27.38',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'عمود مخزن دلمار المستقل، تتبع وتأكيد كود العميل، وحساب الرصيد المتبقي بدقة 100%' : 'Dedicated Delmar Column, Customer Code Tracking & Accurate Remaining Stock Calculation',
      highlights: [
        {
          icon: '🏭',
          text: isAr
            ? 'عمود مخصص ومستقل لمخزن دلمار: متاح لكافة البنود (بما فيها الخام MF والدهان RAL) مع زرين صريحين (صرف بالكامل من دلمار لحفظ رصيد المستودع) أو (تغطية العجز فقط)، بالإضافة لأزرار الاعتماد الجماعي العلوية.'
            : 'Dedicated Delmar Warehouse Column: available for all profiles (MF raw & RAL coated) with full Delmar dispatch or shortage coverage, plus batch one-click controls.'
        },
        {
          icon: '🎯',
          text: isAr
            ? 'تتبع وتأكيد كود العميل (Customer Code): إضافة عمود كود العميل في جدول الصرف لمراحل دلمار والتتبع الذكي المشترك لكود الصنف وكود العميل معاً لمنع أي أخطاء في التتبع.'
            : 'Customer Code Tracking: added Customer Code input column in manual dispatch and unified matching on both itemCode and customerCode.'
        },
        {
          icon: '📊',
          text: isAr
            ? 'تفصيل الرصيد والمتبقي بعد الصرف: عرض الرصيد الحالي بالمستودع، المطلوب صرفه، والرصيد المتبقي بعد الصرف بدقة تامة وبدون أي التباس للأرقام أمام الإدارة.'
            : 'Accurate Remaining Stock: crystal-clear breakdown of current warehouse stock, requested quantity, and remaining balance after dispatch.'
        }
      ]
    },
    {
      version: 'v2.27.37',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'تغطية عجز الأعواد من مخزن دلمار، كتابة الكود الصحيح يدوياً، ونقل عمود الأعواد' : 'Delmar Shortage Coverage Prompt, Manual Code Mapping & Column Reordering',
      highlights: [
        {
          icon: '🏭',
          text: isAr
            ? 'سؤال تغطية عجز الأعواد من دلمار: زر واضح ومباشر (✅ أيوه، غطي واصرف الفرق من دلمار) لكل سطر وبشكل جماعي، يحول البند فورياً إلى مغطى بالكامل ويعتمد الصرف بسلاسة.'
            : 'Delmar Shortage Coverage Prompt: direct 1-click button to cover bar shortage from Delmar painted stock without blocking dispatch.'
        },
        {
          icon: '✍️',
          text: isAr
            ? 'خانة إدخال الكود الصحيح يدوياً ورفض الاقتراح: إمكانية رفض أي اقتراح ذكي خاطئ بنقرة واحدة، وخانة مباشرة لكتابة كود الصنف بالمخزن (مثل 515756) وربطه فوراً بالقاموس للأبد.'
            : 'Reject Wrong Suggestion & Manual Code Input: dismiss mismatch suggestions and instantly map the right warehouse profile code inline.'
        },
        {
          icon: '📊',
          text: isAr
            ? 'إعادة ترتيب الجدول: نقل عمود الأعواد (Bars) ليكون مباشرة بعد عمود الوصف لسهولة وسرعة الرؤية والمراجعة دون الحاجة للتمرير.'
            : 'Table Reordering: moved Bars column directly next to Description for instant visibility without scrolling.'
        }
      ]
    },
    {
      version: 'v2.27.36',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'نظام الأكواد المترادفة والبديلة (Item Aliases) والربط الذكي بين أكواد شوكو وكانكس' : 'Item Aliases Dictionary & Smart Match for Schüco vs Canex Discrepancies',
      highlights: [
        {
          icon: '🔗',
          text: isAr
            ? 'قاموس الأكواد المترادفة (Item Aliases Dictionary): ربط دائم بين أكواد شوكو وكانكس (مثل 515750 🔁 515756)، حيث يتعرف عليها السيستم فوراً ويخصم الرصيد تلقائياً دون أي تعديل يدوي.'
            : 'Cross-reference Aliases Dictionary: permanently maps supplier/customer code discrepancies (e.g. 515750 🔁 515756) with automated stock deduction.'
        },
        {
          icon: '💡',
          text: isAr
            ? 'محرك الاقتراح التلقائي الذكي: يكتشف تلقائياً القطاعات المتقاربة رقمياً في المخزن بنقرة واحدة (اختلاف رقم واحد أو تشابه فائق) وزر (⚡ ربط واعتماد دائماً).'
            : 'Automated Smart Suggestion: detects profiles in stock with 1-digit variances or keyword similarity with 1-click Link & Remember.'
        },
        {
          icon: '🎯',
          text: isAr
            ? 'مودال الربط السريع (Link Alias Modal): بحث واختيار سريع لأي صنف مطابق بالمخزن مع خيار تذكر الربط وحفظه في قاموس المشروع للأبد.'
            : 'Interactive Quick Link Modal: search and map any invoice code to an existing warehouse profile with permanent memory.'
        }
      ]
    },
    {
      version: 'v2.27.35',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'احتساب بنود دهان دلمار للتسليم ولوحة قرار المالك للصرف والاستبعاد' : 'Delmar Coating Delivery Calculation & Owner Dispatch Decision Engine',
      highlights: [
        {
          icon: '🏭',
          text: isAr
            ? 'احتساب تلقائي لبنود الدهان التابعة لأمر التسليم (مثل 13 بند بإجمالي 834 عود) وتوثيق تواجدها في (مخزن دلمار بتدهن) وفصلها عن القطاعات الخام.'
            : 'Automated calculation of delivery coating items (e.g. 13 items, 834 bars) allocated to Delmar coating warehouse.'
        },
        {
          icon: '👑',
          text: isAr
            ? 'لوحة قرار المالك: أزرار تحكم سريعة (البنود تبعنا وصرفها من دلمار / ليست تبعنا واستبعاد بنود دلمار) مع تحكم فردي لكل بند بنقرة واحدة.'
            : 'Owner Decision Engine: batch & individual 1-click controls to approve or exclude Delmar coating items from dispatch.'
        },
        {
          icon: '🎨',
          text: isAr
            ? 'اعتماد مصنع دلمار للألومنيوم والدهان رسمياً في قائمة موردي الدهان وسجلات التدقيق والمخازن.'
            : 'Officially registered Delmar Industrial Coating in coating supplier presets and audit records.'
        }
      ]
    },
    {
      version: 'v2.27.34',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'دعم أذون تسليم شوكو (SD) ونظام فحص وتدقيق الرصيد التلقائي قبل الصرف' : 'Schüco SD Delivery Note Parser & Pre-Dispatch Stock Availability Checker',
      highlights: [
        {
          icon: '📦',
          text: isAr
            ? 'دعم أذون تسليم وتعبئة شوكو (Schüco Packing Lists / SD Delivery Notes) واستخراج كافة البنود الـ 16 بالأعواد والأمتار والأوزان والتشطيبات مثل RALY22778SD بنسبة 100%.'
            : 'Full support for Schüco Delivery Notes (SD), extracting 100% of line items with bars, linear meters, weights, and finishes.'
        },
        {
          icon: '🔍',
          text: isAr
            ? 'شريط فحص المخزون والجاهزية التلقائي: مطابقة كل بند في الفاتورة مع رصيد المخزن الحالي وتوضيح المتوفر والعجز وغير المسجل بالألوان والتفاصيل الدقيقة.'
            : 'Automated Pre-Dispatch Stock Checker: matching every invoice line with live warehouse inventory, reporting available, shortage, and missing items.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'حماية أمنية وتنبيه استباقي: منع الصرف بالسالب وحظر الخصم العشوائي إلا بموافقة وتأكيد صريح من المالك عند وجود عجز.'
            : 'Negative stock protection: safeguards against accidental dispatch when shortages exist, requiring explicit user confirmation.'
        }
      ]
    },
    {
      version: 'v2.27.33',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'دعم متقدم لكافة صيغ فواتير الإكسيل، إلزامية أوامر البيع ومراجع العملاء، والتذكر التلقائي لبيانات الصرف' : 'Robust Multi-Format Excel Parsing, Mandatory SO & Customer Ref Validation, and Auto-Fill Last Dispatch',
      highlights: [
        {
          icon: '📊',
          text: isAr
            ? 'دعم فائق لجداول إكسيل المخازن وشحنات شوكو وكانكس بكافة مسميات الأعمدة (Item number, External, Size, Configuration, Warehouse Bars) واستخراج بنودها بنسبة 100%.'
            : 'Comprehensive support for multi-column warehouse spreadsheets and Canex/Schueco shipments with 100% item line extraction.'
        },
        {
          icon: '🔒',
          text: isAr
            ? 'إلزامية إدخال أمر البيع (SO #) ومرجع العميل (Customer Ref) ومنع حفظ أي فاتورة إذا كانا فارغين لتفادي الأخطاء البشرية وسد ثغرات سجل التدقيق.'
            : 'Enforced mandatory Sales Order # and Customer Reference validation preventing incomplete invoice commits.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'التذكر التلقائي لكافة بيانات جهة الدهان والعميل النهائي والموقع في نافذة الصرف دون الحاجة لإعادة كتابتها في كل مرة.'
            : 'Instant auto-fill of coating supplier, customer name, site, and finish from the last dispatch operation.'
        }
      ]
    },
    {
      version: 'v2.27.32',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'إصلاح استثناء إنشاء نقاط الحفظ اليدوية والتلقائية في المخزن' : 'Fix isAuto Parameter Exception in Manual & Auto Restore Points',
      highlights: [
        {
          icon: '🛠️',
          text: isAr
            ? 'حل مشكلة (isAuto is not defined) عند إنشاء نقطة حفظ احتياطية يدوية جديدة وتأمين كافة معاملات الاستدعاء.'
            : 'Fixed isAuto parameter destructuring error when creating manual restore points in the warehouse.'
        },
        {
          icon: '💾',
          text: isAr
            ? 'تمكين حفظ النقاط اليدوية والتلقائية فورياً ومزامنتها بنجاح مع الفلاتر وسجل التدقيق.'
            : 'Enabled seamless immediate creation and synchronization of manual snapshots alongside auto-snapshots.'
        }
      ]
    },
    {
      version: 'v2.27.31',
      date: isAr ? '2 سبتمبر 2026' : 'Sep 2, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'نظام الحفظ الاحتياطي التلقائي (Auto-Snapshots) والتراجع الفوري عن الحركات والفواتير للمالك' : 'Zero-Click Auto Restore Points & Instant Invoice/Movement Rollback System',
      highlights: [
        {
          icon: '🔄',
          text: isAr
            ? 'أخذ نقاط حفظ احتياطي تلقائية وفورية (Auto-Snapshots) لحالة المخزن قبل أي حركة توريد أو صرف (إكسيل أو يدوي).'
            : 'Automatic zero-click restore point snapshots captured before any stock inbound or outbound movement.'
        },
        {
          icon: '👑',
          text: isAr
            ? 'زر تراجع فوري عن الفواتير والحركات للإدارة العليا (الملك جمال) يعكس الكميات في رصيد المخزن ويلغي أثر الحركة بنقرة واحدة.'
            : 'Instant rollback action for Super Admin to undo any invoice transaction and cleanly reverse stock quantities.'
        },
        {
          icon: '📋',
          text: isAr
            ? 'تصفية ذكية لنقاط الحفظ (الكل / تلقائي / يدوي) وتوثيق كامل لكافة عمليات التراجع في سجل التدقيق.'
            : 'Smart restore point filtering (All / Auto / Manual) and full audit trail logging for all rollback actions.'
        }
      ]
    },
    {
      version: 'v2.27.29',
      date: isAr ? '1 سبتمبر 2026' : 'Sep 1, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'صرف الفواتير الواردة بالكامل أو أجزاء منها، تحديد المستودع، وتخصيص صلاحيات الصرف والتوريد' : 'Invoice-Based Bulk/Partial Outbound, Warehouse Picker & Granular Permissions',
      highlights: [
        {
          icon: '🧾',
          text: isAr
            ? 'ميزة استيراد وصرف بنود أي فاتورة واردة سابقة بالكامل بضغطة زر أو تحديد وتعديل كميات بنود معينة منها.'
            : 'Import and dispense all line items of any previous inbound invoice or select/adjust specific lines.'
        },
        {
          icon: '🏢',
          text: isAr
            ? 'إمكانية اختيار وتبديل المستودع/المشروع من أعلى نافذة الصرف والتوريد مباشرة مع جعل اسم العميل واللون اختياريين.'
            : 'Warehouse project picker at the top of modal, with coating supplier as the only required field.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'إضافة أذونات تفصيلية مستقلة في إدارة الصلاحيات لصرف وتتبع مراحل القطاعات والتوريد اليدوي.'
            : 'Fine-grained permissions added in Access Control for manual movements and multi-stage lifecycle dispatches.'
        }
      ]
    },
    {
      version: 'v2.27.28',
      date: isAr ? '1 سبتمبر 2026' : 'Sep 1, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'إضافة التوريد والصرف اليدوي ونظام تتبع مراحل الصرف (دهان ⬅️ عميل نهائي)' : 'Manual Stock Supply, Multi-Stage Outbound & Lifecycle Tracking Pipeline',
      highlights: [
        {
          icon: '📥',
          text: isAr
            ? 'إمكانية التوريد اليدوي المباشر للقطاعات وزيادة رصيد المخزن مع توثيق التكاليف وأوامر الشراء وسجل التدقيق.'
            : 'Direct manual stock supply to increment profiles inventory with full audit trails.'
        },
        {
          icon: '📤',
          text: isAr
            ? 'نظام صرف يدوي ذكي متعدد المراحل لتتبع القطاعات المنصرفة لموردي الدهان والمعالجة الخارجية حتى التسليم النهائي للعميل.'
            : 'Multi-stage manual outbound system tracking profiles sent to coating suppliers through to final delivery.'
        },
        {
          icon: '🚚',
          text: isAr
            ? 'لوحة تتبع بصرية مخصصة لمتابعة الأوامر الجارية لدى الورش والموردين مع إمكانية إغلاق الدورة والتسليم بضغطة زر.'
            : 'Dedicated lifecycle tracker dashboard to monitor orders in coating with one-click final delivery completion.'
        }
      ]
    },
    {
      version: 'v2.27.27',
      date: isAr ? '31 أغسطس 2026' : 'Aug 31, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'توحيد مطابقة عملاء إكسيل وفرض Schema v1.0 لمنع رفض الفواتير' : 'Excel Mapping Parity with Smart Upload & Strict v1.0 Schema Enforcement',
      highlights: [
        {
          icon: '🔄',
          text: isAr
            ? 'تطبيق المطابقة التلقائية لبيانات العملاء applySavedCustomerMatches في مسار مطابقة إكسيل اليدوي بالتطابق الكامل مع مسار الرفع الذكي.'
            : 'Applied automatic saved customer matching in manual Excel Mapping to match Smart Upload behavior.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'فرض إصدار المستند القياسي documentTypeVersion: 1.0 في كافة المسارات لمنع أي رفض من منظومة الضرائب.'
            : 'Enforced documentTypeVersion 1.0 across all parsing and mapping pipelines.'
        }
      ]
    },
    {
      version: 'v2.27.26',
      date: isAr ? '31 أغسطس 2026' : 'Aug 31, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'توحيد منظومة التوقيع الرقمي لمنع رفض الفواتير لعدم وجود توقيع' : 'Universal Digital Signing Pipeline & Strict Pre-Dispatch Validation',
      highlights: [
        {
          icon: '🔑',
          text: isAr
            ? 'توحيد كافة مسارات الإرسال المباشر والمسودات والدفعات عبر أداة signEtaDocuments لضمان وجود توقيع CAdES-BES معتمد.'
            : 'Unified all live submission surfaces (Batch, Drafts, Preview) to use signEtaDocuments guaranteeing valid CAdES-BES token signature.'
        },
        {
          icon: '⏱️',
          text: isAr
            ? 'ضبط ومعايرة التوقيت التلقائي للفواتير normalizeIssueDate لمنع أي تفاوت زمني مع خوادم مصلحة الضرائب.'
            : 'Automatic timestamp normalization to prevent ETA out-of-sync rejection errors.'
        }
      ]
    },
    {
      version: 'v2.27.22',
      date: isAr ? '19 أغسطس 2026' : 'Aug 19, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'تسريع الاستيقاظ ومنع أخطاء التقديم والمحاولة الأولى' : 'Preemptive Server Warm-up, Signer Auto-Wait & Status Check Fixes',
      highlights: [
        {
          icon: '⚡',
          text: isAr
            ? 'إيقاظ السيرفر مبكراً في الخلفية لتفادي بطء الاستيقاظ (Render Cold Start) في أول فاتورة.'
            : 'Preemptive server warm-up on page load to eliminate Render free-tier cold-start delays.'
        },
        {
          icon: '🔑',
          text: isAr
            ? 'انتظار ذكي لأداة التوقيع FawterX-Signer عند فتحها لأول مرة لمنع فشل الاتصال.'
            : 'Smart auto-launch and polling for FawterX Signer desktop tool to prevent connection refused errors.'
        },
        {
          icon: '🛠️',
          text: isAr
            ? 'إصلاح استعلام حالة الفاتورة /api/eta/status وتمرير مفاتيح الربط لمنع ظهور خطأ 500 في السيرفر.'
            : 'Fixed ETA status checking endpoint (/api/eta/status) by supplying custom company credentials.'
        }
      ]
    },
    {
      version: 'v2.27.21',
      date: isAr ? '18 أغسطس 2026' : 'Aug 18, 2026',
      badge: isAr ? '✨ إصدار سابق' : '✨ Previous Release',
      badgeColor: 'rgba(255, 255, 255, 0.1)',
      title: isAr ? 'استعادة ترقيم فواتير شوكو القياسي بالبادئة 202303xxx تلقائياً' : 'Restored Standard Schuco Invoice Number Formatting with 202303xxx Prefix',
      highlights: [
        {
          icon: '🔢',
          text: isAr
            ? 'تطبيق قاعدة الترقيم الدقيقة لفواتير شوكو باستخراج آخر 3 أرقام ودمجها مع 202303xxx.'
            : 'Enforced standard Schuco invoice number normalization taking the last 3 digits prefixed with 202303.'
        },
        {
          icon: '📄',
          text: isAr
            ? 'تحويل الأرقام مثل 000000679 و 679 تلقائياً إلى 202303679 في شاشات المراجعة والرفع.'
            : 'Automatically converted raw invoice numbers (e.g. 000000679) into 202303679 across all batch screens.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'تحديث اختبارات المطابقة البرمجية لضمان عدم حدوث أي تراجع في معالجة الفواتير.'
            : 'Updated test suites to ensure 100% precision in invoice ID extraction.'
        }
      ]
    },
    {
      version: 'v2.27.20',
      date: isAr ? '18 أغسطس 2026' : 'Aug 18, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'حذف الرموز التجريبية القديمة والتحقق التام من التوكنات المسحوبة (Zero-Trust)' : 'Zero-Trust Authentication Hardening & Full Revoked Token Verification',
      highlights: [
        {
          icon: '🛡️',
          text: isAr
            ? 'حذف التوكنات الثابتة والتجريبية القديمة بالكامل لضمان عدم وجود أي منفذ تجاوز.'
            : 'Completely eliminated legacy static/bypass tokens to enforce zero-trust authentication.'
        },
        {
          icon: '🔒',
          text: isAr
            ? 'إلزام الخادم بفحص حالة سحب التوكنات فورياً من جذورها عبر Firebase Auth Server.'
            : 'Enforced live checkRevoked validation guaranteeing immediate session termination.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'تأمين وحماية كاملة لكافة عمليات المخازن ورفع فواتير الضرائب دون المساس بأي وظيفة.'
            : 'Maintained 100% stable, backwards-compatible, rock-solid performance across all features.'
        }
      ]
    },
    {
      version: 'v2.27.19',
      date: isAr ? '18 أغسطس 2026' : 'Aug 18, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'تطبيق حزمة الأمان المصرفية (Bank-Grade Security): تشفير AES-256 والحظر اللحظي' : 'Bank-Grade Security Hardening: AES-256 Encryption & Real-Time Revocation',
      highlights: [
        {
          icon: '🔐',
          text: isAr
            ? 'تشفير أسرار ومفاتيح الضرائب في قاعدة البيانات بخوارزمية التشفير العسكري AES-256-GCM.'
            : 'Encrypted ETA client secrets at rest in Firestore using military-grade AES-256-GCM.'
        },
        {
          icon: '🚫',
          text: isAr
            ? 'تطبيق الحظر اللحظي الصارم (Instant Revocation) لطرد أي حساب موقوف فوراً في أجزاء من الثانية.'
            : 'Enforced sub-second instant revocation kicking out suspended/blocked accounts in real-time.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'تطهير وتعقيم ملفات الإكسيل لمنع هجمات حقن المعادلات الخبيثة (Anti-Formula Injection).'
            : 'Sanitized Excel and spreadsheet cells against dangerous formula injection and DDE payloads.'
        }
      ]
    },
    {
      version: 'v2.27.18',
      date: isAr ? '18 أغسطس 2026' : 'Aug 18, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إغلاق شامل لجميع الثغرات الأمنية المشابهة وإحكام صلاحيات التوكن والمشاريع' : 'Comprehensive Security Hardening & Cryptographic Token Verification',
      highlights: [
        {
          icon: '🔒',
          text: isAr
            ? 'إلزام الخادم بالتحقق المشفر الحصري من Firebase ID Token وإلغاء أي فك تشفير غير موثق.'
            : 'Enforced strict cryptographic verification for all Firebase ID Tokens, removing insecure fallback decoding.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'تطبيق جدار حماية للمشاريع (Project ACL) يمنع الوصول لأي مشروع غير مخصص للمستخدم.'
            : 'Enforced project-level access control lists (ACL) preventing unauthorized cross-project data access.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'إحكام الصلاحيات التفصيلية لعمليات الرفع والتعديل والحذف واستعادة النسخ الاحتياطية.'
            : 'Enforced granular RBAC for all warehouse mutations, file uploads, and restore point operations.'
        }
      ]
    },
    {
      version: 'v2.27.17',
      date: isAr ? '18 أغسطس 2026' : 'Aug 18, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إصلاح وحزم حظر صلاحيات المخزن فورياً مع الحفظ التلقائي الصارم' : 'Instant Warehouse Access Revocation & Auto-Save Enforcement',
      highlights: [
        {
          icon: '🛡️',
          text: isAr
            ? 'تطبيق الحفظ الفوري التلقائي (Auto-Save) عند تبديل مفتاح السماح بالوصول في بطاقات المستخدمين.'
            : 'Enforced instant auto-save upon toggling warehouse access switches with immediate toast feedback.'
        },
        {
          icon: '🚫',
          text: isAr
            ? 'إلزام الخادم برفض أي مستخدم تم إلغاء صلاحية المخزن له فورياً وإيقاف أي صلاحيات تجاوز قديمة.'
            : 'Hardened backend permission checks to strictly deny access when warehouseEnabled is false.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'إضافة فحص أمان تلقائي عند فتح صفحة المخازن لطرد أي مستخدم تم سحب صلاحيته فوراً.'
            : 'Added live mount verification kicking unauthorized users back to the home page immediately.'
        }
      ]
    },
    {
      version: 'v2.27.16',
      date: isAr ? '18 أغسطس 2026' : 'Aug 18, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إيقاف خاصية التحقق بخطوتين (2FA) مؤقتاً لتسهيل وتسريع تسجيل الدخول' : 'Temporarily Paused 2FA for Direct Login Access',
      highlights: [
        {
          icon: '🔓',
          text: isAr
            ? 'تعطيل نوافذ حظر الأجهزة الجديدة وإيقاف طلب رموز التحقق مؤقتاً لتسريع الوصول للمنصة.'
            : 'Temporarily disabled new device verification prompts for direct, uninterrupted sign in.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'تسجيل الدخول المباشر والسريع لجميع الحسابات بدون أي شاشات توقف.'
            : 'Immediate access to dashboard upon Google sign-in without security challenge modals.'
        }
      ]
    },
    {
      version: 'v2.27.15',
      date: isAr ? '18 أغسطس 2026' : 'Aug 18, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'تطبيق التحقق بخطوتين عبر Google Authenticator (TOTP) بدون سيرفرات بريد' : 'Google Authenticator (TOTP) 2FA Implementation',
      highlights: [
        {
          icon: '📱',
          text: isAr
            ? 'تطبيق المصادقة الثنائية القياسية عبر تطبيق Google Authenticator برمز QR ممسوح عبر الهاتف ومفتاح احتياطي.'
            : 'Enforced RFC 6238 TOTP 2FA via Google Authenticator with QR scan and manual secret fallback.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'عمل النظام ذاتياً وفورياً بدون أي اعتماد على سيرفرات البريد الإلكتروني أو تأخر رسائل الـ OTP.'
            : 'Zero email/SMTP dependencies with instant offline code verification changing every 30 seconds.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'نافذة زمنية مرنة وتوثيق تلقائي للأجهزة المعتمدة بعد تأكيد الرمز الأول بنجاح.'
            : 'Clock drift tolerance window with automatic device trust registration upon initial verification.'
        }
      ]
    },
    {
      version: 'v2.27.14',
      date: isAr ? '18 أغسطس 2026' : 'Aug 18, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'تأمين التحقق بخطوتين عبر البريد الإلكتروني (2FA Email OTP Security)' : 'Secure 2FA Email OTP Verification System',
      highlights: [
        {
          icon: '🛡️',
          text: isAr
            ? 'تطبيق نظام التحقق الأمني الاحترافي بإرسال رمز الـ OTP المكون من 6 أرقام إلى البريد الإلكتروني المعتمد فقط بدلاً من عرضه في الواجهة.'
            : 'Enforced real secure 2FA by delivering 6-digit OTP codes directly to registered email.'
        },
        {
          icon: '🔒',
          text: isAr
            ? 'حذف وإخفاء الرمز الأمني نهائياً من الـ API وواجهة المستخدم لمنع أي تسريب أمني.'
            : 'Completely eliminated security PIN leaks from backend API responses and UI modals.'
        },
        {
          icon: '⏱️',
          text: isAr
            ? 'إضافة زر إعادة إرسال الرمز مع مؤقت زمني (60 ثانية) وحماية متقدمة ضد هجمات التخمين.'
            : 'Added resend OTP button with 60s cooldown timer and brute-force attempt limits.'
        }
      ]
    },
    {
      version: 'v2.27.8',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إصلاح شامل لدليل الخطوات العام ولوحة الإدارة مع الدخول السريع' : 'Global Step Guide Modal Fix & Admin Panel Access Resilience',
      highlights: [
        {
          icon: '💡',
          text: isAr
            ? 'جعل "دليل الخطوات" نافذة عائمة عامة تعمل من أي صفحة وفي كل الأوقات.'
            : 'Converted Step Guide to a global modal available from all routes.'
        },
        {
          icon: '👑',
          text: isAr
            ? 'تحديث صلاحيات السيرفر والدخول السريع لمنح حساب المدير الرئيسي الوصول الكامل للوحة الإدارة بدون أخطاء.'
            : 'Updated server authorization & quick login bypass for full admin panel access.'
        }
      ]
    },
    {
      version: 'v2.27.7',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إصلاح شامل لاستعادة السجل الكامل للبنود ودعم موثوقية لوحة الإدارة' : 'Full Item Movement Restoration & Admin Panel Auth Resilience',
      highlights: [
        {
          icon: '📜',
          text: isAr
            ? 'حفظ واستعادة سجل حركات التتبع تفصيلياً مع نقاط الحفظ، وتوفير حركة افتراضية تلقائية للبنود المستعادة ضماناً لعدم ضياع السجل.'
            : 'Preserved full movement history in restore points, providing automatic synthetic initial movements for restored stock items.'
        },
        {
          icon: '🔐',
          text: isAr
            ? 'إضافة فك تشفير JWT احتياطي في برمجيات التحقق لضمان فتح لوحة الإدارة بدون أخطاء.'
            : 'Added JWT payload decode fallback in auth middleware guaranteeing instant access to the Admin Panel.'
        }
      ]
    },
    {
      version: 'v2.27.6',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إصلاح دقيق لاستعادة نقاط الحفظ: تنظيف سجل المحذوفات واسترجاع الأصناف المحذوفة بنجاح' : 'Warehouse Restore Fix: Cleared Deleted Items Registry & Guaranteed Full Stock Snapshot Recovery',
      highlights: [
        {
          icon: '✨',
          text: isAr
            ? 'إصلاح آلية استعادة نقاط الحفظ للمشروع في المخزن وتفريغ سجل الأصناف المحذوفة لضمان عودة كافة البنود المحذوفة فوراً عند الاستعادة.'
            : 'Fixed project restore point mechanism by clearing deletedStock registry, ensuring all previously deleted inventory items are fully restored.'
        }
      ]
    },
    {
      version: 'v2.27.5',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إصلاح لوحة التحكم الإدارية: حل خليل استدعاء الدالة واستعادة جلب البيانات كاملة' : 'Admin Panel Fix: Resolved Middleware Reference Error & Restored Full Data Loading',
      highlights: [
        {
          icon: '✨',
          text: isAr
            ? 'إصلاح استدعاء دالة التحقق من البريد الإلكتروني للآدمن في مسارات الإدارة بالنظام الخلفي، واستعادة تحميل المستخدمين والإحصائيات بنسبة 100%.'
            : 'Fixed admin access check reference error in backend routes and completely restored Admin Panel user list and metrics data fetching.'
        }
      ]
    },
    {
      version: 'v2.27.4',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'تحسين إدارة صلاحيات المخزن: ترتيب الأولوية، البحث السريع، والواجهة المدمجة' : 'Warehouse Access Control UI: Smart Search, Accordion View & Priority Sorting',
      highlights: [
        {
          icon: '✨',
          text: isAr
            ? 'ترتيب ظهور الإيميلات بأولوية Super Admin ثم المستخدمين المُمكّنين، وإضافة شريط بحث سريع وتقليص القائمة بتصميم آكورديون مدمج.'
            : 'Prioritized Super Admin and enabled users, added fast live email search, and converted items into a compact collapsible accordion UI.'
        }
      ]
    },
    {
      version: 'v2.27.3',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إصلاح لوحة الأدمن: ضمان تصريحات الإدارة المحمية وجلب المستخدمين بدون أخطاء' : 'Admin Panel Fix: Fortified Admin Authorization & Resilient Data Fetching',
      highlights: [
        {
          icon: '✨',
          text: isAr
            ? 'إصلاح مشكلة عدم تحميل بيانات لوحة الإدارة وإضافة التأمين الصارم لحساب الأدمن الرئيسي وضمان إظهار الإحصائيات والقائمة بشكل سليم 100%.'
            : 'Resolved admin panel loading failure, fortified admin authorization checks, and ensured accurate user metrics rendering.'
        }
      ]
    },
    {
      version: 'v2.27.3',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إصلاح إشعار المسودات: إلغاء التنبيه العشوائي عند خلو المسودات' : 'Drafts Fetch Fix: Silent clean loading on empty drafts state',
      highlights: [
        {
          icon: '✨',
          text: isAr
            ? 'منع ظهور إشعار الخطأ (فشل جلب المسودات) عند فتح الصفحة وهي فارغة وعرض الواجهة النظيفة فوراً.'
            : 'Eliminated unnecessary error toast when navigating to empty drafts page, cleanly displaying zero state.'
        }
      ]
    },
    {
      version: 'v2.27.2',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'تحديث المصطلحات: استبدال جميع مسميات (أتمتة) بمسمى (رفع الفواتير)' : 'Terminology Refinement: Replacing Automation with Upload Wording',
      highlights: [
        {
          icon: '✨',
          text: isAr
            ? 'تعديل جميع العناوين والنصوص بالواجهة واستبدال كلمة "أتمتة" بكلمة "رفع الفواتير" لتقديم تجربة استخدام أوضح ومباشرة.'
            : 'Replaced all "Automation" terminology in UI titles and text with direct "Invoice Upload" wording for clearer user experience.'
        }
      ]
    },
    {
      version: 'v2.27.1',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'التحصين الأمني الشامل، تفعيل 2FA للأجهزة الجديدة، وعزل خصوصية المسودات' : 'Enterprise Security Hardening, New Device 2FA & Privacy Isolation',
      highlights: [
        {
          icon: '🛡️',
          text: isAr
            ? 'تفعيل التوثيق الثنائي (2FA Device Verification): التحقق التلقائي من بصمة الجهاز عند تسجيل الدخول وإلزام تأكيد رمز الأمان المكون من 6 أرقام للأجهزة الجديدة.'
            : 'New Device 2FA Security: Automatic device fingerprint verification prompting a 6-digit 2FA security code challenge on new device logins.'
        },
        {
          icon: '🔒',
          text: isAr
            ? 'خصوصية المسودات المطلقة (Recovery Drafts Privacy Isolation): عزل مسودات كل حساب تماماً وتطبيق سياسة البيانات الدنيا (رقم الفاتورة + المبلغ + الحالة + تفاصيل الخطأ فقط).'
            : 'Minimal Privacy Draft Retention: Strict per-user Firestore isolation storing only essential metadata (Invoice ID, Amount, Status, and Error message if failed).'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'تأمين الباك إند (Helmet & Rate Limiting): تفعيل هيدرز التشفير الحصينة وحماية السيرفر من هجمات الإغراق (DDoS & Brute Force) وتحديد نطاق CORS.'
            : 'Backend Fortification: Enforced Helmet HTTP security headers, CORS origin lockdown, and strict API rate limiting.'
        }
      ]
    },
    {
      version: 'v2.27.0',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'إصلاح جذر الحذف الدائم لمشاريع المخازن ومنع إعادة إنشائها' : 'Permanent Warehouse Project Deletion Fix & Auto-Resurrection Elimination',
      highlights: [
        {
          icon: '🗑️',
          text: isAr
            ? 'منع التخريب التلقائي (Auto-Resurrection Fix): إلغاء خوارزمية إعادة إنشاء المشروع الافتراضي تلقائياً عند وجود مشاريع أخرى بالم مخزن، وتصفية كافة السجلات المكررة فورياً.'
            : 'Eliminated Auto-Resurrection Logic: Prevented backend from force-recreating default stock projects when other projects exist, ensuring permanent Firestore deletion.'
        },
        {
          icon: '⚡',
          text: isAr
            ? 'مزامنة الحالة المباشرة بالواجهة: تحديث تصفية المشاريع في واجهة المستخدم (ID & Code filtering) لضمان عدم ظهور المشروع المحذوف فور الضغط على تأكيد الحذف.'
            : 'Instant UI State Sync: Filter deleted projects by ID and Code in real-time, eliminating ghost items upon deletion confirmation.'
        }
      ]
    },
    {
      version: 'v2.26.6',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'ترقية تصميم الماستر أدمن بأيقونات ورموز وشعارات متحركة فاخرة' : 'Ultra-Premium Master GM Animated Badge & Glowing Avatar System',
      highlights: [
        {
          icon: '👑',
          text: isAr
            ? 'شارات Master GM الذهبية المتحركة: إضافة تأثير التوهج والبريق الذهبي (Shimmer Effect) مع تحريك عابر للضوء في القائمة العلوية وشعار الحساب المؤسس.'
            : 'Shimmering Metallic Gold Badge: Animated gold gradient shimmer with light-sweep keyframes and glowing halo effect for Master GM founder profile.'
        },
        {
          icon: '✨',
          text: isAr
            ? 'تحريك الأيقونة والهالة التفاعلية: تحريك التاج (Crown Float Animation) مع هالة ضوئية ذهبية متناغمة حول صورة المؤسس الرئيسية.'
            : 'Floating Crown & Halo Pulse: Micro-animations featuring floating crown physics and breathing gold halo around founder avatar.'
        }
      ]
    },
    {
      version: 'v2.26.5',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      badge: isAr ? 'سابق' : 'Previous',
      badgeColor: '#8ab4ff',
      title: isAr ? 'تفعيل النافذة المنبثقة التفاعلية لسجل التحديثات والإصدارات' : 'Interactive Release Notes Modal & Platform Version Transparency',
      highlights: [
        {
          icon: '🚀',
          text: isAr
            ? 'مكون سجل الاصدارات المباشر (ReleaseNotesModal): إمكانية فتح سجل التحديثات والتطورات فوراً عند الضغط على شارة الإصدار والسلوجان بأعلى المنصة.'
            : 'Interactive Release History Modal: Instant popup showcasing complete release logs and features when clicking the version badge or slogan.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'سلوجان الاعتماد الدائم: تثبيت السلوجان التسويقي المعتمد بشارة خضراء وتنسيق تفاعلي يتيح التصفح بكل سهولة.'
            : 'Certified Platform Slogan Badge: Permanent green badge branding for privacy and instant transparency.'
        }
      ]
    },
    {
      version: 'v2.26.3',
      date: isAr ? '11 أغسطس 2026' : 'Aug 11, 2026',
      title: isAr ? 'تأمين الحساب المؤسس وحصانة الصلاحيات الإدارية' : 'Super Admin Protection & Role Management Flexibility',
      highlights: [
        {
          icon: '⚡',
          text: isAr
            ? 'حصانة العملاق المؤسس (Super Admin): حماية حساب المؤسس الرئيسي (gemy.essam.ge@gmail.com) بشارة خاصة، وتثبيت كافة صلاحيات الإدارة بشكل دائم ومنع أي سحب أو تقييد لها.'
            : 'Founding Super Admin Lockdown: Permanently protect the founder account (gemy.essam.ge@gmail.com) with dedicated Super Admin privileges that cannot be altered or restricted.'
        },
        {
          icon: '⚙️',
          text: isAr
            ? 'مرونة إعادة تعيين الأدوار للمديرين: تمكين الأدمن من تعديل وتخصيص صلاحيات وأدوار المديرين والمشغلين الآخرين بكل سهولة دون تجميد القوائم.'
            : 'Admin Role Flexibility: Full capability to adjust, demote, or customize permissions for other admin and operator accounts.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'سلوجان الرفع الموحد: اعتماد شارة السلوجان الموحدة للمنصة لضمان السرية والاحترافية.'
            : 'Unified Automation Slogan: Implemented permanent slogan badge for brand consistency and privacy.'
        }
      ]
    },
    {
      version: 'v2.26.2',
      date: isAr ? '10 أغسطس 2026' : 'Aug 10, 2026',
      title: isAr ? 'نظام صلاحيات المشاريع ودعم معادلات إكسيل التفاعلية' : 'Granular Warehouse Permissions & Dynamic Excel Subtotals',
      highlights: [
        {
          icon: '📂',
          text: isAr
            ? 'صلاحيات وصول المشاريع (allowedProjects): تخصيص المشاريع المسموح بكل مستخدم الوصول إليها بالمخزن بشكل منفصل.'
            : 'Project Scope Permissions: Assign specific warehouse projects or full access to individual users.'
        },
        {
          icon: '🛡️',
          text: isAr
            ? 'التحكم التفصيلي في العمليات (canDelete, canEdit, canUpload): منح أو سحب صلاحية الحذف، التعديل، أو رفع الفواتير لكل مشغل.'
            : 'Granular Operation Rights: Precise toggles for deletion, quantity edits, and invoice uploading.'
        },
        {
          icon: '🧮',
          text: isAr
            ? 'معادلات SUBTOTAL التفاعلية: تصدير إجماليات الإكسيل بدالة =SUBTOTAL(9, J2:J18) للتجاوب الفوري مع الفلاتر وتصفية الجدول.'
            : 'Dynamic Excel Formulas: Export invoice totals using =SUBTOTAL(9, J2:J18) for instant filter reactivity.'
        },
        {
          icon: '🎨',
          text: isAr
            ? 'تحسين مظهر إدارة المشاريع: تصميم أزرار حذف المشاريع بشكل متناسق ومصغر (🗑️ حذف).'
            : 'Streamlined Project Deletion UI: Compact and clean design for project deletion actions.'
        }
      ]
    },
    {
      version: 'v2.26.1',
      date: isAr ? '9 أغسطس 2026' : 'Aug 9, 2026',
      title: isAr ? 'طابور معالجة الفواتير الجماعية المستقر' : 'Batch Invoice Processing Queue & Parity',
      highlights: [
        {
          icon: '🔄',
          text: isAr
            ? 'معالجة تسلسليّة للمجموعات الكبيرة: رفع عشرات ومئات الفواتير في دفعة واحدة وتسجيلها دون مفقودات.'
            : 'Sequential Batch Processing: Reliable upload and persistence of large multi-invoice batches.'
        },
        {
          icon: '🔍',
          text: isAr
            ? 'اكتشاف وتجنب التصادمات: التحقق الذكي من الفواتير المكررة لضمان عدم إعاقة بقية عناصر الدفعة.'
            : 'Duplication Collision Shield: Prevents duplicate invoice numbers from halting batch imports.'
        }
      ]
    },
    {
      version: 'v2.26.0',
      date: isAr ? '5 أغسطس 2026' : 'Aug 5, 2026',
      title: isAr ? 'إدارة حركة الخصم والإضافة للمخزون' : 'Inbound & Outbound Stock Movement Management',
      highlights: [
        {
          icon: '📦',
          text: isAr
            ? 'دعم الخصم الصادر (Outbound Stock): إمكانية إجراء عمليات سحب وخصم من أرصدة المخزون وحساب الصافي تلقائياً.'
            : 'Outbound Deduction Support: Deduct items from stock with automated net balance recalculation.'
        },
        {
          icon: '📊',
          text: isAr
            ? 'مؤشرات الأداء التفاعلية: عرض الرصيد الإجمالي وحركات التوريد والخصم في لوحة تحكم واحدة.'
            : 'Real-Time Inventory Dashboards: Unified view of stock levels, additions, and deductions.'
        }
      ]
    },
    {
      version: 'v2.25.0',
      date: isAr ? '28 يوليو 2026' : 'Aug 28, 2026',
      title: isAr ? 'محرك تصفية ملخصات الإكسيل والضرائب' : 'Smart Excel Summary Row Filter & Tax Recalculator',
      highlights: [
        {
          icon: '📑',
          text: isAr
            ? 'استبعاد صفوف الإجماليات تلقائياً: تصفية صفوف Footer الملخصة لعدم تكرار البنود بالمنظومة الضريبية.'
            : 'Automated Summary Row Filter: Strips footer summary rows to maintain exact tax line accuracy.'
        }
      ]
    }
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justify: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.25s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #13172d 0%, #0d1021 100%)',
          border: '1px solid rgba(138, 180, 255, 0.2)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 224, 161, 0.1)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#ffffff',
          direction: isAr ? 'rtl' : 'ltr'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(0, 224, 161, 0.15)',
                border: '1px solid rgba(0, 224, 161, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
                color: '#00e0a1'
              }}
            >
              🚀
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                {isAr ? 'سجل التحديثات والإصدارات ✨' : 'Release History & Changelog ✨'}
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #8ab4ff)' }}>
                {isAr ? 'تطورات المنصة ومميزات الاصدارات' : 'Platform updates & release notes history'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                background: 'rgba(0, 224, 161, 0.15)',
                color: '#00e0a1',
                border: '1px solid rgba(0, 224, 161, 0.3)',
                padding: '0.25rem 0.65rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 700
              }}
            >
              v{packageInfo.version} {isAr ? 'النسخة الحالية' : 'Active'}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: 700,
                transition: 'all 0.2s ease'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Slogan Banner */}
        <div
          style={{
            margin: '1.25rem 1.5rem 0.5rem 1.5rem',
            padding: '1rem 1.25rem',
            borderRadius: '14px',
            background: 'linear-gradient(90deg, rgba(0, 224, 161, 0.08) 0%, rgba(66, 133, 244, 0.08) 100%)',
            border: '1px solid rgba(0, 224, 161, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div style={{ fontSize: '1.6rem' }}>⚡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#00e0a1' }}>
              {isAr ? 'منصة رفع الفواتير الرقمية المعتمدة' : 'Certified ETA Invoice Automation Platform'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.15rem' }}>
              {isAr
                ? 'تحديثات مستمرة وتطوير متواصل لبنية فاوتر إكس لتحقيق الامتثال الضريبي الكامل بأعلى كفاءة.'
                : 'Continuous development and enterprise security for 100% tax compliance automation.'}
            </div>
          </div>
        </div>

        {/* Modal Body Scroll List */}
        <div
          style={{
            padding: '1rem 1.5rem 1.5rem 1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          {releaseHistory.map((rel, idx) => (
            <div
              key={rel.version}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: rel.badgeColor
                  ? `1px solid ${rel.badgeColor}40`
                  : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '14px',
                padding: '1.15rem',
                transition: 'all 0.2s ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span
                    style={{
                      background: rel.badgeColor || 'rgba(138, 180, 255, 0.15)',
                      color: rel.badgeColor ? '#000000' : '#8ab4ff',
                      fontWeight: 800,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem'
                    }}
                  >
                    {rel.version}
                  </span>
                  {rel.badge && (
                    <span
                      style={{
                        background: 'rgba(0, 224, 161, 0.15)',
                        color: '#00e0a1',
                        border: '1px solid rgba(0, 224, 161, 0.3)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700
                      }}
                    >
                      {rel.badge}
                    </span>
                  )}
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                    {rel.title}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #8ab4ff)' }}>
                  🗓️ {rel.date}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {rel.highlights.map((h, hIdx) => (
                  <div
                    key={hIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                      fontSize: '0.83rem',
                      lineHeight: '1.45',
                      color: 'rgba(255, 255, 255, 0.88)'
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', marginTop: '0.1rem' }}>{h.icon}</span>
                    <span>{h.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.9rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center'
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #8ab4ff)' }}>
            {isAr ? 'نظام فاوتر إكس المعتمد للرفع الضريبية' : 'FawterX Certified Automation System'}
          </span>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{
              padding: '0.35rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: '8px'
            }}
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
