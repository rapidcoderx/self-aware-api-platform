// Eased smooth scroll — replaces native scrollIntoView.
// easeOutCubic: quick start, smooth deceleration (feels snappier than InOut)
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

let currentAnimation = null

/**
 * Duration scales with distance so short jumps feel instant
 * and cross-page jumps are still smooth.
 */
function getDuration(distance) {
  const abs = Math.abs(distance)
  if (abs < 300)  return 220
  if (abs < 900)  return 300
  return 380
}

export function smoothScrollTo(targetY) {
  if (currentAnimation) cancelAnimationFrame(currentAnimation)
  const startY = window.scrollY
  const distance = targetY - startY
  if (Math.abs(distance) < 1) return
  const duration = getDuration(distance)
  let startTime = null

  // Pause CSS animations during scroll to free up GPU on Intel integrated
  document.documentElement.classList.add('is-scrolling')

  const animate = (time) => {
    if (!startTime) startTime = time
    const elapsed = time - startTime
    const progress = Math.min(elapsed / duration, 1)
    window.scrollTo(0, startY + distance * easeOutCubic(progress))
    if (progress < 1) {
      currentAnimation = requestAnimationFrame(animate)
    } else {
      currentAnimation = null
      document.documentElement.classList.remove('is-scrolling')
    }
  }
  currentAnimation = requestAnimationFrame(animate)
}

const NAV_HEIGHT = 60

export function scrollToSection(id) {
  const el = document.getElementById(id)
  if (!el) return
  const rect = el.getBoundingClientRect()
  const targetY = window.scrollY + rect.top - NAV_HEIGHT
  smoothScrollTo(Math.max(0, targetY))
}
