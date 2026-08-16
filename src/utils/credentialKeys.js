export const getEmailKey = (email) => String(email || '').trim().toLowerCase();

export const createTemplateSlug = (title) => {
  const slug = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug || `badge-${Date.now()}`;
};
