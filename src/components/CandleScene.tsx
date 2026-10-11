import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
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
  const progress = useRef(0)

  useEffect(() => {
    const element = host.current
    const experience = element?.closest<HTMLElement>('.experience')
    const stage = element?.closest<HTMLElement>('.scene-stage')
    if (!experience || !stage) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let scheduled = 0
    const measure = () => {
      scheduled = 0
      const rect = experience.getBoundingClientRect()
      progress.current = motion.matches
        ? 0
        : THREE.MathUtils.clamp(
            -rect.top / Math.max(rect.height - window.innerHeight, 1),
            0,
            1,
          )
      const phase =
        progress.current < 0.5
          ? progress.current * 2
          : (progress.current - 0.5) * 2
      const eased = THREE.MathUtils.smoothstep(phase, 0, 1)
      const right = progress.current < 0.5 ? 1 - eased : eased
      stage.style.setProperty('--fallback-left', `${3 + right * 48}%`)
      stage.style.setProperty('--aura-left', `${-5 + right * 40}%`)
      stage.dataset.sceneChapter = String(
        Math.min(3, Math.floor(progress.current * 2.99) + 1),
      )
    }
    const schedule = () => {
      if (!scheduled) scheduled = requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    motion.addEventListener('change', schedule)
    measure()
    return () => {
      cancelAnimationFrame(scheduled)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      motion.removeEventListener('change', schedule)
    }
  }, [])

  useEffect(() => {
    const element = host.current
    if (!element) return
    let renderer: THREE.WebGLRenderer
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
      })
      if (!context) {
        const timer = setTimeout(() => setReady(false), 0)
        return () => clearTimeout(timer)
      }
      renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
        antialias: true,
      })
    } catch {
      return
    }
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.25 : 1.5),
    )
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true
    element.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-hidden', 'true')

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
    camera.position.set(0, 2.15, 7.3)
    camera.lookAt(0, 0.04, 0)
    const room = new RoomEnvironment()
    const generator = new THREE.PMREMGenerator(renderer)
    let environment = generator.fromScene(room, 0.04)
    scene.environment = environment.texture
    scene.environmentIntensity = 0.55
    room.dispose()
    generator.dispose()

    scene.add(new THREE.HemisphereLight(0xffddb1, 0x100a06, 0.35))
    const key = new THREE.DirectionalLight(0xffe6c3, 1.8)
    key.position.set(-3, 4, 4)
    key.castShadow = true
    key.shadow.mapSize.set(512, 512)
    key.shadow.camera.left = -3
    key.shadow.camera.right = 3
    key.shadow.camera.top = 3
    key.shadow.camera.bottom = -3
    key.shadow.normalBias = 0.04
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffbb70, 2.6)
    rim.position.set(3, 2, -2)
    scene.add(rim)
    const front = new THREE.DirectionalLight(0xfff4de, 0.6)
    front.position.set(0, 0, 5)
    scene.add(front)

    const composition = new THREE.Group()
    scene.add(composition)
    const candle = new THREE.Group()
    composition.add(candle)
    const points = [
      new THREE.Vector2(0.83, -1.04),
      new THREE.Vector2(0.98, -1.01),
      new THREE.Vector2(1, -0.93),
      new THREE.Vector2(1, 0.85),
      new THREE.Vector2(0.99, 0.92),
      new THREE.Vector2(0.92, 0.92),
      new THREE.Vector2(0.92, -0.91),
      new THREE.Vector2(0, -0.91),
    ]
    const glassGeometry = new THREE.LatheGeometry(points, 168)
    const vertices = glassGeometry.attributes.position
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i),
        z = vertices.getZ(i)
      const radius = Math.hypot(x, z)
      if (radius > 0.95) {
        const rib = 1 + Math.cos(Math.atan2(z, x) * 28) * 0.025
        vertices.setXYZ(i, x * rib, vertices.getY(i), z * rib)
      }
    }
    glassGeometry.computeVertexNormals()
    const glass = new THREE.Mesh(
      glassGeometry,
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color).multiplyScalar(0.48),
        roughness: 0.19,
        metalness: 0.5,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 0.8,
      }),
    )
    glass.castShadow = true
    candle.add(glass)
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.905, 0.905, 1.58, 64),
      new THREE.MeshStandardMaterial({ color: '#dcc6a3', roughness: 0.8 }),
    )
    wax.position.y = -0.07
    candle.add(wax)
    const gold = new THREE.MeshStandardMaterial({
      color: '#d2a15b',
      metalness: 0.85,
      roughness: 0.22,
    })
    for (const y of [0.9, -0.98]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.995, 0.015, 8, 128),
        gold,
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = y
      candle.add(ring)
    }
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.024, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: '#24160c' }),
    )
    wick.position.y = 0.79
    candle.add(wick)
    const flamePoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.061, 0.035),
      new THREE.Vector2(0.075, 0.115),
      new THREE.Vector2(0.036, 0.24),
      new THREE.Vector2(0, 0.46),
    ]
    const flame = new THREE.Mesh(
      new THREE.LatheGeometry(flamePoints, 24),
      new THREE.MeshBasicMaterial({ color: '#ffbf58', toneMapped: false }),
    )
    flame.position.y = 0.85
    candle.add(flame)
    const innerFlame = new THREE.Mesh(
      new THREE.LatheGeometry(flamePoints, 16),
      new THREE.MeshBasicMaterial({ color: '#fff5cb', toneMapped: false }),
    )
    innerFlame.scale.set(0.55, 0.62, 0.55)
    innerFlame.position.set(0, 0.858, 0.038)
    candle.add(innerFlame)
    const glow = new THREE.PointLight(0xffa43e, 5, 4)
    glow.position.set(0, 1.1, 0.12)
    candle.add(glow)

    const glowCanvas = document.createElement('canvas')
    glowCanvas.width = glowCanvas.height = 128
    const glowContext = glowCanvas.getContext('2d')!
    const gradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, '#ffcb8b70')
    gradient.addColorStop(0.2, '#ffa55228')
    gradient.addColorStop(1, '#ff9d4400')
    glowContext.fillStyle = gradient
    glowContext.fillRect(0, 0, 128, 128)
    const glowTexture = new THREE.CanvasTexture(glowCanvas)
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    )
    halo.position.set(0, 1.06, 0)
    halo.scale.set(1.6, 1.6, 1)
    candle.add(halo)

    const labelCanvas = document.createElement('canvas')
    labelCanvas.width = 1024
    labelCanvas.height = 512
    const context = labelCanvas.getContext('2d')!
    context.fillStyle = '#181310'
    context.fillRect(0, 0, 1024, 512)
    context.strokeStyle = '#b88b51'
    context.lineWidth = 2
    context.strokeRect(24, 24, 976, 464)
    context.fillStyle = '#edcd98'
    context.textAlign = 'center'
    context.font = '118px Georgia'
    context.fillText('lumora', 512, 192)
    context.fillStyle = '#9a784e'
    context.fillRect(350, 246, 324, 2)
    context.fillStyle = '#dac4a1'
    context.font = '32px Arial'
    context.fillText(name.toUpperCase(), 512, 329)
    context.font = '20px Arial'
    context.fillText('S C E N T E D   C A N D L E', 512, 407)
    const labelTexture = new THREE.CanvasTexture(labelCanvas)
    labelTexture.colorSpace = THREE.SRGBColorSpace
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(1.035, 1.035, 0.69, 48, 1, true, -0.57, 1.14),
      new THREE.MeshBasicMaterial({
        map: labelTexture,
        side: THREE.DoubleSide,
      }),
    )
    label.position.y = -0.14
    candle.add(label)

    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(1.53, 1.6, 0.18, 96),
      new THREE.MeshStandardMaterial({
        color: '#050403',
        metalness: 0,
        roughness: 0.88,
        envMapIntensity: 0,
      }),
    )
    stage.position.y = -1.16
    stage.receiveShadow = true
    composition.add(stage)
    const stageRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.009, 6, 96),
      gold,
    )
    stageRim.rotation.x = Math.PI / 2
    stageRim.position.y = -1.15
    composition.add(stageRim)
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 64),
      new THREE.ShadowMaterial({ opacity: 0.4 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.26
    floor.receiveShadow = true
    composition.add(floor)

    let frame = 0,
      targetX = 0,
      targetY = 0,
      previousRender = -Infinity
    let visible = true,
      lost = false,
      mobile = window.innerWidth < 761
    let previousShadowProgress = -1
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const render = (time: number) => {
      if (
        visible &&
        !document.hidden &&
        !lost &&
        (motion.matches || time - previousRender >= 1000 / 30)
      ) {
        previousRender = time
        const t = time * 0.001
        const p = motion.matches ? 0 : progress.current
        const phase = p < 0.5 ? p * 2 : (p - 0.5) * 2
        const ease = THREE.MathUtils.smoothstep(phase, 0, 1)
        const desiredX = mobile
          ? 0
          : p < 0.5
            ? THREE.MathUtils.lerp(1.25, -1.25, ease)
            : THREE.MathUtils.lerp(-1.25, 1.25, ease)
        const rotation =
          p < 0.5
            ? THREE.MathUtils.lerp(0, -0.9, ease)
            : THREE.MathUtils.lerp(-0.9, 0.45, ease)
        composition.position.x = desiredX
        composition.scale.setScalar(
          mobile
            ? 0.76 + Math.sin(p * Math.PI) * 0.08
            : 1.1 + Math.sin(p * Math.PI) * 0.13,
        )
        camera.position.z = mobile
          ? 8.8
          : p < 0.5
            ? THREE.MathUtils.lerp(8.2, 7.3, ease)
            : THREE.MathUtils.lerp(7.3, 8.2, ease)
        camera.position.y = mobile ? 2.15 : 2.15 + Math.sin(p * Math.PI) * 0.7
        camera.lookAt(0, mobile ? 1.35 : 0.1, 0)
        if (Math.abs(p - previousShadowProgress) > 0.04) {
          renderer.shadowMap.needsUpdate = true
          previousShadowProgress = p
        }
        if (!motion.matches) {
          candle.rotation.y = rotation + targetX * 0.3
          candle.rotation.x += (targetY * 0.08 - candle.rotation.x) * 0.045
          candle.position.y = Math.sin(t * 0.65) * 0.015
          flame.scale.set(
            1 + Math.sin(t * 7) * 0.045,
            1 + Math.sin(t * 5) * 0.06,
            1,
          )
          flame.rotation.z = Math.sin(t * 3) * 0.075
          innerFlame.rotation.z = flame.rotation.z
          glow.intensity = 5 + Math.sin(t * 5) * 0.35
        }
        renderer.render(scene, camera)
      }
      if (!motion.matches) frame = requestAnimationFrame(render)
    }
    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      if (!width || !height) return
      mobile = window.innerWidth < 761
      renderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio,
          mobile ? 1.25 : 1.35,
          Math.sqrt(1_050_000 / (width * height)),
        ),
      )
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.fov = mobile ? 40 : 32
      camera.updateProjectionMatrix()
      if (motion.matches && !lost) {
        previousRender = -Infinity
        render(0)
      }
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
      previousRender = -Infinity
      candle.rotation.set(0, 0, 0)
      candle.position.y = 0
      render(0)
    }
    const contextLost = (event: Event) => {
      event.preventDefault()
      lost = true
      environment.dispose()
      setReady(false)
    }
    const contextRestored = () => {
      const restoredRoom = new RoomEnvironment()
      const restoredGenerator = new THREE.PMREMGenerator(renderer)
      environment = restoredGenerator.fromScene(restoredRoom, 0.04)
      scene.environment = environment.texture
      restoredRoom.dispose()
      restoredGenerator.dispose()
      renderer.shadowMap.needsUpdate = true
      lost = false
      previousRender = -Infinity
      setReady(true)
      resize()
      if (motion.matches) render(0)
    }
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      contextRestored,
    )
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(element)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && motion.matches && !lost) renderer.render(scene, camera)
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
      const materials = new Set<THREE.Material>()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const meshMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material]
          meshMaterials.forEach((material) => materials.add(material))
        } else if (object instanceof THREE.Sprite)
          materials.add(object.material)
      })
      materials.forEach((material) => material.dispose())
      labelTexture.dispose()
      glowTexture.dispose()
      environment.dispose()
      key.shadow.dispose()
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        contextRestored,
      )
      renderer.dispose()
      if (!lost) renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [color, name])

  return (
    <div
      className="candle-scene"
      role="img"
      aria-label={`3D ${name} candle. Scroll through the Lumora story to explore different angles.`}
    >
      <div className="webgl-host" ref={host} />
      {!ready && (
        <CandleArt className="scene-fallback" color={color} name={name} />
      )}
    </div>
  )
}
