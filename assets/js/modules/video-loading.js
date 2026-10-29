export function initLocalVideos() {
  const videos = document.querySelectorAll('video[data-lazy-video]');
  if (!videos.length || navigator.connection?.saveData || typeof IntersectionObserver !== "function") return;
  const observer = new IntersectionObserver(entries => {
    for (const { target: video, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(video);
      // Native controls still load the source when JavaScript is unavailable.
      // Do not reset playback if the user pressed Play before this callback.
      if (video.paused && video.readyState === 0) {
        video.preload = "metadata";
        video.load();
      }
    }
  }, { rootMargin: "300px 0px" });
  videos.forEach(video => observer.observe(video));
}
