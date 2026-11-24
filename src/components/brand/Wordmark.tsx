type WordmarkProps = {
  lang?: 'ar' | 'en';
  className?: string;
};

export function Wordmark({ lang = 'ar', className = '' }: WordmarkProps) {
  if (lang === 'en') {
    return (
      <span
        lang="en"
        dir="ltr"
        data-wordmark="temporary"
        className={`font-wordmarkEn text-2xl font-semibold leading-none ${className}`}
      >
        Nokmel
      </span>
    );
  }
  return (
    <span
      lang="ar"
      dir="rtl"
      data-wordmark="temporary"
      className={`font-wordmarkAr text-2xl font-bold leading-none ${className}`}
    >
      نكمّل
    </span>
  );
}
