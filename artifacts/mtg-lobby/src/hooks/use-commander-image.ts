import { useState, useEffect } from "react";

export function useCommanderImage(name: string): string | null {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!name.trim()) {
      setImageUrl(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name.trim())}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setImageUrl(null);
          return;
        }
        const data = (await res.json()) as {
          image_uris?: { art_crop?: string; normal?: string };
          card_faces?: Array<{ image_uris?: { art_crop?: string } }>;
        };
        const url =
          data.image_uris?.art_crop ??
          data.card_faces?.[0]?.image_uris?.art_crop ??
          data.image_uris?.normal ??
          null;
        setImageUrl(url);
      } catch {
        setImageUrl(null);
      }
    }, 900);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [name]);

  return imageUrl;
}
