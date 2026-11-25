-- CreateEnum
CREATE TYPE "RobotType" AS ENUM ('G1', 'GO2');

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RobotType" NOT NULL,
    "token" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_name_key" ON "organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "robot_name_key" ON "robot"("name");

-- CreateIndex
CREATE UNIQUE INDEX "robot_token_key" ON "robot"("token");

-- CreateIndex
CREATE INDEX "robot_organization_id_idx" ON "robot"("organization_id");

-- AddForeignKey
ALTER TABLE "robot" ADD CONSTRAINT "robot_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
