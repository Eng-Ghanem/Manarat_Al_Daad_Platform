import i18n from '../i18n';

export const getDirectImageUrl = (url) => {
  if (!url) return '';
  try {
    // Check for standard drive link: https://drive.google.com/file/d/XYZ/view
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
    }
    // Check for alternative drive link: https://drive.google.com/open?id=XYZ
    const driveIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (url.includes('drive.google.com') && driveIdMatch && driveIdMatch[1]) {
       return `https://drive.google.com/uc?export=view&id=${driveIdMatch[1]}`;
    }
  } catch (e) {
    console.error("Error parsing image URL:", e);
  }
  return url;
};

export const calculateSubscriptionStatus = (subscription, accessDurationDays) => {
  const isEn = i18n.language === 'en';

  if (!subscription) {
    return {
      isSubscribed: false,
      status: 'none',
      isActive: false,
      isPending: false,
      isExpired: false,
      statusText: isEn ? 'Not Subscribed' : 'غير مشترك'
    };
  }

  if (subscription.status === 'rejected') {
    return {
      isSubscribed: false,
      status: 'rejected',
      isActive: false,
      isPending: false,
      isExpired: false,
      statusText: isEn ? 'Rejected' : 'طلب مرفوض'
    };
  }

  if (subscription.status === 'pending') {
    return {
      isSubscribed: false,
      status: 'pending',
      isActive: false,
      isPending: true,
      isExpired: false,
      statusText: isEn ? 'Pending Review' : 'قيد المراجعة'
    };
  }

  if (subscription.status === 'expired') {
    return {
      isSubscribed: false,
      status: 'expired',
      isActive: false,
      isPending: false,
      isExpired: true,
      statusText: isEn ? 'Expired' : 'منتهي الصلاحية'
    };
  }

  // Active status - check validity duration
  const duration = accessDurationDays !== undefined && accessDurationDays !== null ? Number(accessDurationDays) : null;
  
  if (!duration && !subscription.expires_at) {
    return {
      isSubscribed: true,
      status: 'active',
      isActive: true,
      isPending: false,
      isExpired: false,
      isLifetime: true,
      statusText: isEn ? 'Active (Lifetime)' : 'ساري (مدى الحياة)'
    };
  }

  let expiryDate;
  if (subscription.expires_at) {
    expiryDate = new Date(subscription.expires_at);
  } else {
    const createdDate = new Date(subscription.created_at || Date.now());
    expiryDate = new Date(createdDate.getTime() + duration * 24 * 60 * 60 * 1000);
  }

  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isSubscribed: false,
      status: 'expired',
      isActive: false,
      isPending: false,
      isExpired: true,
      expiryDate,
      statusText: isEn ? 'Expired' : 'منتهي الصلاحية'
    };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let statusText = isEn ? `${diffDays} days remaining` : `متبقي ${diffDays} يوم`;
  if (diffDays === 1) {
    if (diffHours > 12) {
      statusText = isEn ? '1 day remaining' : 'متبقي يوم واحد';
    } else if (diffHours > 1) {
      statusText = isEn ? `${diffHours} hours remaining` : `متبقي ${diffHours} ساعة`;
    } else {
      statusText = isEn ? 'Less than an hour remaining' : 'متبقي أقل من ساعة';
    }
  } else if (diffDays === 2) {
    statusText = isEn ? '2 days remaining' : 'متبقي يومان';
  } else if (!isEn && diffDays >= 3 && diffDays <= 10) {
    statusText = `متبقي ${diffDays} أيام`;
  }

  return {
    isSubscribed: true,
    status: 'active',
    isActive: true,
    isPending: false,
    isExpired: false,
    expiryDate,
    remainingDays: diffDays,
    remainingHours: diffHours,
    isExpiringSoon: diffDays <= 3,
    statusText
  };
};

export const GRADE_OPTIONS = [
  { value: 'primary_1', label: 'الصف الأول الابتدائي' },
  { value: 'primary_2', label: 'الصف الثاني الابتدائي' },
  { value: 'primary_3', label: 'الصف الثالث الابتدائي' },
  { value: 'primary_4', label: 'الصف الرابع الابتدائي' },
  { value: 'primary_5', label: 'الصف الخامس الابتدائي' },
  { value: 'primary_6', label: 'الصف السادس الابتدائي' },
  { value: 'prep_1', label: 'الصف الأول الإعدادي' },
  { value: 'prep_2', label: 'الصف الثاني الإعدادي' },
  { value: 'prep_3', label: 'الصف الثالث الإعدادي' },
  { value: 'sec_1', label: 'الصف الأول الثانوي' },
  { value: 'sec_2', label: 'الصف الثاني الثانوي' },
  { value: 'sec_3', label: 'الصف الثالث الثانوي' },
  { value: 'parent', label: 'ولي أمر' },
];

export const formatGradeName = (grade) => {
  if (!grade) return i18n.t('review_student_badge') || 'طالب في المنصة';
  if (grade === 'parent') return i18n.t('review_grade_parent') || 'ولي أمر';
  const key = `grade_${grade}`;
  const translated = i18n.t(key);
  if (translated && translated !== key) return translated;
  const found = GRADE_OPTIONS.find(g => g.value === grade || g.label === grade);
  return found ? (i18n.language === 'en' ? (i18n.t(`grade_${found.value}`) || found.label) : found.label) : grade;
};

export const formatQuizTitle = (title) => {
  if (!title) return '';
  if (i18n.language !== 'en') return title;
  return title
    .replace(/^امتحان\s*(\d+)/i, 'Quiz $1')
    .replace(/^امتحان\s*شامل/i, 'Comprehensive Quiz')
    .replace(/^امتحان\s*تجريبي/i, 'Practice Quiz')
    .replace(/^امتحان\s*شهري/i, 'Monthly Quiz')
    .replace(/^امتحان\s*أسبوعي/i, 'Weekly Quiz')
    .replace(/^امتحان\s*/i, 'Quiz - ')
    .replace(/^اختبار\s*(\d+)/i, 'Test $1')
    .replace(/^اختبار\s*/i, 'Test - ');
};

export const formatSessionTitle = (title) => {
  if (!title) return '';
  if (i18n.language !== 'en') return title;
  return title
    .replace(/^حص[ةه]\s*(\d+)/i, 'Session $1')
    .replace(/^مراجعة\s*(\d+)/i, 'Revision $1')
    .replace(/^مراجعة\s*شاملة/i, 'Comprehensive Revision')
    .replace(/^مراجعة\s*/i, 'Revision - ')
    .replace(/^حص[ةه]\s*/i, 'Session - ');
};

export const formatSessionDesc = (desc) => {
  if (!desc) return '';
  if (i18n.language !== 'en') return desc;
  const trimmed = desc.trim();
  const titleMatch = trimmed.match(/^حص[ةه]\s*(\d+)/i);
  if (titleMatch) return `Live Interactive Session ${titleMatch[1]}`;
  if (trimmed === 'حصه' || trimmed === 'حصة') return 'Live Interactive Session';
  return formatSessionTitle(desc);
};

export const formatCourseTitle = (title) => {
  if (!title) return '';
  if (i18n.language !== 'en') return title;
  const trimmed = title.trim();
  if (trimmed === 'كورس النحو' || trimmed === 'النحو') return 'Arabic Grammar Course';
  if (trimmed === 'كورس البلاغة' || trimmed === 'البلاغة') return 'Arabic Rhetoric Course';
  if (trimmed === 'كورس الإملاء' || trimmed === 'كورس الاملاء' || trimmed === 'الإملاء' || trimmed === 'الاملاء') return 'Arabic Dictation & Spelling Course';
  if (trimmed === 'كورس التأسيس' || trimmed === 'كورس التأسيس الشامل' || trimmed === 'تأسيس شامل') return 'Comprehensive Foundation Course';
  if (trimmed === 'كورس الأدب' || trimmed === 'الأدب') return 'Arabic Literature Course';
  if (trimmed === 'كورس النصوص' || trimmed === 'النصوص') return 'Arabic Texts Course';
  if (trimmed === 'كورس القراءة' || trimmed === 'القراءة') return 'Arabic Reading Course';
  
  return trimmed
    .replace(/^كورس\s*النحو\s*/i, 'Arabic Grammar Course - ')
    .replace(/^كورس\s*البلاغة\s*/i, 'Arabic Rhetoric Course - ')
    .replace(/^كورس\s*الإملاء\s*/i, 'Arabic Dictation Course - ')
    .replace(/^كورس\s*/i, 'Course - ');
};

export const formatCourseDescription = (description, courseTitle) => {
  if (!description) return '';
  if (i18n.language !== 'en') return description;
  const trimmed = description.trim();
  if (trimmed === 'كورس النحو' || trimmed === 'النحو') {
    return 'Comprehensive Arabic Grammar Foundation Course with Mr. Sayed Gharieb to build strong linguistic skills.';
  }
  if (trimmed === 'كورس البلاغة' || trimmed === 'البلاغة') {
    return 'Comprehensive Arabic Rhetoric Foundation Course covering aesthetics, metaphors, and eloquence.';
  }
  if (trimmed === 'كورس الإملاء' || trimmed === 'كورس الاملاء' || trimmed === 'الإملاء' || trimmed === 'الاملاء') {
    return 'Essential Arabic Spelling and Dictation Course to master writing rules without errors.';
  }
  return description;
};

export const formatTime12h = (timeStr, isRTL = true) => {
  if (!timeStr) return '';
  const str = timeStr.toString().trim();
  const parts = str.split(':');
  if (parts.length < 2) return str;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1].padStart(2, '0');
  if (isNaN(hour)) return str;
  const isPM = hour >= 12;
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const period = isRTL ? (isPM ? 'م' : 'ص') : (isPM ? 'PM' : 'AM');
  const formattedHour = hour.toString().padStart(2, '0');
  return `${formattedHour}:${minute} ${period}`;
};

export const formatTimeRange12h = (startTime, endTime, isRTL = true) => {
  if (!startTime || !endTime) return '';
  const fStart = formatTime12h(startTime, isRTL);
  const fEnd = formatTime12h(endTime, isRTL);
  return isRTL ? `من ${fStart} إلى ${fEnd}` : `From ${fStart} to ${fEnd}`;
};

/**
 * Ultra-fast client-side image compression using HTML Canvas.
 * Compresses any high-res mobile photo (5-15MB) into a crisp 70-120KB JPEG in ~30ms,
 * making upload practically instantaneous over any internet connection.
 */
export const compressImage = async (file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) => {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  
  // If file is already tiny (< 150KB), no need to re-encode
  if (file.size <= 150 * 1024 && file.type === 'image/jpeg') return file;

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const cleanName = (file.name || 'receipt.jpg').replace(/\.[^/.]+$/, '') + '.jpg';
              const compressed = new File([blob], cleanName, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressed);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    } catch (_) {
      resolve(file);
    }
  });
};


