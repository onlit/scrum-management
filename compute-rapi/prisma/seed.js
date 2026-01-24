const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // await prisma.form.create({
  //   data: {},
  // });
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.log(e);
    await prisma.$disconnect();
  });
