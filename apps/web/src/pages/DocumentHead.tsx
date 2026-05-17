// src/pages/DocumentHead.tsx
import { useEffect } from "react";

interface DocumentHeadProps {
  title: string;
  description?: string;
}

/**
 * Small helper that sets <title> and the meta description for a page.
 * Cleans up on unmount by restoring the previous title.
 */
export function DocumentHead({ title, description }: DocumentHeadProps) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;

    let metaTag = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    const prevContent = metaTag?.getAttribute("content") ?? "";

    if (description) {
      if (!metaTag) {
        metaTag = document.createElement("meta");
        metaTag.name = "description";
        document.head.appendChild(metaTag);
      }
      metaTag.content = description;
    }

    return () => {
      document.title = prev;
      if (metaTag) metaTag.content = prevContent;
    };
  }, [title, description]);

  return null;
}
