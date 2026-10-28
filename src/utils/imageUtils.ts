/**
 * Utilitaires de traitement et validation d'images pour DzMahall
 */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

export const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80';

export interface ImageProcessingResult {
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  fileName: string;
}

/**
 * Valide et compresse une image locale issue de l'ordinateur
 */
export async function processLocalImage(
  file: File,
  maxDimension = 1200,
  quality = 0.82
): Promise<ImageProcessingResult> {
  // 1. Vérification du type MIME
  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    throw new Error(
      `Format de fichier non supporté (${file.type}). Formats autorisés : JPG, JPEG, PNG, WebP.`
    );
  }

  // 2. Vérification de la taille max
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Le fichier est trop volumineux (${sizeInMb} Mo). La taille maximale autorisée est de 5 Mo.`
    );
  }

  // 3. Lecture du fichier via FileReader
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier.'));
    reader.readAsDataURL(file);
  });

  // 4. Chargement dans un objet Image pour compression intelligente
  return new Promise<ImageProcessingResult>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Redimensionnement si dépasse maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        // Fallback sans canvas
        resolve({
          dataUrl: rawDataUrl,
          width: img.width,
          height: img.height,
          sizeBytes: file.size,
          fileName: file.name,
        });
        return;
      }

      // Dessin avec lissage
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Export compressé
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const compressedDataUrl = canvas.toDataURL(mime, quality);

      resolve({
        dataUrl: compressedDataUrl,
        width,
        height,
        sizeBytes: Math.round((compressedDataUrl.length * 3) / 4),
        fileName: file.name,
      });
    };

    img.onerror = () => {
      reject(new Error('Impossible de charger le fichier image. Fichier peut-être corrompu.'));
    };

    img.src = rawDataUrl;
  });
}

/**
 * Valide une URL externe d'image et teste si elle est accessible
 */
export async function testImageUrl(url: string, timeoutMs = 7000): Promise<boolean> {
  const trimmed = url.trim();

  // Test de format HTTP/HTTPS
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error("L'URL doit obligatoirement commencer par http:// ou https://.");
  }

  // Test de chargement réel
  return new Promise<boolean>((resolve, reject) => {
    let timer: any = null;
    const img = new Image();

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Délai d'attente dépassé. L'image ne répond pas ou est bloquée."));
    }, timeoutMs);

    img.onload = () => {
      cleanup();
      resolve(true);
    };

    img.onerror = () => {
      cleanup();
      reject(new Error("Impossible de charger cette image depuis l'URL indiquée. Vérifiez le lien."));
    };

    img.src = trimmed;
  });
}
