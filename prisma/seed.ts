import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { buildTemplate, TEMPLATES } from '../src/lib/planner/templates.ts'
import { polygonArea } from '../src/lib/planner/geometry.ts'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')
  await prisma.project.deleteMany()
  for (const t of TEMPLATES.filter((x) => x.id !== 'empty')) {
    const p = buildTemplate(t.id)
    const area = p.floors.reduce((s, f) => s + f.rooms.reduce((a, r) => a + polygonArea(r.points), 0), 0) / 10000
    await prisma.project.create({
      data: { id: p.id, name: p.name, data: JSON.stringify(p), floors: p.floors.length, area },
    })
  }
  console.log('✅ Created sample projects')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
