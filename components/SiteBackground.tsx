/**
 * Fixed full-screen backdrop behind every page: one Dota 2 artwork,
 * darkened and tinted dark teal so the content stays the focus. Purely
 * decorative, so it is hidden from screen readers and ignores the mouse.
 *
 * The image is the owner's choice from the Steam Workshop (the art belongs
 * to Valve and its artist). To change it, put a new image in
 * public/backgrounds/ and point BACKGROUND_IMAGE at it.
 */
// A 1920px WebP copy kept in the site (public/backgrounds/), so it loads fast
// and can't disappear. Original: Steam Workshop image
// https://images.steamusercontent.com/ugc/703983937065332889/7F8C31C3B27D541E461DB34FDF60940077A66346/
const BACKGROUND_IMAGE = "/backgrounds/site-bg.webp";

export function SiteBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#071318] select-none">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }} />
      <div className="absolute inset-0 bg-[#071318]/75" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F6E56]/15 via-transparent to-[#071318]/90" />
    </div>
  );
}
