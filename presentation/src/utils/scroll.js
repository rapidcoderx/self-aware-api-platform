// Eased smooth scroll — replaces native scrollIntoView for consistent feel
// easeInOutQuart: slow start, fast middle, slow end
const easeInOutQuart = (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t

let currentAnimation = null

export function smoothScrollTo(targetY, duration = 700) {
  if (currentAnimation) cancelAnimationFrame(currentAnimation)
  const startY = window.scrollY
  const distance = targetY - startY
  if (Math.abs(distance) < 1) return
  let startTime = null

  const animate = (time) => {
    if (!startTime) startTime = time
    const elapsed = time - startTime
    const progress = Math.min(elapsed / duration, 1)
    window.scrollTo(0, startY + distance * easeInOutQuart(progress))
    if (progress < 1) {
      currentAnimation = requestAnimationFrame(animate)
    } else {
      currentAnimation = null
    }
  }
  currentAnimation = requestAnimationFrame(animate)
}

// NAV_HEIGHT matches the nav bar (py-3 padding + ~32px content row = ~56px)
const NAV_HEIGHT = 60

export function scrollToSection(id) {
  const el = document.getElementById(id)
  if (!el) return
  const rect = el.getBoundingClientRect()
  const targetY = window.scrollY + rect.top - NAV_HEIGHT
  smoothScrollTo(Math.max(0, targetY))
}
