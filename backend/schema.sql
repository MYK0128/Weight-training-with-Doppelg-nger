-- Create missing SQLite tables and indexes without changing existing rows.
-- Table names and Unix-millisecond dates are compatible with existing Prisma databases.
CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL,
  passwordHash TEXT NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS User_email_key ON "User"(email);
CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL, userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  createdAt DATETIME NOT NULL, expiresAt DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS Session_token_key ON Session(token);
CREATE TABLE IF NOT EXISTS WorkoutLog (
  id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  date DATETIME NOT NULL, exerciseName TEXT NOT NULL, bodyPart TEXT NOT NULL, weightKg REAL NOT NULL,
  reps INTEGER NOT NULL, sets INTEGER NOT NULL, memo TEXT, createdAt DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS WorkoutLog_user_date ON WorkoutLog(userId, date);
CREATE TABLE IF NOT EXISTS BodyMetric (
  id TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  date DATETIME NOT NULL, weightKg REAL NOT NULL, bodyFatRate REAL, muscleMassKg REAL,
  chestCm REAL, armCm REAL, legCm REAL, createdAt DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS BodyMetric_user_date ON BodyMetric(userId, date);
CREATE TABLE IF NOT EXISTS WeeklyPlan (
  userId TEXT PRIMARY KEY NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  settings JSONB NOT NULL, updatedAt DATETIME NOT NULL
);
