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
