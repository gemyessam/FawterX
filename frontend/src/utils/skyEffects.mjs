export function getMeteorVelocity(speed) {
  const angle = Math.PI - 0.24
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed }
}

export function advanceMeteor(meteor, delta, width, height, margin = 12) {
  let x = meteor.x + meteor.vx * delta
  let y = meteor.y + meteor.vy * delta

  if (x < -margin) {
    x = width + margin
    y = ((y % height) + height) % height
  } else if (x > width + margin) {
    x = -margin
    y = ((y % height) + height) % height
  }
  if (y > height + margin) y = -margin
  else if (y < -margin) y = height + margin

  return { ...meteor, x, y }
}

export function advanceSnowflake(snowflake, delta, width, height) {
  let x = snowflake.x + snowflake.vx * delta
  let y = snowflake.y + snowflake.vy * delta
  if (y > height) y -= height + 100
  if (x < 0) x += width
  else if (x > width) x -= width
  return { ...snowflake, x, y }
}
