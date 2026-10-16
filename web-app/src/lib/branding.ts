export type PublicBrandSettings = {
  brand_logo_url?: string;
  brand_name?: string;
  brand_tagline?: string;
  seo_title?: string;
  seo_description?: string;
};

export const DEFAULT_NAME = 'EduShift';
const DEFAULT_TAGLINE = 'Đúng người, đúng ca';
const DEFAULT_TITLE = DEFAULT_NAME + ' · ' + DEFAULT_TAGLINE;
const DEFAULT_DESCRIPTION = 'Nền tảng kết nối việc làm part-time theo lịch học';

export function brandText(settings: PublicBrandSettings) {
  const name = settings.brand_name?.trim() || DEFAULT_NAME;
  const tagline = settings.brand_tagline === undefined ? DEFAULT_TAGLINE : settings.brand_tagline.trim();
  const seoTitle = settings.seo_title?.trim();
  return {
    name,
    title: seoTitle && seoTitle !== DEFAULT_TITLE ? seoTitle : [name, tagline].filter(Boolean).join(' · '),
    description: settings.seo_description?.trim() || DEFAULT_DESCRIPTION,
  };
}
