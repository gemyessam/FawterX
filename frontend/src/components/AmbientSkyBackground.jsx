import { useEffect, useRef } from 'react'
import { advanceMeteor, advanceSnowflake, getMeteorVelocity } from '../utils/skyEffects.mjs'

const NIGHT_METEOR_COLORS = ['#f8e7d0', '#d9caff', '#a8d7ff', '#ffd0b3', '#ffffff']
const DAY_DUST_COLORS = [[250, 127, 145], [255, 177, 105], [245, 214, 112], [106, 186, 160], [110, 160, 235], [163, 135, 222]]
const NIGHT_DUST_COLORS = [[177, 151, 236], [125, 177, 235], [250, 171, 128], [232, 211, 255]]
const RAINBOW = ['#ff9ba5', '#ffbd83', '#f3d47d', '#9dd7b8', '#91c8f3', '#b8a5ef', '#e5a8d2']

const randomBetween = (min, max) => min + Math.random() * (max - min)

export default function AmbientSkyBackground() {
  const skyCanvasRef = useRef(null)
  const dustCanvasRef = useRef(null)

  useEffect(() => {
    const skyCanvas = skyCanvasRef.current
    const sky = skyCanvas?.getContext('2d', { alpha: true })
    const dustCanvas = dustCanvasRef.current
    const dust = dustCanvas?.getContext('2d', { alpha: true })
    if (!skyCanvas || !sky || !dustCanvas || !dust) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const meteors = []
    const snowflakes = []
    const smokeClouds = []
    const dustMotes = []
    const pointer = { x: 0, y: 0, lastX: 0, lastY: 0, lastEmit: 0, initialized: false }
    let width = 0
    let height = 0
    let pixelRatio = 1
    let frame = 0
    let previousTime = 0

    const isLightMode = () => document.documentElement.dataset.theme === 'light'
    const createMeteor = (w, h, x = randomBetween(0, w), y = randomBetween(0, h)) => {
      const speed = randomBetween(24, 104)
      const velocity = getMeteorVelocity(speed)
      return {
        x, y, ...velocity, speed,
        size: randomBetween(0.55, 1.8),
        alpha: randomBetween(0.32, 0.86),
        color: NIGHT_METEOR_COLORS[Math.floor(Math.random() * NIGHT_METEOR_COLORS.length)],
        phase: Math.random() * Math.PI * 2,
        twinkle: randomBetween(0.4, 1.4),
      }
    }

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      for (const canvas of [skyCanvas, dustCanvas]) {
        canvas.width = Math.round(width * pixelRatio)
        canvas.height = Math.round(height * pixelRatio)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
      }
      sky.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      dust.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

      const meteorCount = Math.min(165, Math.max(75, Math.round(width * height / 9500)))
      while (meteors.length > meteorCount) meteors.pop()
      while (meteors.length < meteorCount) meteors.push(createMeteor(width, height))

      const snowCount = Math.min(145, Math.max(75, Math.round(width * height / 10500)))
      while (snowflakes.length > snowCount) snowflakes.pop()
      while (snowflakes.length < snowCount) {
        snowflakes.push({
          x: randomBetween(0, width), y: randomBetween(0, height),
          vx: randomBetween(-7, 5), vy: randomBetween(11, 34),
          size: randomBetween(1.1, 3.4), alpha: randomBetween(0.28, 0.72),
          phase: Math.random() * Math.PI * 2,
        })
      }

      if (reducedMotion.matches) drawScene(0, 0, true)
    }

    const drawRainbowAndSun = (time) => {
      const scale = Math.min(1.2, Math.max(0.62, Math.min(width / 1360, height / 768)))
      const centerX = width * (width < 700 ? 0.12 : 0.22)
      const centerY = height * (width < 700 ? 0.78 : 0.79)
      const radiusX = Math.min(width * (width < 700 ? 0.78 : 0.58), 820)
      const radiusY = Math.min(height * 0.68, 520)
      const breathing = 1 + Math.sin(time * 0.00022) * 0.012

      // A soft prismatic wash gives the arch atmosphere without turning the page into a banner.
      const atmosphere = sky.createRadialGradient(centerX + radiusX * 0.42, centerY - radiusY * 0.55, 8, centerX + radiusX * 0.42, centerY - radiusY * 0.55, radiusX * 1.12)
      atmosphere.addColorStop(0, 'rgba(204, 202, 255, 0.09)')
      atmosphere.addColorStop(0.38, 'rgba(255, 213, 206, 0.065)')
      atmosphere.addColorStop(0.72, 'rgba(255, 236, 208, 0.035)')
      atmosphere.addColorStop(1, 'rgba(255, 255, 255, 0)')
      sky.fillStyle = atmosphere
      sky.fillRect(0, 0, width, height)

      sky.save()
      sky.translate(centerX, centerY)
      sky.rotate(-0.035)
      sky.lineCap = 'round'
      sky.shadowBlur = 18 * scale
      for (let index = 0; index < RAINBOW.length; index += 1) {
        const radiusOffset = index * 13 * scale
        sky.globalAlpha = 0.2 + Math.sin(time * 0.00028 + index * 0.32) * 0.012
        sky.strokeStyle = RAINBOW[index]
        sky.shadowColor = RAINBOW[index]
        sky.lineWidth = Math.max(6, 8.5 * scale)
        sky.beginPath()
        sky.ellipse(0, 0, radiusX * breathing - radiusOffset, radiusY * breathing - radiusOffset * 0.72, 0, Math.PI * 1.035, Math.PI * 1.965)
        sky.stroke()
      }
      // Fine inner highlight creates a glassy edge and helps the spectrum read at small sizes.
      sky.globalAlpha = 0.16
      sky.shadowBlur = 8 * scale
      sky.strokeStyle = '#ffffff'
      sky.lineWidth = 1.4 * scale
      sky.beginPath()
      sky.ellipse(0, 0, radiusX - RAINBOW.length * 13 * scale, radiusY - RAINBOW.length * 9.4 * scale, 0, Math.PI * 1.09, Math.PI * 1.91)
      sky.stroke()
      sky.restore()

      const sunX = width * (width < 700 ? 0.79 : 0.82)
      const sunY = height * (width < 700 ? 0.17 : 0.22)
      const sunRadius = Math.max(23, Math.min(width < 700 ? 31 : 43, height * 0.058))
      const glowRadius = sunRadius * 5.2
      const glow = sky.createRadialGradient(sunX, sunY, sunRadius * 0.22, sunX, sunY, glowRadius)
      glow.addColorStop(0, 'rgba(255, 221, 157, 0.34)')
      glow.addColorStop(0.2, 'rgba(255, 211, 143, 0.2)')
      glow.addColorStop(0.48, 'rgba(255, 224, 177, 0.105)')
      glow.addColorStop(1, 'rgba(255, 235, 191, 0)')
      sky.fillStyle = glow
      sky.beginPath()
      sky.arc(sunX, sunY, glowRadius, 0, Math.PI * 2)
      sky.fill()

      // A delicate corona with tapered rays makes the sun luminous, not icon-like.
      sky.save()
      sky.translate(sunX, sunY)
      sky.rotate(time * 0.000018)
      for (let ray = 0; ray < 20; ray += 1) {
        const angle = ray * Math.PI * 2 / 20
        const inner = sunRadius * (1.22 + (ray % 2) * 0.08)
        const outer = sunRadius * (1.5 + (ray % 3) * 0.14)
        const rayGradient = sky.createLinearGradient(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer)
        rayGradient.addColorStop(0, 'rgba(255, 218, 153, 0.2)')
        rayGradient.addColorStop(1, 'rgba(255, 218, 153, 0)')
        sky.strokeStyle = rayGradient
        sky.lineWidth = ray % 2 === 0 ? 1.4 * scale : 0.8 * scale
        sky.beginPath()
        sky.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
        sky.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
        sky.stroke()
      }
      sky.restore()

      sky.save()
      sky.globalAlpha = 0.22
      sky.strokeStyle = 'rgba(255, 244, 213, 0.9)'
      sky.lineWidth = 1
      sky.beginPath()
      sky.arc(sunX, sunY, sunRadius * 1.16, 0, Math.PI * 2)
      sky.stroke()
      sky.restore()

      const sun = sky.createRadialGradient(sunX - sunRadius * 0.35, sunY - sunRadius * 0.4, 1, sunX, sunY, sunRadius)
      sun.addColorStop(0, '#fffdf0')
      sun.addColorStop(0.42, '#fff2c8')
      sun.addColorStop(0.82, '#ffdfa0')
      sun.addColorStop(1, '#ffc77e')
      sky.fillStyle = sun
      sky.beginPath()
      sky.arc(sunX, sunY, sunRadius, 0, Math.PI * 2)
      sky.fill()

      const sunHighlight = sky.createRadialGradient(sunX - sunRadius * 0.36, sunY - sunRadius * 0.4, 0, sunX - sunRadius * 0.25, sunY - sunRadius * 0.26, sunRadius * 0.72)
      sunHighlight.addColorStop(0, 'rgba(255, 255, 245, 0.54)')
      sunHighlight.addColorStop(1, 'rgba(255, 255, 245, 0)')
      sky.fillStyle = sunHighlight
      sky.beginPath()
      sky.arc(sunX, sunY, sunRadius, 0, Math.PI * 2)
      sky.fill()
    }

    const drawSnow = (delta, time, staticFrame) => {
      sky.save()
      for (const flake of snowflakes) {
        if (!staticFrame) {
          flake.phase += delta * 0.8
          const moved = advanceSnowflake({ ...flake, vx: flake.vx + Math.sin(flake.phase) * 0.5 }, delta, width, height)
          flake.x = moved.x
          flake.y = moved.y
        }
        const shimmer = 0.82 + Math.sin(flake.phase + time * 0.0004) * 0.16
        sky.globalAlpha = flake.alpha * shimmer
        sky.fillStyle = '#ffffff'
        sky.shadowBlur = flake.size * 3
        sky.shadowColor = 'rgba(154, 187, 230, 0.55)'
        sky.beginPath()
        sky.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2)
        sky.fill()
      }
      sky.restore()
      sky.globalAlpha = 1
      sky.shadowBlur = 0
    }

    const drawMeteors = (delta, staticFrame) => {
      for (let index = 0; index < meteors.length; index += 1) {
        const meteor = meteors[index]
        if (!staticFrame) {
          meteor.phase += delta * meteor.twinkle
          Object.assign(meteor, advanceMeteor(meteor, delta, width, height, 28))
          if (meteor.x > width + 27) {
            meteors[index] = createMeteor(width, height, width + 28, randomBetween(-24, height * 0.72))
            continue
          }
        }

        const glow = 0.82 + Math.sin(meteor.phase) * 0.12
        const tailLength = Math.min(27, 5 + meteor.speed * 0.19)
        const tailX = meteor.x - meteor.vx / meteor.speed * tailLength
        const tailY = meteor.y - meteor.vy / meteor.speed * tailLength
        const trail = sky.createLinearGradient(tailX, tailY, meteor.x, meteor.y)
        trail.addColorStop(0, 'rgba(255,255,255,0)')
        trail.addColorStop(0.7, meteor.color)
        trail.addColorStop(1, '#ffffff')
        sky.globalAlpha = meteor.alpha * glow
        sky.strokeStyle = trail
        sky.lineWidth = meteor.size * 0.85
        sky.beginPath()
        sky.moveTo(tailX, tailY)
        sky.lineTo(meteor.x, meteor.y)
        sky.stroke()
        sky.fillStyle = '#ffffff'
        sky.shadowBlur = meteor.size * 4
        sky.shadowColor = meteor.color
        sky.beginPath()
        sky.arc(meteor.x, meteor.y, meteor.size * 0.72, 0, Math.PI * 2)
        sky.fill()
      }
      sky.globalAlpha = 1
      sky.shadowBlur = 0
    }

    const drawScene = (delta, time, staticFrame = false) => {
      sky.clearRect(0, 0, width, height)
      if (isLightMode()) {
        drawRainbowAndSun(time)
        drawSnow(delta, time, staticFrame)
      } else {
        drawMeteors(delta, staticFrame)
      }
    }

    const drawCursorDust = (delta) => {
      dust.clearRect(0, 0, width, height)
      const colors = isLightMode() ? DAY_DUST_COLORS : NIGHT_DUST_COLORS

      for (let index = smokeClouds.length - 1; index >= 0; index -= 1) {
        const cloud = smokeClouds[index]
        cloud.age += delta
        if (cloud.age >= cloud.life) {
          smokeClouds.splice(index, 1)
          continue
        }
        const fade = Math.sin((cloud.age / cloud.life) * Math.PI)
        cloud.x += cloud.vx * delta
        cloud.y += cloud.vy * delta
        cloud.vx *= 1 - delta * 0.5
        cloud.vy *= 1 - delta * 0.5
        cloud.radius += delta * cloud.growth
        const color = colors[cloud.colorIndex % colors.length]
        const plume = dust.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius)
        plume.addColorStop(0, `rgba(${color.join(',')},${0.09 * fade})`)
        plume.addColorStop(0.42, `rgba(${color.join(',')},${0.055 * fade})`)
        plume.addColorStop(0.78, `rgba(${color.join(',')},${0.015 * fade})`)
        plume.addColorStop(1, `rgba(${color.join(',')},0)`)
        dust.fillStyle = plume
        dust.beginPath()
        dust.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2)
        dust.fill()
      }

      for (let index = dustMotes.length - 1; index >= 0; index -= 1) {
        const mote = dustMotes[index]
        mote.age += delta
        if (mote.age >= mote.life) {
          dustMotes.splice(index, 1)
          continue
        }
        const fade = 1 - mote.age / mote.life
        mote.x += mote.vx * delta
        mote.y += mote.vy * delta
        mote.vx *= 1 - delta * 0.3
        mote.vy *= 1 - delta * 0.3
        const color = colors[mote.colorIndex % colors.length]
        dust.globalAlpha = fade * mote.opacity
        dust.fillStyle = `rgb(${color.join(',')})`
        dust.shadowBlur = mote.size * 4
        dust.shadowColor = `rgba(${color.join(',')},0.7)`
        dust.beginPath()
        dust.arc(mote.x, mote.y, mote.size * fade, 0, Math.PI * 2)
        dust.fill()
      }
      dust.globalAlpha = 1
      dust.shadowBlur = 0
    }

    const emitCursorDust = (event) => {
      if (event.pointerType === 'touch' || reducedMotion.matches) return
      const x = event.clientX
      const y = event.clientY
      const dx = pointer.initialized ? x - pointer.lastX : 0
      const dy = pointer.initialized ? y - pointer.lastY : 0
      const distance = Math.hypot(dx, dy)
      if (!pointer.initialized || (event.timeStamp - pointer.lastEmit > 18 && distance > 2)) {
        const steps = Math.max(1, Math.min(4, Math.ceil(distance / 24)))
        const colors = isLightMode() ? DAY_DUST_COLORS : NIGHT_DUST_COLORS
        for (let step = 1; step <= steps; step += 1) {
          const progress = step / steps
          const colorIndex = Math.floor(Math.random() * colors.length)
          const px = pointer.lastX + dx * progress
          const py = pointer.lastY + dy * progress
          smokeClouds.push({
            x: px, y: py,
            vx: -dx * 0.12 + randomBetween(-7, 7),
            vy: -dy * 0.12 + randomBetween(-7, 7),
            radius: randomBetween(12, 22), growth: randomBetween(8, 16),
            age: 0, life: randomBetween(0.8, 1.35), colorIndex,
          })
          for (let moteIndex = 0; moteIndex < 3; moteIndex += 1) {
            dustMotes.push({
              x: px + randomBetween(-5, 5), y: py + randomBetween(-5, 5),
              vx: -dx * 0.2 + randomBetween(-18, 18),
              vy: -dy * 0.2 + randomBetween(-18, 18),
              size: randomBetween(0.5, 1.5), opacity: randomBetween(0.4, 0.8),
              age: 0, life: randomBetween(0.55, 1.15), colorIndex,
            })
          }
        }
        if (smokeClouds.length > 34) smokeClouds.splice(0, smokeClouds.length - 34)
        if (dustMotes.length > 110) dustMotes.splice(0, dustMotes.length - 110)
        pointer.lastEmit = event.timeStamp
      }
      pointer.x = x
      pointer.y = y
      pointer.lastX = x
      pointer.lastY = y
      pointer.initialized = true
    }

    const render = (time) => {
      frame = 0
      if (document.hidden) return
      const delta = Math.min((time - (previousTime || time)) / 1000, 0.032)
      previousTime = time
      drawScene(delta, time)
      drawCursorDust(delta)
      frame = window.requestAnimationFrame(render)
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (frame) window.cancelAnimationFrame(frame)
        frame = 0
      } else if (!reducedMotion.matches && !frame) {
        previousTime = 0
        frame = window.requestAnimationFrame(render)
      }
    }

    const onMotionPreferenceChange = () => {
      if (reducedMotion.matches) {
        if (frame) window.cancelAnimationFrame(frame)
        frame = 0
        drawScene(0, 0, true)
        dust.clearRect(0, 0, width, height)
      } else if (!document.hidden && !frame) {
        frame = window.requestAnimationFrame(render)
      }
    }

    resize()
    if (!reducedMotion.matches) frame = window.requestAnimationFrame(render)
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('pointermove', emitCursorDust, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    reducedMotion.addEventListener?.('change', onMotionPreferenceChange)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', emitCursorDust)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      reducedMotion.removeEventListener?.('change', onMotionPreferenceChange)
    }
  }, [])

  return (
    <>
      <canvas ref={skyCanvasRef} className="fx-sky-canvas" aria-hidden="true" />
      <canvas ref={dustCanvasRef} className="fx-cursor-dust-canvas" aria-hidden="true" />
    </>
  )
}
