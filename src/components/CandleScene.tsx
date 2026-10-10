import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import CandleArt from './CandleArt'

export default function CandleScene({
  color,
  name,
}: {
  color: string
  name: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const element = host.current
    if (!element) return
    let renderer: THREE.WebGLRenderer
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2', { alpha: true, antialias: true })
      if (!context) {
        const timer = setTimeout(() => setReady(false), 0)
        return () => clearTimeout(timer)
      }
      renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    const contextLost = () => setReady(false)
    const contextRestored = () => setReady(true)
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      contextRestored,
    )
    element.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-hidden', 'true')

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 1.6, 6.8)
    camera.lookAt(0, 0.1, 0)
    scene.add(new THREE.HemisphereLight(0xfff5e3, 0x6b513e, 2))
    const light = new THREE.DirectionalLight(0xfff3dd, 3)
    light.position.set(-3, 4, 4)
    scene.add(light)
    const rim = new THREE.DirectionalLight(0xffffff, 1.5)
    rim.position.set(3, 2, -2)
    scene.add(rim)
    const candle = new THREE.Group()
    scene.add(candle)
    const points = [
      new THREE.Vector2(0.82, -1.04),
      new THREE.Vector2(0.97, -1.02),
      new THREE.Vector2(1, -0.93),
      new THREE.Vector2(1, 0.86),
      new THREE.Vector2(0.98, 0.92),
      new THREE.Vector2(0.92, 0.92),
      new THREE.Vector2(0.92, -0.91),
      new THREE.Vector2(0, -0.91),
    ]
    const glass = new THREE.Mesh(
      new THREE.LatheGeometry(points, 96),
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.19,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
    )
    candle.add(glass)
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.905, 0.905, 1.66, 64),
      new THREE.MeshStandardMaterial({ color: '#eee1c7', roughness: 0.85 }),
    )
    wax.position.y = -0.03
    candle.add(wax)
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.022, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: '#38291b' }),
    )
    wick.position.y = 0.88
    candle.add(wick)
    const flamePoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.065, 0.04),
      new THREE.Vector2(0.078, 0.12),
      new THREE.Vector2(0.04, 0.23),
      new THREE.Vector2(0, 0.38),
    ]
    const flame = new THREE.Mesh(
      new THREE.LatheGeometry(flamePoints, 24),
      new THREE.MeshBasicMaterial({ color: '#ffe0a1' }),
    )
    flame.position.y = 0.94
    candle.add(flame)
    const glow = new THREE.PointLight(0xffae46, 1.8, 3)
    glow.position.set(0, 1.12, 0.1)
    candle.add(glow)
    const labelCanvas = document.createElement('canvas')
    labelCanvas.width = 1024
    labelCanvas.height = 512
    const context = labelCanvas.getContext('2d')!
    context.fillStyle = '#f8f3e9'
    context.fillRect(0, 0, 1024, 512)
    context.fillStyle = '#453c31'
    context.textAlign = 'center'
    context.font = '96px Georgia'
    context.fillText('L U M O R A', 512, 170)
    context.fillStyle = '#bcae98'
    context.fillRect(175, 225, 674, 2)
    context.fillStyle = '#605344'
    context.font = '34px Arial'
    context.fillText(name.toUpperCase(), 512, 318)
    context.font = '22px Arial'
    context.fillText('S C E N T E D   C A N D L E', 512, 403)
    const texture = new THREE.CanvasTexture(labelCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(1.008, 1.008, 0.75, 48, 1, true, -0.66, 1.32),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    )
    label.position.y = -0.12
    candle.add(label)
    candle.rotation.z = -0.065

    let frame = 0
    let targetX = 0
    let targetY = 0
    let visible = true
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const render = (time: number) => {
      if (visible && !document.hidden) {
        const t = time * 0.001
        if (!motion.matches) {
          candle.rotation.y += (targetX * 0.28 - candle.rotation.y) * 0.04
          candle.rotation.x += (targetY * 0.09 - candle.rotation.x) * 0.04
          candle.position.y = Math.sin(t * 0.8) * 0.065
          flame.scale.set(
            1 + Math.sin(t * 7) * 0.06,
            1 + Math.sin(t * 5) * 0.08,
            1,
          )
          flame.rotation.z = Math.sin(t * 3) * 0.09
          glow.intensity = 1.8 + Math.sin(t * 5) * 0.2
        }
        renderer.render(scene, camera)
      }
      if (!motion.matches) frame = requestAnimationFrame(render)
    }
    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      renderer.setSize(width, height)
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      if (motion.matches) renderer.render(scene, camera)
    }
    const pointer = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      targetX = (event.clientX - rect.left) / rect.width - 0.5
      targetY = (event.clientY - rect.top) / rect.height - 0.5
    }
    const resetPointer = () => {
      targetX = 0
      targetY = 0
    }
    const changeMotion = () => {
      cancelAnimationFrame(frame)
      render(0)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(element)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    intersectionObserver.observe(element)
    element.addEventListener('pointermove', pointer)
    element.addEventListener('pointerleave', resetPointer)
    motion.addEventListener('change', changeMotion)
    resize()
    render(0)
    const readyTimer = setTimeout(() => setReady(true), 0)
    return () => {
      clearTimeout(readyTimer)
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      element.removeEventListener('pointermove', pointer)
      element.removeEventListener('pointerleave', resetPointer)
      motion.removeEventListener('change', changeMotion)
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      texture.dispose()
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        contextRestored,
      )
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [color, name])

  return (
    <div
      className="candle-scene"
      role="img"
      aria-label={`Animated 3D ${name} candle. Move your pointer to explore.`}
    >
      <div className="webgl-host" ref={host} />
      {!ready && (
        <CandleArt className="scene-fallback" color={color} name={name} />
      )}
    </div>
  )
}
