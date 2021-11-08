import { PrismaClient } from "@prisma/client";

import express from "express";

import axios from "axios";

import cron from "node-cron";

const prisma = new PrismaClient();

const app = express();

app.use(express.json());

app.get("/api/generate-random-number", async (_, res) => {
  res.json(Math.floor(Math.random() * 50));
});

// Get request so it can be tested in the browser
app.get("/api/entity/:id/update-number", async (req, res) => {
  const { id } = req.params;

  try {
    const { data: randomNumber } = await axios.get(
      `${process.env.BASE_URL}/api/generate-random-number`
    );

    const existingEntity = await prisma.entity.findUnique({
      select: { number: true },
      where: { id: Number(id) },
    });

    const newEntity = await prisma.entity.upsert({
      select: { id: true, number: true },
      where: { id: Number(id) },
      update: { number: (existingEntity?.number || 0) + Number(randomNumber) },
      create: { number: 1 },
    });

    res.json(newEntity);
  } catch (error) {
    res.json({ error });
  }
});

export const server = app.listen(3000, () =>
  console.info("🚀 Server ready at: http://localhost:3000")
);

export const cleanup = cron.schedule(
  "30 * * * * *",
  async () => {
    console.info("🕒 Running a cron clean-up");

    try {
      const foundEntities = await prisma.entity.findMany({
        select: {
          id: true,
          number: true,
        },

        where: {
          number: {
            gte: 10,
          },
        },
      });

      await Promise.all(
        foundEntities.map(async (entity) => {
          if (entity.number % 2 === 0 || entity.number % 10 === 0) {
            await prisma.entity.delete({
              where: {
                id: entity.id,
              },
            });
          }
        })
      );
    } catch (error) {
      console.error(error);
    }
  },
  { scheduled: false }
);

if (process.env.NODE_ENV !== "test") {
  cleanup.start();
}
