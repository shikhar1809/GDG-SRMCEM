export const preloadImage = (src) => {
  if (!src || typeof Image === 'undefined') return null;
  const image = new Image();
  image.decoding = 'async';
  image.loading = 'eager';
  image.src = src;
  return image;
};

export const preloadImages = (items = [], startIndex = 0, count = 2) => {
  items
    .slice(startIndex, startIndex + count)
    .forEach((item) => preloadImage(item?.src || item));
};
