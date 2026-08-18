import React from 'react'

export default function ReleaseNotesModal({ isOpen, onClose, lang = 'ar' }) {
  if (!isOpen) return null

  const isAr = lang === 'ar'

  const releaseHistory = [
    {
      version: 'v2.27.16',
      date: isAr ? '18 أغسطس 2026' : 'Aug 18, 2026',
      badge: isAr ? '✨ التحديث الأحدث' : '✨ Latest Release',
      badgeColor: '#00e0a1',
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
              v2.27.16 {isAr ? 'النسخة الحالية' : 'Active'}
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
