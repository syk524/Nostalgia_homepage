type CarouselImage = {
  id: string
  image_url: string
}

// CSS columns masonry: equal column widths, natural (uncropped) image
// heights, so columns settle at different heights instead of forcing
// every image into a fixed aspect ratio.
export function ImageCarousel({ images }: { images: CarouselImage[] }) {
  if (!images.length) return null

  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
      {images.map(img => (
        <img
          key={img.id}
          src={img.image_url}
          alt=""
          className="w-full h-auto rounded border border-scroll-300 mb-3 break-inside-avoid"
        />
      ))}
    </div>
  )
}
