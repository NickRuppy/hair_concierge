import Image from "next/image"

import type { ScanExampleCard as ScanExampleCardModel } from "@/lib/quiz/scan-insert-examples"

import { ScanExampleCard } from "./scan-example-card"

/** Photo of the moment the insert talks about, with the scanner verdict on it. */
export function ScanInsertPhoto({
  alt,
  card,
  src,
}: {
  alt: string
  card: ScanExampleCardModel
  src: string
}) {
  return (
    <div className="relative h-[400px] overflow-hidden rounded-[24px] bg-[var(--brand-plum-ice)] shadow-[0_30px_70px_-40px_rgba(42,24,69,0.6)]">
      <Image
        alt={alt}
        className="object-cover"
        fill
        priority
        sizes="(max-width: 640px) 100vw, 40rem"
        src={src}
      />
      <ScanExampleCard card={card} />
    </div>
  )
}
